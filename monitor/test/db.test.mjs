// db.test.mjs
// D1-backed monitor/check records: creation, confirmation, plan changes,
// check history, deletion, and the cron's "who is due" query.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMonitor,
  getMonitorById,
  getMonitorByEmail,
  confirmMonitor,
  setPlan,
  recordCheck,
  markChecked,
  getLatestCheck,
  listRecentChecks,
  listMonitorsDueForCheck,
  deleteMonitor,
  maskEmail,
  computeNextCheckAt,
  freeDueCutoff,
  parseTopIssues,
  historyEntry,
  PLANS,
  STATUS,
} from '../src/db.js';
import { createMockD1 } from './helpers/mock-d1.mjs';

test('createMonitor stores a pending-confirmation free monitor with a manage key and confirm token', async () => {
  const db = createMockD1();
  const monitor = await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' }, { now: new Date('2026-09-05T00:00:00Z') });
  assert.equal(monitor.plan, PLANS.FREE);
  assert.equal(monitor.status, STATUS.PENDING);
  assert.ok(monitor.manage_key.length >= 16);
  assert.ok(monitor.confirm_token.length >= 16);
  assert.notEqual(monitor.manage_key, monitor.confirm_token);

  const stored = await getMonitorById(db, monitor.id);
  assert.equal(stored.feed_url, 'https://shop.sk/feed.xml');
  assert.equal(stored.email_confirmed, 0);
});

test('getMonitorByEmail finds an existing monitor regardless of status', async () => {
  const db = createMockD1();
  await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' });
  const found = await getMonitorByEmail(db, 'a@shop.sk');
  assert.ok(found);
  assert.equal(await getMonitorByEmail(db, 'nobody@shop.sk'), null);
});

test('confirmMonitor flips status/email_confirmed only when the token matches, and reports whether anything changed', async () => {
  const db = createMockD1();
  const monitor = await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' });

  assert.equal(await confirmMonitor(db, monitor.id, 'wrong-token'), false);
  let stored = await getMonitorById(db, monitor.id);
  assert.equal(stored.status, STATUS.PENDING);

  assert.equal(await confirmMonitor(db, monitor.id, monitor.confirm_token), true);
  stored = await getMonitorById(db, monitor.id);
  assert.equal(stored.status, STATUS.ACTIVE);
  assert.equal(stored.email_confirmed, 1);
});

test('setPlan updates plan and billing metadata', async () => {
  const db = createMockD1();
  const monitor = await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' });
  await setPlan(db, monitor.id, { plan: PLANS.PRO, billingRef: 'sub_123', validUntil: '2026-10-05' });
  const stored = await getMonitorById(db, monitor.id);
  assert.equal(stored.plan, 'pro');
  assert.equal(stored.billing_ref, 'sub_123');
  assert.equal(stored.valid_until, '2026-10-05');
});

test('recordCheck + markChecked store a check row and update the monitor last/next check timestamps', async () => {
  const db = createMockD1();
  const monitor = await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' });
  const now = new Date('2026-09-05T05:00:00Z');
  await recordCheck(db, { monitorId: monitor.id, at: now.toISOString(), status: 'ok', score: 92, errors: 1, warnings: 3, infos: 0, topIssues: [{ rule: 'missing_gtin', severity: 'warning', count: 3 }] });
  await markChecked(db, monitor.id, { at: now.toISOString(), plan: PLANS.FREE });

  const stored = await getMonitorById(db, monitor.id);
  assert.equal(stored.last_check_at, now.toISOString());
  assert.equal(stored.next_check_at, computeNextCheckAt(PLANS.FREE, now.toISOString()));

  const latest = await getLatestCheck(db, monitor.id);
  assert.equal(latest.score, 92);
  assert.deepEqual(parseTopIssues(latest.top_issues_json), [{ rule: 'missing_gtin', severity: 'warning', count: 3 }]);
});

