// check.test.mjs
// Feed fetch (timeout, byte cap), the alert decision, and the full
// fetch -> analyze -> store -> maybe-alert pipeline against a mocked D1 and
// a mocked fetch (both the feed URL and the mailer URL).

import test from 'node:test';
import assert from 'node:assert/strict';

import { fetchFeedCapped, FeedFetchError, shouldAlert, topIssuesFromReport, runCheckForMonitor, refreshDueMonitors } from '../src/check.js';
import { createMonitor, confirmMonitor, markChecked, getLatestCheck, PLANS, CHECK_STATUS } from '../src/db.js';
import { createMockD1 } from './helpers/mock-d1.mjs';
import { analyze } from '../../feed-doctor.js';

const GOOD_FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>t</title><link>https://shop.example.com</link><description>d</description>
<item><g:id>sku-1</g:id><title>Water Bottle</title><description>A steel water bottle that keeps drinks cold.</description><link>https://shop.example.com/p/1</link><g:image_link>https://shop.example.com/i/1.jpg</g:image_link><g:price>19.99 USD</g:price><g:availability>in stock</g:availability><g:condition>new</g:condition></item>
</channel></rss>`;

const BAD_FEED = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>t</title><link>https://shop.example.com</link><description>d</description>
<item><title></title><description></description></item>
</channel></rss>`;

function feedFetchImpl(feedUrl, text, { status = 200 } = {}) {
  return async (url, opts) => {
    if (url === feedUrl) return new Response(text, { status });
    throw new Error(`unexpected fetch in test: ${url}`);
  };
}

// ---------------------------------------------------------------------------
// fetchFeedCapped
// ---------------------------------------------------------------------------

test('fetchFeedCapped returns the body text and an elapsed time on success', async () => {
  const { text, fetchMs } = await fetchFeedCapped('https://shop.sk/feed.xml', { fetchImpl: feedFetchImpl('https://shop.sk/feed.xml', GOOD_FEED) });
  assert.equal(text, GOOD_FEED);
  assert.ok(fetchMs >= 0);
});

test('fetchFeedCapped throws on a non-2xx response', async () => {
  await assert.rejects(() => fetchFeedCapped('https://shop.sk/feed.xml', { fetchImpl: feedFetchImpl('https://shop.sk/feed.xml', 'nope', { status: 500 }) }), FeedFetchError);
});

test('fetchFeedCapped throws when the body exceeds the byte cap, without waiting for the whole body', async () => {
  const bigText = 'x'.repeat(1000);
  const fetchImpl = async () => new Response(bigText, { status: 200 });
  await assert.rejects(() => fetchFeedCapped('https://shop.sk/feed.xml', { fetchImpl, maxBytes: 100 }), FeedFetchError);
});

test('fetchFeedCapped aborts and throws after the timeout on a hanging request', async () => {
  const hangingFetch = (url, opts) =>
    new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        reject(err);
      });
    });
  await assert.rejects(() => fetchFeedCapped('https://shop.sk/feed.xml', { fetchImpl: hangingFetch, timeoutMs: 15 }), (err) => {
    assert.ok(err instanceof FeedFetchError);
    assert.match(err.message, /timeout/);
    return true;
  });
});

test('fetchFeedCapped wraps a plain network error', async () => {
  const failing = async () => {
    throw new Error('DNS lookup failed');
  };
  await assert.rejects(() => fetchFeedCapped('https://shop.sk/feed.xml', { fetchImpl: failing }), FeedFetchError);
});

// ---------------------------------------------------------------------------
// topIssuesFromReport / shouldAlert
// ---------------------------------------------------------------------------

test('topIssuesFromReport maps the top problems to {rule, severity, count}, capped at 10', () => {
  const report = analyze(BAD_FEED);
  const top = topIssuesFromReport(report);
  assert.ok(top.length > 0);
  assert.ok(top.length <= 10);
  assert.ok(top.every((t) => typeof t.rule === 'string' && typeof t.severity === 'string' && typeof t.count === 'number'));
});

test('shouldAlert: fetch_failed alerts only on the transition into failure', () => {
  const current = { status: CHECK_STATUS.FETCH_FAILED };
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous: null, current }), true);
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous: { status: CHECK_STATUS.OK }, current }), true);
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous: { status: CHECK_STATUS.FETCH_FAILED }, current }), false);
});

test('shouldAlert: free plan alerts on a new error rule or a 5+ point score drop, not on smaller changes', () => {
  const previous = { status: CHECK_STATUS.OK, score: 90, top_issues_json: JSON.stringify([{ rule: 'missing_gtin', severity: 'warning', count: 2 }]) };
  const noChange = { status: CHECK_STATUS.OK, score: 89, topIssues: [{ rule: 'missing_gtin', severity: 'warning', count: 2 }] };
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous, current: noChange }), false);

  const newError = { status: CHECK_STATUS.OK, score: 88, topIssues: [{ rule: 'missing_gtin', severity: 'warning', count: 2 }, { rule: 'missing_price', severity: 'error', count: 1 }] };
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous, current: newError }), true);

  const scoreDropped = { status: CHECK_STATUS.OK, score: 84, topIssues: [{ rule: 'missing_gtin', severity: 'warning', count: 2 }] };
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous, current: scoreDropped }), true);
});

test('shouldAlert: pro plan alerts on any count change, free plan does not for the same input', () => {
  const previous = { status: CHECK_STATUS.OK, score: 90, errors: 1, warnings: 2, infos: 0, top_issues_json: '[]' };
  const current = { status: CHECK_STATUS.OK, score: 90, errors: 1, warnings: 3, infos: 0, topIssues: [] };
  assert.equal(shouldAlert({ plan: PLANS.PRO, previous, current }), true);
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous, current }), false); // warning count moved but no new error rule and score unchanged
});

