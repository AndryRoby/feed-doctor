/*
 * db.js
 *
 * D1-backed monitor + check records. Same shape as
 * products/arling-asistent/worker/src/tenants.js: every SQL string lives in
 * the SQL constant so tests can build a narrow in-memory mock that
 * pattern-matches on these exact statements (test/helpers/mock-d1.mjs)
 * instead of implementing a general SQL engine.
 *
 * Schema (see ../migrations/0001.sql):
 *   monitors(id, email, email_confirmed, feed_url, plan, status, manage_key,
 *            confirm_token, billing_ref, valid_until, created_at,
 *            last_check_at, next_check_at, last_manual_check_at)
 *   checks(id, monitor_id, at, status, score, errors, warnings, infos,
 *          top_issues_json, fetch_ms)
 *
 * Never store feed content, only counts and rule ids (top_issues_json is a
 * small JSON array of {rule, severity, count}, at most 10 entries).
 */

export const PLANS = { FREE: 'free', PRO: 'pro' };
export const STATUS = { PENDING: 'pending_confirmation', ACTIVE: 'active' };
export const CHECK_STATUS = { OK: 'ok', FETCH_FAILED: 'fetch_failed' };

// How often each plan is expected to be re-checked. The cron (src/check.js
// listMonitorsDueForCheck below) is what actually decides who gets checked
// today; these are only used to fill in the informational next_check_at
// shown on the manage page.
const CHECK_INTERVAL_DAYS = { [PLANS.FREE]: 7, [PLANS.PRO]: 1 };

// A free monitor is due again once its last check is 6+ days old (cron runs
// daily at a fixed hour, so a strict 7-day cutoff could skip a day if the
// cron run drifts by even a few minutes; 6 keeps the cadence at "about
// weekly" without ever silently doubling a period).
export const FREE_DUE_AFTER_DAYS = 6;

export const MAX_TOP_ISSUES = 10;
export const HISTORY_LIMIT = 90;

