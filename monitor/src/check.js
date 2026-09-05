/*
 * check.js
 *
 * Runs one Feed Doctor check for one monitor: fetch the feed (capped, timed
 * out, identified by a real User-Agent), run the unmodified rule engine
 * (../../feed-doctor.js, the same file the browser page imports), store the
 * result, and decide whether this result is alert-worthy compared to the
 * previous check.
 *
 * refreshDueMonitors() is the cron entry point (src/index.js scheduled()):
 * every Pro monitor plus free monitors 6+ days since their last check (see
 * db.js listMonitorsDueForCheck). runCheckForMonitor() is also called
 * directly, once, right after e-mail confirmation (src/index.js, via
 * ctx.waitUntil) and from the Pro-only manual "check now" route.
 */

import { analyze } from '../../feed-doctor.js';
import { getLatestCheck, recordCheck, markChecked, parseTopIssues, listMonitorsDueForCheck, MAX_TOP_ISSUES, CHECK_STATUS, PLANS } from './db.js';
import { sendMail, alertEmail } from './mail.js';
import { manageUrl, deleteUrl } from './links.js';

export const FEED_FETCH_TIMEOUT_MS = 15000;
export const FEED_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const USER_AGENT = 'ARLing Feed Doctor Monitor (+https://arling.sk/feed-doctor/monitor/)';

export class FeedFetchError extends Error {}

function concatChunks(chunks, totalLength) {
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Read a Response body up to `maxBytes`, aborting the read (not just
 * truncating) the moment the cap is crossed. Uses the streaming body when
 * available (always true for a real `fetch` in Workers); falls back to
 * res.text() for simple test doubles that only implement that method, still
 * enforcing the same cap after the fact.
 */
async function readCapped(res, maxBytes) {
  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > maxBytes) {
          throw new FeedFetchError(`feed_too_large_over_${maxBytes}_bytes`);
        }
        chunks.push(value);
      }
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        // already released or cancelled, nothing to do
      }
    }
    return new TextDecoder('utf-8').decode(concatChunks(chunks, received));
  }
  const text = await res.text();
  if (new TextEncoder().encode(text).length > maxBytes) {
    throw new FeedFetchError(`feed_too_large_over_${maxBytes}_bytes`);
  }
  return text;
}

/** Fetch `feedUrl` with a hard timeout and byte cap. Returns {text, fetchMs}; throws FeedFetchError on any failure. */
export async function fetchFeedCapped(feedUrl, { fetchImpl = fetch, timeoutMs = FEED_FETCH_TIMEOUT_MS, maxBytes = FEED_MAX_BYTES } = {}) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(feedUrl, { signal: controller.signal, headers: { 'user-agent': USER_AGENT } });
    if (!res.ok) throw new FeedFetchError(`feed_fetch_failed_${res.status}`);
    const text = await readCapped(res, maxBytes);
    return { text, fetchMs: Date.now() - started };
  } catch (err) {
    if (err && err.name === 'AbortError') throw new FeedFetchError('feed_fetch_timeout');
    if (err instanceof FeedFetchError) throw err;
    throw new FeedFetchError(String((err && err.message) || err));
  } finally {
    clearTimeout(timer);
  }
}

/** {id, severity, count} for the top MAX_TOP_ISSUES problems, already severity-then-count ordered by checkProducts(). */
export function topIssuesFromReport(report) {
  return (report.problems || []).slice(0, MAX_TOP_ISSUES).map((p) => ({ rule: p.id, severity: p.severity, count: p.count }));
}

/**
 * Does `current` deserve an alert, compared to `previous` (the check row
 * before it, or null on a monitor's very first check)?
 *   - fetch_failed: alert only on the transition into failure (no previous,
 *     or previous succeeded) so a feed stuck down does not re-alert daily.
 *   - free: a new error-severity rule appeared, or the score fell by 5+.
 *   - pro: any change in error/warning/info counts.
 * A previous check that itself failed to fetch is treated as "no
 * comparable baseline" for count-diffing, same as no previous check at all.
 */
