// index.test.mjs
// Router-level wiring using real (Node-native) Request/Response objects
// against the actual default.fetch handler, so the glue between index.js,
// db.js, check.js and mail.js is exercised end to end, not just as
// individually tested pure functions.
//
// ctx = {} (no waitUntil) throughout: index.js falls back to awaiting
// background work (confirmation e-mail, first check after confirm) inline
// when no ctx.waitUntil is given, exactly as arling-asistent's own tests
// rely on, so assertions can run right after the awaited call completes.

import test from 'node:test';
import assert from 'node:assert/strict';

import worker, { isPrivateHost, checkRateLimit } from '../src/index.js';
import { createMockD1 } from './helpers/mock-d1.mjs';
import { createMockKv } from './helpers/mock-kv.mjs';

const GOOD_FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>t</title><link>https://shop.example.com</link><description>d</description>
<item><g:id>sku-1</g:id><title>Water Bottle</title><description>A steel water bottle that keeps drinks cold.</description><link>https://shop.example.com/p/1</link><g:image_link>https://shop.example.com/i/1.jpg</g:image_link><g:price>19.99 USD</g:price><g:availability>in stock</g:availability><g:condition>new</g:condition></item>
</channel></rss>`;

function makeEnv({ feedUrl = 'https://shop.sk/feed.xml', feedText = GOOD_FEED, mailOk = true } = {}) {
  const outbound = [];
  return {
    DB: createMockD1(),
    FEEDMONITOR_RATE_LIMIT: createMockKv(),
    ALLOWED_ORIGINS: 'arling.sk',
    ADMIN_TOKEN: 'test-admin-token',
    MAIL_URL: 'https://homelab.tailbf8f27.ts.net/subscribe/api/mail',
    MAIL_TOKEN: 'test-mail-token',
    STRIPE_LINK: 'https://buy.stripe.com/test123',
    WORKER_BASE_URL: 'https://feed-monitor.example.workers.dev',
    fetchImpl: async (url, opts) => {
      outbound.push({ url: String(url), opts });
      if (String(url) === feedUrl) return new Response(feedText, { status: 200 });
      if (String(url) === 'https://homelab.tailbf8f27.ts.net/subscribe/api/mail') return new Response(JSON.stringify({ ok: mailOk }), { status: mailOk ? 200 : 500 });
      throw new Error(`unexpected fetch in test: ${url}`);
    },
    _outbound: outbound,
  };
}

function req(path, { method = 'GET', body, headers = {} } = {}) {
  const init = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://feed-monitor.example.workers.dev${path}`, init);
}

async function createAndConfirm(env, { feedUrl = 'https://shop.sk/feed.xml', email = 'a@shop.sk' } = {}) {
  const createRes = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: feedUrl, email } }), env, {});
  const created = await createRes.json();
  // The confirm token/manage key are only ever revealed via the e-mail link
  // and the confirm redirect, never in the create response; tests read
  // them straight out of the mock D1's in-memory row instead.
  const row = env.DB._monitors.get(created.id);
  const confirmRes = await worker.fetch(req(`/v1/monitors/confirm?id=${created.id}&token=${row.confirm_token}`), env, {});
  return { created, confirmRes, manageKey: row.manage_key, id: created.id };
}

test('GET /health returns a static ok payload', async () => {
  const res = await worker.fetch(req('/health'), makeEnv(), {});
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'ok');
});

test('isPrivateHost rejects localhost/private ranges, accepts a public hostname', () => {
  assert.equal(isPrivateHost('localhost'), true);
  assert.equal(isPrivateHost('192.168.1.10'), true);
  assert.equal(isPrivateHost('10.0.0.5'), true);
  assert.equal(isPrivateHost('example.com'), false);
  assert.equal(isPrivateHost('shop.sk'), false);
});

test('POST /v1/monitors validates input: bad email, private-host feed URL', async () => {
  const env = makeEnv();
  const badEmail = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'not-an-email' } }), env, {});
  assert.equal(badEmail.status, 400);
  assert.equal((await badEmail.json()).error, 'validation_failed');

  const privateHost = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'http://192.168.1.5/feed.xml', email: 'a@shop.sk' } }), env, {});
  assert.equal(privateHost.status, 400);
});

test('POST /v1/monitors creates a pending monitor and sends a confirmation e-mail', async () => {
  const env = makeEnv();
  const res = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'a@shop.sk' } }), env, {});
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.status, 'pending_confirmation');
  assert.ok(body.id);

  const mailCall = env._outbound.find((c) => c.url.includes('/api/mail'));
  assert.ok(mailCall, 'expected a call to the mailer');
  const mailBody = JSON.parse(mailCall.opts.body);
  assert.equal(mailBody.to, 'a@shop.sk');
  assert.match(mailBody.text, /confirm/i);
});