test('listRecentChecks returns the most recent checks first, capped at the limit', async () => {
  const db = createMockD1();
  const monitor = await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' });
  for (let day = 1; day <= 5; day++) {
    await recordCheck(db, { monitorId: monitor.id, at: `2026-09-0${day}T05:00:00Z`, status: 'ok', score: 90 + day, errors: 0, warnings: 0, infos: 0, topIssues: [] });
  }
  const recent = await listRecentChecks(db, monitor.id, 3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0].at, '2026-09-05T05:00:00Z'); // newest first
  assert.equal(recent[2].at, '2026-09-03T05:00:00Z');

  // historyEntry + reverse (as src/index.js does) gives oldest -> newest for a sparkline.
  const history = recent.map(historyEntry).reverse();
  assert.deepEqual(history.map((h) => h.date), ['2026-09-03T05:00:00Z', '2026-09-04T05:00:00Z', '2026-09-05T05:00:00Z']);
});

test('listMonitorsDueForCheck: every Pro monitor, plus free monitors whose last check is 6+ days old or never happened', async () => {
  const db = createMockD1();
  const now = new Date('2026-09-05T05:00:00Z');

  const proMonitor = await createMonitor(db, { feedUrl: 'https://shop.sk/pro-feed.xml', email: 'pro@shop.sk' });
  await confirmMonitor(db, proMonitor.id, proMonitor.confirm_token);
  await setPlan(db, proMonitor.id, { plan: PLANS.PRO });
  await markChecked(db, proMonitor.id, { at: '2026-09-04T05:00:00Z', plan: PLANS.PRO }); // checked yesterday, still due (Pro is daily)

  const freshFree = await createMonitor(db, { feedUrl: 'https://shop.sk/fresh-feed.xml', email: 'fresh@shop.sk' });
  await confirmMonitor(db, freshFree.id, freshFree.confirm_token);
  await markChecked(db, freshFree.id, { at: '2026-09-04T05:00:00Z', plan: PLANS.FREE }); // checked yesterday, not due yet

  const staleFree = await createMonitor(db, { feedUrl: 'https://shop.sk/stale-feed.xml', email: 'stale@shop.sk' });
  await confirmMonitor(db, staleFree.id, staleFree.confirm_token);
  await markChecked(db, staleFree.id, { at: '2026-08-29T05:00:00Z', plan: PLANS.FREE }); // 7 days ago, due

  const neverChecked = await createMonitor(db, { feedUrl: 'https://shop.sk/new-feed.xml', email: 'new@shop.sk' });
  await confirmMonitor(db, neverChecked.id, neverChecked.confirm_token); // never checked, due

  const pendingFree = await createMonitor(db, { feedUrl: 'https://shop.sk/pending-feed.xml', email: 'pending@shop.sk' }); // never confirmed, not active, must not appear

  const due = await listMonitorsDueForCheck(db, { now });
  const dueIds = due.map((m) => m.id).sort();
  assert.deepEqual(dueIds, [proMonitor.id, staleFree.id, neverChecked.id].sort());
  assert.ok(!dueIds.includes(freshFree.id));
  assert.ok(!dueIds.includes(pendingFree.id));
});

test('deleteMonitor removes the monitor and all of its checks', async () => {
  const db = createMockD1();
  const monitor = await createMonitor(db, { feedUrl: 'https://shop.sk/feed.xml', email: 'a@shop.sk' });
  await recordCheck(db, { monitorId: monitor.id, at: '2026-09-05T05:00:00Z', status: 'ok', score: 90, topIssues: [] });

  await deleteMonitor(db, monitor.id);

  assert.equal(await getMonitorById(db, monitor.id), null);
  assert.equal((await listRecentChecks(db, monitor.id, 90)).length, 0);
});

test('maskEmail keeps the first character and the domain, masks the rest', () => {
  assert.equal(maskEmail('shopper@example.com'), 's******@example.com');
  assert.equal(maskEmail('ab@example.sk'), 'a***@example.sk');
  assert.equal(maskEmail('not-an-email'), 'not-an-email');
});

test('computeNextCheckAt adds 7 days for free, 1 day for pro', () => {
  const from = '2026-09-05T05:00:00.000Z';
  assert.equal(computeNextCheckAt(PLANS.FREE, from), '2026-09-12T05:00:00.000Z');
  assert.equal(computeNextCheckAt(PLANS.PRO, from), '2026-09-06T05:00:00.000Z');
});

test('freeDueCutoff is 6 days before now', () => {
  const now = new Date('2026-09-05T05:00:00.000Z');
  assert.equal(freeDueCutoff(now), '2026-08-30T05:00:00.000Z');
});