export function shouldAlert({ plan, previous, current }) {
  if (current.status === CHECK_STATUS.FETCH_FAILED) {
    return !previous || previous.status !== CHECK_STATUS.FETCH_FAILED;
  }
  if (!previous || previous.status === CHECK_STATUS.FETCH_FAILED) return false;

  if (plan === PLANS.PRO) {
    return current.errors !== previous.errors || current.warnings !== previous.warnings || current.infos !== previous.infos;
  }

  const previousTopIssues = parseTopIssues(previous.top_issues_json);
  const newErrorRule = (current.topIssues || []).some((issue) => issue.severity === 'error' && !previousTopIssues.some((p) => p.rule === issue.rule));
  const scoreDropped = typeof previous.score === 'number' && typeof current.score === 'number' && previous.score - current.score >= 5;
  return newErrorRule || scoreDropped;
}

/**
 * Run one check for `monitor`, store it, and send an alert e-mail when
 * warranted. Returns the stored check row (plus the derived `topIssues`
 * array and an `alerted` flag) for logging/tests. Never throws: a fetch or
 * analyze failure becomes a `fetch_failed` check row, not an exception, so
 * callers (the cron loop, the confirm route's ctx.waitUntil, the manual
 * check route) never need their own try/catch around this.
 */
export async function runCheckForMonitor(env, monitor, { now = new Date() } = {}) {
  const db = env.DB;
  const previous = await getLatestCheck(db, monitor.id);

  let status = CHECK_STATUS.OK;
  let score = null;
  let errors = 0;
  let warnings = 0;
  let infos = 0;
  let topIssues = [];
  let fetchMs = null;
  const startedAt = Date.now();

  try {
    const { text, fetchMs: ms } = await fetchFeedCapped(monitor.feed_url, { fetchImpl: env.fetchImpl });
    fetchMs = ms;
    const report = analyze(text);
    score = report.score;
    errors = report.counts.error;
    warnings = report.counts.warning;
    infos = report.counts.info;
    topIssues = topIssuesFromReport(report);
  } catch (err) {
    status = CHECK_STATUS.FETCH_FAILED;
    fetchMs = Date.now() - startedAt;
  }

  const current = await recordCheck(db, { monitorId: monitor.id, at: now.toISOString(), status, score, errors, warnings, infos, topIssues, fetchMs });
  await markChecked(db, monitor.id, { at: now.toISOString(), plan: monitor.plan });

  const alerted = shouldAlert({ plan: monitor.plan, previous, current: { ...current, topIssues } });
  if (alerted) {
    const { subject, text, html } = alertEmail({
      feedUrl: monitor.feed_url,
      plan: monitor.plan,
      current: { status, score, errors, warnings, infos, topIssues },
      previous: previous ? { status: previous.status, score: previous.score, topIssues: parseTopIssues(previous.top_issues_json) } : null,
      manageUrl: manageUrl(monitor.id, monitor.manage_key),
      deleteUrl: deleteUrl(env, monitor.id, monitor.manage_key),
    });
    // Best-effort: a mailer outage must never fail the check itself, so the
    // send result is only used for the return value's diagnostics.
    await sendMail(env, { to: monitor.email, subject, text, html, unsubscribeUrl: deleteUrl(env, monitor.id, monitor.manage_key) }).catch(() => ({ ok: false }));
  }

  return { ...current, topIssues, alerted };
}

/** Cron entry point: check every monitor listMonitorsDueForCheck() returns, one at a time (feed fetches are already capped and timed out, so this stays well inside the Worker's execution budget for a small monitor count). */
export async function refreshDueMonitors(env, { now = new Date() } = {}) {
  const due = await listMonitorsDueForCheck(env.DB, { now });
  const outcomes = [];
  for (const monitor of due) {
    try {
      const result = await runCheckForMonitor(env, monitor, { now });
      outcomes.push({ monitorId: monitor.id, ok: true, status: result.status, alerted: result.alerted });
    } catch (err) {
      // runCheckForMonitor already turns fetch/analyze failures into a
      // stored fetch_failed row rather than throwing; reaching this catch
      // means D1 itself failed, which is worth surfacing distinctly.
      outcomes.push({ monitorId: monitor.id, ok: false, error: String((err && err.message) || err) });
    }
  }
  return outcomes;
}