test('POST /v1/monitors rejects a second monitor for the same e-mail with 409', async () => {
  const env = makeEnv();
  await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'a@shop.sk' } }), env, {});
  const second = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/other-feed.xml', email: 'a@shop.sk' } }), env, {});
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error, 'duplicate_email');
});

test('POST /v1/monitors is rate limited to 5 per IP per hour', async () => {
  const env = makeEnv();
  const ip = '1.2.3.4';
  for (let i = 0; i < 5; i++) {
    const res = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: `u${i}@shop.sk` }, headers: { 'CF-Connecting-IP': ip } }), env, {});
    assert.equal(res.status, 201, `signup ${i} should succeed`);
  }
  const sixth = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'u6@shop.sk' }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  assert.equal(sixth.status, 429);
});

test('a rate limited IP still gets a 400 for invalid input, so a typo never eats a signup', async () => {
  const env = makeEnv();
  const ip = '9.9.9.9';
  for (let i = 0; i < 5; i++) {
    await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: `v${i}@shop.sk` }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  }
  const badEmail = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'nope' }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  assert.equal(badEmail.status, 400);
  assert.equal((await badEmail.json()).error, 'validation_failed');
  const privateHost = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'http://192.168.1.1/feed.xml', email: 'ok@shop.sk' }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  assert.equal(privateHost.status, 400);
  const valid = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'v9@shop.sk' }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  assert.equal(valid.status, 429, 'a valid signup from the same IP is still refused');
});

test('the admin token skips the per-IP signup limit (used by our own live verification)', async () => {
  const env = makeEnv();
  const ip = '8.8.8.8';
  for (let i = 0; i < 5; i++) {
    await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: `w${i}@shop.sk` }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  }
  const blocked = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'w9@shop.sk' }, headers: { 'CF-Connecting-IP': ip } }), env, {});
  assert.equal(blocked.status, 429);
  const withAdmin = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'w9@shop.sk' }, headers: { 'CF-Connecting-IP': ip, 'X-Admin-Token': env.ADMIN_TOKEN } }), env, {});
  assert.equal(withAdmin.status, 201);
  const wrongAdmin = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'w10@shop.sk' }, headers: { 'CF-Connecting-IP': ip, 'X-Admin-Token': 'not-the-token' } }), env, {});
  assert.equal(wrongAdmin.status, 429);
});

test('checkRateLimit fails open when the KV binding errors', async () => {
  const brokenKv = { get: async () => { throw new Error('kv down'); }, put: async () => {} };
  const result = await checkRateLimit(brokenKv, 'signup', '1.2.3.4', { limit: 5 });
  assert.equal(result.allowed, true);
  assert.equal(result.failedOpen, true);
});

test('GET /v1/monitors/confirm with a wrong token does not activate the monitor', async () => {
  const env = makeEnv();
  const createRes = await worker.fetch(req('/v1/monitors', { method: 'POST', body: { feed_url: 'https://shop.sk/feed.xml', email: 'a@shop.sk' } }), env, {});
  const { id } = await createRes.json();
  const res = await worker.fetch(req(`/v1/monitors/confirm?id=${id}&token=wrong`), env, {});
  assert.equal(res.status, 400);
  assert.equal(env.DB._monitors.get(id).status, 'pending_confirmation');
});

test('GET /v1/monitors/confirm with an unknown id returns 404', async () => {
  const res = await worker.fetch(req('/v1/monitors/confirm?id=nope&token=x'), makeEnv(), {});
  assert.equal(res.status, 404);
});

test('GET /v1/monitors/confirm activates the monitor, runs the first check, and redirects to the manage page', async () => {
  const env = makeEnv();
  const { confirmRes, id, manageKey } = await createAndConfirm(env);

  assert.equal(confirmRes.status, 302);
  const location = confirmRes.headers.get('Location');
  assert.match(location, new RegExp(`^https://arling\\.sk/feed-doctor/monitor/\\?id=${id}&key=${manageKey}$`));

  const stored = env.DB._monitors.get(id);
  assert.equal(stored.status, 'active');
  assert.equal(stored.email_confirmed, 1);
  assert.ok(stored.last_check_at, 'first check should have run and stamped last_check_at');

  const checks = env.DB._checks.filter((c) => c.monitor_id === id);
  assert.equal(checks.length, 1);
  assert.equal(checks[0].status, 'ok');
});

test('confirming twice is idempotent: second visit just redirects again, no second check', async () => {
  const env = makeEnv();
  const { id, manageKey } = await createAndConfirm(env);
  const again = await worker.fetch(req(`/v1/monitors/confirm?id=${id}&token=whatever-now-ignored`), env, {});
  assert.equal(again.status, 302);
  assert.equal(env.DB._checks.filter((c) => c.monitor_id === id).length, 1);
});

