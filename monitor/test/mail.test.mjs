// mail.test.mjs
// E-mail content builders (pure) and sendMail's HTTP call to the homelab
// mailer (mocked fetch): success, non-2xx, network failure, and the
// not-yet-configured case (MAIL_URL/MAIL_TOKEN missing), all of which must
// resolve, never throw, so callers never need their own try/catch.

import test from 'node:test';
import assert from 'node:assert/strict';

import { sendMail, confirmationEmail, alertEmail } from '../src/mail.js';

test('confirmationEmail mentions the feed URL and the confirm link, and stays plain (no markdown/emoji)', () => {
  const { subject, text, html } = confirmationEmail({ feedUrl: 'https://shop.sk/feed.xml', confirmUrl: 'https://feed-monitor.example.workers.dev/v1/monitors/confirm?id=m1&token=abc' });
  assert.match(subject, /Confirm/);
  assert.match(text, /https:\/\/shop\.sk\/feed\.xml/);
  assert.match(text, /confirm\?id=m1&token=abc/);
  assert.match(text, /checker in your browser stays local/);
  assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(text), 'no emoji in the mail text');
  assert.match(html, /<a href="[^"]*confirm\?id=m1[^"]*">/);
});

test('alertEmail for a fetch failure explains it is a one-time alert and includes manage/delete links', () => {
  const { subject, text } = alertEmail({
    feedUrl: 'https://shop.sk/feed.xml',
    plan: 'free',
    current: { status: 'fetch_failed' },
    previous: null,
    manageUrl: 'https://arling.sk/feed-doctor/monitor/?id=m1&key=k1',
    deleteUrl: 'https://feed-monitor.example.workers.dev/v1/monitors/m1/delete?key=k1',
  });
  assert.match(subject, /could not reach/);
  assert.match(text, /only alert you will get/);
  assert.match(text, /manage\/\?id=m1&key=k1|monitor\/\?id=m1&key=k1/);
  assert.match(text, /\/delete\?key=k1/);
});

test('alertEmail for a score change lists new error rules and points free plans at the upgrade path', () => {
  const previous = { status: 'ok', score: 92, topIssues: [{ rule: 'missing_gtin', severity: 'warning', count: 2 }] };
  const current = {
    status: 'ok',
    score: 78,
    errors: 1,
    warnings: 2,
    infos: 0,
    topIssues: [
      { rule: 'missing_gtin', severity: 'warning', count: 2 },
      { rule: 'missing_price', severity: 'error', count: 1 },
    ],
  };
  const { subject, text } = alertEmail({ feedUrl: 'https://shop.sk/feed.xml', plan: 'free', current, previous, manageUrl: 'https://arling.sk/feed-doctor/monitor/?id=m1&key=k1', deleteUrl: 'https://x/delete' });
  assert.match(subject, /78/);
  assert.match(text, /Score: 78 \(was 92\)/);
  assert.match(text, /missing_price/);
  assert.doesNotMatch(text, /missing_gtin \(/); // not new, should not be listed under "new error rules"
  assert.match(text, /Upgrade to Pro/);
});

test('alertEmail for a pro plan does not push the upgrade line', () => {
  const previous = { status: 'ok', score: 92, topIssues: [] };
  const current = { status: 'ok', score: 90, errors: 0, warnings: 1, infos: 0, topIssues: [] };
  const { text } = alertEmail({ feedUrl: 'https://shop.sk/feed.xml', plan: 'pro', current, previous, manageUrl: 'https://x/manage', deleteUrl: 'https://x/delete' });
  assert.doesNotMatch(text, /Upgrade to Pro/);
});

test('sendMail posts to MAIL_URL with the X-Mail-Token header and returns ok:true on a 2xx', async () => {
  let seenUrl, seenHeaders, seenBody;
  const env = {
    MAIL_URL: 'https://homelab.tailbf8f27.ts.net/subscribe/api/mail',
    MAIL_TOKEN: 'secret-token',
    fetchImpl: async (url, opts) => {
      seenUrl = url;
      seenHeaders = opts.headers;
      seenBody = JSON.parse(opts.body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  };
  const result = await sendMail(env, { to: 'a@shop.sk', subject: 'Hi', text: 'Body', unsubscribeUrl: 'https://x/delete' });
  assert.equal(result.ok, true);
  assert.equal(seenUrl, env.MAIL_URL);
  assert.equal(seenHeaders['X-Mail-Token'], 'secret-token');
  assert.equal(seenBody.to, 'a@shop.sk');
  assert.equal(seenBody.unsubscribe_url, 'https://x/delete');
});

test('sendMail returns ok:false (never throws) on a non-2xx response', async () => {
  const env = { MAIL_URL: 'https://mail.example', MAIL_TOKEN: 't', fetchImpl: async () => new Response('nope', { status: 500 }) };
  const result = await sendMail(env, { to: 'a@shop.sk', subject: 'Hi', text: 'Body' });
  assert.equal(result.ok, false);
});

test('sendMail returns ok:false (never throws) when fetch itself rejects', async () => {
  const env = {
    MAIL_URL: 'https://mail.example',
    MAIL_TOKEN: 't',
    fetchImpl: async () => {
      throw new Error('network down');
    },
  };
  const result = await sendMail(env, { to: 'a@shop.sk', subject: 'Hi', text: 'Body' });
  assert.equal(result.ok, false);
  assert.match(result.error, /network down/);
});

test('sendMail returns ok:false when MAIL_URL/MAIL_TOKEN are not configured yet', async () => {
  const result = await sendMail({}, { to: 'a@shop.sk', subject: 'Hi', text: 'Body' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'mail_not_configured');
});