export const SQL = {
  INSERT_MONITOR: `INSERT INTO monitors (id, email, email_confirmed, feed_url, plan, status, manage_key, confirm_token, created_at) VALUES (?, ?, 0, ?, 'free', 'pending_confirmation', ?, ?, ?)`,
  GET_MONITOR_BY_ID: `SELECT * FROM monitors WHERE id = ?`,
  GET_MONITOR_BY_EMAIL: `SELECT * FROM monitors WHERE email = ? LIMIT 1`,
  CONFIRM_MONITOR: `UPDATE monitors SET email_confirmed = 1, status = 'active' WHERE id = ? AND confirm_token = ?`,
  SET_PLAN: `UPDATE monitors SET plan = ?, billing_ref = ?, valid_until = ? WHERE id = ?`,
  SET_LAST_CHECK: `UPDATE monitors SET last_check_at = ?, next_check_at = ? WHERE id = ?`,
  SET_LAST_MANUAL_CHECK: `UPDATE monitors SET last_manual_check_at = ? WHERE id = ?`,
  DELETE_MONITOR: `DELETE FROM monitors WHERE id = ?`,
  DELETE_CHECKS_FOR_MONITOR: `DELETE FROM checks WHERE monitor_id = ?`,
  INSERT_CHECK: `INSERT INTO checks (id, monitor_id, at, status, score, errors, warnings, infos, top_issues_json, fetch_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  LATEST_CHECK_FOR_MONITOR: `SELECT * FROM checks WHERE monitor_id = ? ORDER BY at DESC LIMIT 1`,
  RECENT_CHECKS_FOR_MONITOR: `SELECT * FROM checks WHERE monitor_id = ? ORDER BY at DESC LIMIT ?`,
  MONITORS_DUE_FOR_CHECK: `SELECT * FROM monitors WHERE status = 'active' AND (plan = 'pro' OR (plan = 'free' AND (last_check_at IS NULL OR last_check_at <= ?)))`,
};

function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** A random URL-safe token for confirm_token / manage_key: 32 bytes, hex-encoded (64 chars), unguessable. */
export function genToken() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Node < 19 fallback (not expected in Workers or a modern test runner, kept only as a belt).
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** "shopper@example.com" -> "s*****@example.com": keep the first char and the domain, mask the rest of the local part. */
export function maskEmail(email) {
  const str = String(email || '');
  const at = str.indexOf('@');
  if (at <= 0) return str;
  const local = str.slice(0, at);
  const domain = str.slice(at);
  const visible = local.slice(0, 1);
  return `${visible}${'*'.repeat(Math.max(3, local.length - 1))}${domain}`;
}

export function planIntervalDays(plan) {
  return CHECK_INTERVAL_DAYS[plan] || CHECK_INTERVAL_DAYS[PLANS.FREE];
}

/** ISO timestamp for when a monitor on this plan is next expected to be checked, given its last check time (or `now` if it has never been checked). */
export function computeNextCheckAt(plan, fromDate, now = new Date()) {
  const base = fromDate ? new Date(fromDate) : now;
  const days = planIntervalDays(plan);
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** The ISO cutoff MONITORS_DUE_FOR_CHECK compares last_check_at against: now minus FREE_DUE_AFTER_DAYS. */
export function freeDueCutoff(now = new Date()) {
  return new Date(now.getTime() - FREE_DUE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getMonitorById(db, id) {
  return db.prepare(SQL.GET_MONITOR_BY_ID).bind(id).first();
}

/** Any existing monitor for this e-mail, confirmed or not: POST /v1/monitors only ever creates free monitors, so this alone enforces "1 free monitor per e-mail". */
export async function getMonitorByEmail(db, email) {
  return db.prepare(SQL.GET_MONITOR_BY_EMAIL).bind(email).first();
}

export async function getLatestCheck(db, monitorId) {
  return db.prepare(SQL.LATEST_CHECK_FOR_MONITOR).bind(monitorId).first();
}

export async function listRecentChecks(db, monitorId, limit = HISTORY_LIMIT) {
  const res = await db.prepare(SQL.RECENT_CHECKS_FOR_MONITOR).bind(monitorId, limit).all();
  return (res && res.results) || [];
}

/** Monitors the daily cron should check today: every Pro monitor, plus free monitors last checked FREE_DUE_AFTER_DAYS+ days ago (or never). */
export async function listMonitorsDueForCheck(db, { now = new Date() } = {}) {
  const res = await db.prepare(SQL.MONITORS_DUE_FOR_CHECK).bind(freeDueCutoff(now)).all();
  return (res && res.results) || [];
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export class DuplicateMonitorError extends Error {
  constructor(email) {
    super(`a monitor already exists for e-mail: ${email}`);
    this.name = 'DuplicateMonitorError';
    this.email = email;
  }
}

/**
 * Create a new pending-confirmation monitor. Callers (src/index.js) are
 * expected to have already checked getMonitorByEmail() for the 1-per-email
 * rule and returned 409 before calling this; this only guards the D1 write
 * itself against a race between that check and this insert (two concurrent
 * signups for the same e-mail), surfacing it the same way as an
 * up-front duplicate rather than a generic 500.
 */
export async function createMonitor(db, { feedUrl, email }, { now = new Date(), id = genId(), manageKey = genToken(), confirmToken = genToken() } = {}) {
  try {
    await db.prepare(SQL.INSERT_MONITOR).bind(id, email, feedUrl, manageKey, confirmToken, now.toISOString()).run();
  } catch (err) {
    const message = String((err && err.message) || err);
    if (/constraint failed/i.test(message)) throw new DuplicateMonitorError(email);
    throw err;
  }
  return {
    id,
    email,
    email_confirmed: 0,
    feed_url: feedUrl,
    plan: PLANS.FREE,
    status: STATUS.PENDING,
    manage_key: manageKey,
    confirm_token: confirmToken,
    created_at: now.toISOString(),
  };
}

/** Confirms a pending monitor if `token` matches; returns false (no row changed) for an unknown id or a wrong/reused-elsewhere token. */
export async function confirmMonitor(db, id, token) {
  const result = await db.prepare(SQL.CONFIRM_MONITOR).bind(id, token).run();
  const changed = (result && result.meta && result.meta.changes) || (result && result.changes) || 0;
  return changed > 0;
}

export async function setPlan(db, id, { plan, billingRef = null, validUntil = null }) {
  await db.prepare(SQL.SET_PLAN).bind(plan, billingRef, validUntil, id).run();
}

export async function recordCheck(db, { id = genId(), monitorId, at = new Date().toISOString(), status, score = null, errors = 0, warnings = 0, infos = 0, topIssues = [], fetchMs = null }) {
  await db.prepare(SQL.INSERT_CHECK).bind(id, monitorId, at, status, score, errors, warnings, infos, JSON.stringify(topIssues.slice(0, MAX_TOP_ISSUES)), fetchMs).run();
  return { id, monitor_id: monitorId, at, status, score, errors, warnings, infos, top_issues_json: JSON.stringify(topIssues), fetch_ms: fetchMs };
}

export async function markChecked(db, id, { at, plan }) {
  await db.prepare(SQL.SET_LAST_CHECK).bind(at, computeNextCheckAt(plan, at), id).run();
}

export async function markManualCheck(db, id, at = new Date().toISOString()) {
  await db.prepare(SQL.SET_LAST_MANUAL_CHECK).bind(at, id).run();
}

export async function deleteMonitor(db, id) {
  await db.prepare(SQL.DELETE_CHECKS_FOR_MONITOR).bind(id).run();
  await db.prepare(SQL.DELETE_MONITOR).bind(id).run();
}

// ---------------------------------------------------------------------------
// Shaping helpers (used by src/index.js to build API responses)
// ---------------------------------------------------------------------------

export function parseTopIssues(json) {
  try {
    const parsed = JSON.parse(json || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

export function historyEntry(check) {
  return { date: check.at, score: check.score, error: check.errors, warning: check.warnings };
}