test('GET /v1/monitors/:id with the wrong key returns 404, not 403 (no existence leak)', async () => {
  const env = makeEnv();
  const { id } = await createAndConfirm(env);
  const res = await worker.fetch(req(`/v1/monitors/${id}?key=wrong-key`), env, {});
  assert.equal(res.status, 404);
});

test('GET /v1/monitors/:id with the right key returns the status contract shape', async () => {
  const env = makeEnv();
  const { id, manageKey } = await createAndConfirm(env);
  const res = await worker.fetch(req(`/v1/monitors/${id}?key=${manageKey}`), env, {});
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.id, id);
  assert.equal(body.feed_url, 'https://shop.sk/feed.xml');
  assert.equal(body.email_masked, 'a***@shop.sk');
  assert.equal(body.plan, 'free');
  assert.equal(body.status, 'active');
  assert.equal(typeof body.last_score, 'number');
  assert.ok('error' in body.last_counts && 'warning' in body.last_counts && 'info' in body.last_counts);
  assert.ok(Array.isArray(body.last_top_issues));
  assert.ok(Array.isArray(body.history));
  assert.ok(body.history.length >= 1);
  assert.match(body.upgrade_url, new RegExp(`client_reference_id=${id}`));
});

test('POST /v1/monitors/:id/check is a Pro-only feature: 402 for a free monitor', async () => {
  const env = makeEnv();
  const { id, manageKey } = await createAndConfirm(env);
  const res = await worker.fetch(req(`/v1/monitors/${id}/check?key=${manageKey}`, { method: 'POST' }), env, {});
  assert.equal(res.status, 402);
  assert.equal((await res.json()).error, 'pro_required');
});

test('POST /v1/monitors/:id/check runs a check for a Pro monitor, then rate limits a second call within the hour', async () => {
  const env = makeEnv();
  const { id, manageKey } = await createAndConfirm(env);
  await worker.fetch(req(`/v1/monitors/${id}/plan`, { method: 'PATCH', headers: { 'X-Admin-Token': env.ADMIN_TOKEN }, body: { plan: 'pro', billing_ref: 'sub_1' } }), env, {});

  const first = await worker.fetch(req(`/v1/monitors/${id}/check?key=${manageKey}`, { method: 'POST' }), env, {});
  assert.equal(first.status, 200);
  assert.equal((await first.json()).ok, true);

  const second = await worker.fetch(req(`/v1/monitors/${id}/check?key=${manageKey}`, { method: 'POST' }), env, {});
  assert.equal(second.status, 429);
});

test('PATCH /v1/monitors/:id/plan requires a valid X-Admin-Token', async () => {
  const env = makeEnv();
  const { id } = await createAndConfirm(env);
  const noToken = await worker.fetch(req(`/v1/monitors/${id}/plan`, { method: 'PATCH', body: { plan: 'pro' } }), env, {});
  assert.equal(noToken.status, 401);

  const wrongToken = await worker.fetch(req(`/v1/monitors/${id}/plan`, { method: 'PATCH', headers: { 'X-Admin-Token': 'nope' }, body: { plan: 'pro' } }), env, {});
  assert.equal(wrongToken.status, 401);

  const ok = await worker.fetch(req(`/v1/monitors/${id}/plan`, { method: 'PATCH', headers: { 'X-Admin-Token': env.ADMIN_TOKEN }, body: { plan: 'pro', billing_ref: 'sub_1', valid_until: '2026-10-05' } }), env, {});
  assert.equal(ok.status, 200);
  assert.equal(env.DB._monitors.get(id).plan, 'pro');
  assert.equal(env.DB._monitors.get(id).billing_ref, 'sub_1');
});

test('DELETE /v1/monitors/:id removes the monitor; GET .../delete works the same way for an e-mail link', async () => {
  const env = makeEnv();
  const a = await createAndConfirm(env, { email: 'a@shop.sk' });
  const del = await worker.fetch(req(`/v1/monitors/${a.id}?key=${a.manageKey}`, { method: 'DELETE' }), env, {});
  assert.equal(del.status, 200);
  assert.equal(env.DB._monitors.has(a.id), false);

  const b = await createAndConfirm(env, { email: 'b@shop.sk' });
  const delLink = await worker.fetch(req(`/v1/monitors/${b.id}/delete?key=${b.manageKey}`), env, {});
  assert.equal(delLink.status, 200);
  assert.equal(env.DB._monitors.has(b.id), false);
});

test('DELETE with the wrong key returns 404 and leaves the monitor untouched', async () => {
  const env = makeEnv();
  const { id } = await createAndConfirm(env);
  const res = await worker.fetch(req(`/v1/monitors/${id}?key=wrong`, { method: 'DELETE' }), env, {});
  assert.equal(res.status, 404);
  assert.equal(env.DB._monitors.has(id), true);
});

test('unknown routes return 404', async () => {
  const res = await worker.fetch(req('/v1/nope'), makeEnv(), {});
  assert.equal(res.status, 404);
});