test('shouldAlert: no previous check means no alert (first check just sets the baseline)', () => {
  assert.equal(shouldAlert({ plan: PLANS.FREE, previous: null, current: { status: CHECK_STATUS.OK, score: 60, topIssues: [] } }), false);
});

// ---------------------------------------------------------------------------
// runCheckForMonitor / refreshDueMonitors
// ---------------------------------------------------------------------------

function makeEnv({ feedUrl, feedText, feedStatus = 200, mailOk = true }) {
  const mailUrl = 'https://homelab.tailbf8f27.ts.net/subscribe/api/mail';
  const sentMails = [];
  return {
    DB: createMockD1(),
    MAIL_URL: mailUrl,
    MAIL_TOKEN: 'test-mail-token',
    fetchImpl: async (url, opts) => {
      if (url === feedUrl) return new Response(feedText, { status: feedStatus });
      if (url === mailUrl) {
        sentMails.push(JSON.parse(opts.body));
        return new Response(JSON.stringify({ ok: mailOk }), { status: mailOk ? 200 : 500 });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    },
    _sentMails: sentMails,
  };
}

test('runCheckForMonitor stores a first successful check and sends no alert (nothing to compare against)', async () => {
  const feedUrl = 'https://shop.sk/feed.xml';
  const env = makeEnv({ feedUrl, feedText: GOOD_FEED });
  const monitor = await createMonitor(env.DB, { feedUrl, email: 'a@shop.sk' });
  await confirmMonitor(env.DB, monitor.id, monitor.confirm_token);

  const result = await runCheckForMonitor(env, { ...monitor, plan: PLANS.FREE, status: 'active' });
  assert.equal(result.status, 'ok');
  assert.equal(result.alerted, false);
  assert.equal(env._sentMails.length, 0);

  const stored = await getLatestCheck(env.DB, monitor.id);
  assert.equal(stored.score, result.score);
});

test('runCheckForMonitor sends an alert e-mail when a free monitor picks up a new error rule', async () => {
  const feedUrl = 'https://shop.sk/feed.xml';
  const env = makeEnv({ feedUrl, feedText: GOOD_FEED });
  const monitor = await createMonitor(env.DB, { feedUrl, email: 'a@shop.sk' });
  await confirmMonitor(env.DB, monitor.id, monitor.confirm_token);
  const active = { ...monitor, plan: PLANS.FREE, status: 'active' };

  await runCheckForMonitor(env, active); // baseline, no alert

  env.fetchImpl = async (url, opts) => {
    if (url === feedUrl) return new Response(BAD_FEED, { status: 200 });
    if (url === env.MAIL_URL) {
      env._sentMails.push(JSON.parse(opts.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  const second = await runCheckForMonitor(env, active);
  assert.equal(second.alerted, true);
  assert.equal(env._sentMails.length, 1);
  assert.equal(env._sentMails[0].to, 'a@shop.sk');
  assert.match(env._sentMails[0].subject, /score changed/);
});

test('runCheckForMonitor records a fetch_failed check and alerts once, not on the following identical failure', async () => {
  const feedUrl = 'https://shop.sk/down-feed.xml';
  const env = makeEnv({ feedUrl, feedText: '', feedStatus: 500 });
  const monitor = await createMonitor(env.DB, { feedUrl, email: 'a@shop.sk' });
  await confirmMonitor(env.DB, monitor.id, monitor.confirm_token);
  const active = { ...monitor, plan: PLANS.FREE, status: 'active' };

  const first = await runCheckForMonitor(env, active);
  assert.equal(first.status, 'fetch_failed');
  assert.equal(first.alerted, true);
  assert.equal(env._sentMails.length, 1);
  assert.match(env._sentMails[0].subject, /could not reach/);

  const second = await runCheckForMonitor(env, active);
  assert.equal(second.status, 'fetch_failed');
  assert.equal(second.alerted, false);
  assert.equal(env._sentMails.length, 1); // no second alert for the same ongoing failure
});

test('refreshDueMonitors checks every due monitor and skips one that is not due yet', async () => {
  const feedUrlA = 'https://shop.sk/a.xml';
  const feedUrlB = 'https://shop.sk/b.xml';
  const env = makeEnv({ feedUrl: feedUrlA, feedText: GOOD_FEED });
  env.fetchImpl = async (url, opts) => {
    if (url === feedUrlA || url === feedUrlB) return new Response(GOOD_FEED, { status: 200 });
    if (url === env.MAIL_URL) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    throw new Error(`unexpected fetch: ${url}`);
  };

  const now = new Date('2026-09-05T05:00:00.000Z');
  const due = await createMonitor(env.DB, { feedUrl: feedUrlA, email: 'due@shop.sk' }, { now });
  await confirmMonitor(env.DB, due.id, due.confirm_token);
  await markChecked(env.DB, due.id, { at: '2026-08-29T05:00:00.000Z', plan: PLANS.FREE }); // 7 days ago, due

  const notDue = await createMonitor(env.DB, { feedUrl: feedUrlB, email: 'notdue@shop.sk' }, { now });
  await confirmMonitor(env.DB, notDue.id, notDue.confirm_token);
  await markChecked(env.DB, notDue.id, { at: '2026-09-04T05:00:00.000Z', plan: PLANS.FREE }); // yesterday, not due

  const outcomes = await refreshDueMonitors(env, { now });
  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].monitorId, due.id);
  assert.equal(outcomes[0].ok, true);
});
