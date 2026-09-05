/*
 * index.js
 *
 * The Worker's fetch router, plus the scheduled (cron) export. Thin on
 * purpose, same shape as products/arling-asistent/worker/src/index.js:
 * validation and D1 access live in db.js, the fetch/analyze/alert pipeline
 * lives in check.js, e-mail content and sending live in mail.js. Only
 * routing, input validation, CORS, and rate limiting live here.
 *
 * Routes:
 *   POST   /v1/monitors                  -> create (free, pending confirmation)
 *   GET    /v1/monitors/confirm          -> confirm + first check (ctx.waitUntil) + 302 to the manage page
 *   GET    /v1/monitors/:id              -> status (?key=manage_key required)
 *   POST   /v1/monitors/:id/check        -> manual check, Pro only (?key=)
 *   DELETE /v1/monitors/:id              -> delete (?key=)
 *   GET    /v1/monitors/:id/delete       -> same as DELETE, so an e-mail link works
 *   PATCH/POST /v1/monitors/:id/plan     -> admin only (X-Admin-Token), billing hook
 *   GET    /health                       -> static ok
 *   *                                    -> 404
 *
 * Scheduled: refreshDueMonitors() from check.js, once a day (wrangler.toml
 * [triggers]).
 */

import {
  createMonitor,
  getMonitorById,
  getMonitorByEmail,
  confirmMonitor,
  setPlan,
  deleteMonitor,
  markManualCheck,
  listRecentChecks,
  getLatestCheck,
  maskEmail,
  parseTopIssues,
  historyEntry,
  DuplicateMonitorError,
  PLANS,
  STATUS,
} from './db.js';
import { runCheckForMonitor, refreshDueMonitors } from './check.js';
import { sendMail, confirmationEmail } from './mail.js';
import { manageUrl, confirmUrl, deleteUrl, upgradeUrl } from './links.js';

// ---------------------------------------------------------------------------
// Validation (same idea as arling-asistent/worker/src/tenants.js: isPrivateHost
// keeps this worker from ever being pointed at localhost/RFC1918/link-local
// addresses on the homelab's own network)
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class ValidationError extends Error {
  constructor(issues) {
    super(`invalid input: ${issues.join('; ')}`);
    this.issues = issues;
  }
}

/** True for hostnames this worker can never fetch from the public internet: localhost, loopback, RFC 1918 ranges, link-local, .local/.internal names. */
export function isPrivateHost(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.lan') || h.endsWith('.home')) return true;
  if (h === '::1' || h === '0.0.0.0' || h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd')) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

export function validateMonitorInput({ feedUrl, email } = {}) {
  const issues = [];

  let feedUrlObj = null;
  try {
    feedUrlObj = new URL(String(feedUrl || '').trim());
  } catch (e) {
    issues.push('feed_url is missing or not a valid URL');
  }
  if (feedUrlObj && !/^https?:$/.test(feedUrlObj.protocol)) {
    issues.push('feed_url must be http or https');
  }
  if (feedUrlObj && isPrivateHost(feedUrlObj.hostname)) {
    issues.push('feed_url must be publicly reachable (localhost and private network addresses cannot be fetched)');
  }

  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) {
    issues.push('email is missing or not a valid address');
  }

  if (issues.length > 0) throw new ValidationError(issues);

  return { feedUrl: String(feedUrl).trim(), email: cleanEmail };
}

// ---------------------------------------------------------------------------
// Rate limiting (KV, bucketed by a fixed window; same shape as
// arling-asistent/worker/src/security.js checkRateLimit, generalised with a
// `prefix` so the same helper covers per-IP signup limiting and
// per-monitor manual-check limiting)
// ---------------------------------------------------------------------------

function rateLimitKey(prefix, id, windowSeconds, now) {
  const bucket = Math.floor(now / (windowSeconds * 1000));
  return `rl:${prefix}:${id}:${bucket}`;
}

/**
 * Never throws: a KV outage fails OPEN (the request is allowed through)
 * rather than turning into a 500 for the visitor, same policy as
 * arling-asistent's rate limiter.
 */
export async function checkRateLimit(kv, prefix, id, { limit, windowSeconds = 3600, now = Date.now() } = {}) {
  const safeId = id || 'unknown';
  const key = rateLimitKey(prefix, safeId, windowSeconds, now);
  try {
    const current = parseInt((await kv.get(key)) || '0', 10);
    if (current >= limit) return { allowed: false };
    await kv.put(key, String(current + 1), { expirationTtl: windowSeconds * 2 });
    return { allowed: true };
  } catch (err) {
    console.warn('[feed-monitor] rate limit KV error, failing open:', (err && err.message) || err);
    return { allowed: true, failedOpen: true };
  }
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
}

// ---------------------------------------------------------------------------
// CORS (arling.sk pages call this API cross-origin: the signup box on
// feed-doctor/index.html, and the manage page at feed-doctor/monitor/)
// ---------------------------------------------------------------------------

function parseAllowedOrigins(envValue) {
  return String(envValue || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin, allowedDomains) {
  let hostname = '';
  try {
    hostname = new URL(origin).hostname.toLowerCase();
  } catch (e) {
    return false;
  }
  return allowedDomains.some((domain) => hostname === domain || hostname === `www.${domain}` || hostname.endsWith(`.${domain}`));
}

function corsFor(request, env) {
  const origin = request.headers.get('Origin') || '';
  if (!origin) return {};
  const allowed = parseAllowedOrigins(env.ALLOWED_ORIGINS || 'arling.sk');
  if (!isOriginAllowed(origin, allowed)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json', ...headers } });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleCreateMonitor(request, env, ctx) {
  const headers = corsFor(request, env);

  let body;
  try {
    body = JSON.parse((await request.text()) || '{}');
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, headers);
  }

  // Validation runs before the rate limit on purpose: a typo in the e-mail or a
  // private feed host should say what is wrong instead of eating one of the five
  // hourly signups. Only a request that would actually create a row is counted.
  const { feedUrl, email } = validateMonitorInput({ feedUrl: body && body.feed_url, email: body && body.email });

  // The admin token (used by our own verification runs) skips the per-IP limit.
  const isAdmin = Boolean(env.ADMIN_TOKEN) && (request.headers.get('X-Admin-Token') || '') === env.ADMIN_TOKEN;
  if (!isAdmin) {
    const rate = await checkRateLimit(env.FEEDMONITOR_RATE_LIMIT, 'signup', clientIp(request), { limit: 5, windowSeconds: 3600 });
    if (!rate.allowed) return jsonResponse({ error: 'rate_limited' }, 429, headers);
  }

  const existing = await getMonitorByEmail(env.DB, email);
  if (existing) {
    return jsonResponse({ error: 'duplicate_email', message: 'This e-mail already has a monitor. Manage it from the confirmation e-mail you got, or the manage link, instead of creating a new one.' }, 409, headers);
  }

  let monitor;
  try {
    monitor = await createMonitor(env.DB, { feedUrl, email });
  } catch (err) {
    if (err instanceof DuplicateMonitorError) {
      return jsonResponse({ error: 'duplicate_email', message: 'This e-mail already has a monitor.' }, 409, headers);
    }
    throw err;
  }

  const { subject, text, html } = confirmationEmail({ feedUrl, confirmUrl: confirmUrl(env, monitor.id, monitor.confirm_token, request) });
  const sendConfirmation = sendMail(env, { to: email, subject, text, html }).catch(() => ({ ok: false }));
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(sendConfirmation);
  } else {
    await sendConfirmation;
  }

  return jsonResponse({ id: monitor.id, status: monitor.status }, 201, headers);
}

async function handleConfirm(request, env, ctx, url) {
  const id = url.searchParams.get('id') || '';
  const token = url.searchParams.get('token') || '';
  const monitor = await getMonitorById(env.DB, id);
  if (!monitor) return jsonResponse({ error: 'not_found' }, 404, corsFor(request, env));

  const alreadyActive = monitor.status === STATUS.ACTIVE && monitor.email_confirmed === 1;
  if (!alreadyActive) {
    if (!token || monitor.confirm_token !== token) {
      return jsonResponse({ error: 'invalid_token' }, 400, corsFor(request, env));
    }
    const changed = await confirmMonitor(env.DB, id, token);
    if (!changed) return jsonResponse({ error: 'invalid_token' }, 400, corsFor(request, env));

    const confirmed = { ...monitor, status: STATUS.ACTIVE, email_confirmed: 1 };
    const runFirstCheck = runCheckForMonitor(env, confirmed).catch((err) => {
      console.warn('[feed-monitor] first check after confirm failed:', (err && err.message) || err);
    });
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(runFirstCheck);
    } else {
      await runFirstCheck;
    }
  }

  return Response.redirect(manageUrl(id, monitor.manage_key), 302);
}

async function handleGetStatus(request, env, id) {
  const headers = corsFor(request, env);
  const key = new URL(request.url).searchParams.get('key') || '';
  const monitor = await getMonitorById(env.DB, id);
  if (!monitor || !key || monitor.manage_key !== key) {
    return jsonResponse({ error: 'not_found' }, 404, headers);
  }

  const latest = await getLatestCheck(env.DB, id);
  const recent = await listRecentChecks(env.DB, id, 90);
  const history = recent.map(historyEntry).reverse(); // oldest -> newest, for a left-to-right sparkline

  const body = {
    id: monitor.id,
    feed_url: monitor.feed_url,
    email_masked: maskEmail(monitor.email),
    plan: monitor.plan,
    status: monitor.status,
    created_at: monitor.created_at,
    last_check_at: monitor.last_check_at,
    last_score: latest ? latest.score : null,
    last_counts: { error: latest ? latest.errors : 0, warning: latest ? latest.warnings : 0, info: latest ? latest.infos : 0 },
    last_top_issues: latest ? parseTopIssues(latest.top_issues_json) : [],
    history,
    next_check_at: monitor.next_check_at,
    upgrade_url: upgradeUrl(env, monitor.id),
  };
  return jsonResponse(body, 200, headers);
}

async function handleManualCheck(request, env, id) {
  const headers = corsFor(request, env);
  const key = new URL(request.url).searchParams.get('key') || '';
  const monitor = await getMonitorById(env.DB, id);
  if (!monitor || !key || monitor.manage_key !== key) {
    return jsonResponse({ error: 'not_found' }, 404, headers);
  }
  if (monitor.plan !== PLANS.PRO) {
    return jsonResponse({ error: 'pro_required', message: 'Checking on demand is a Pro feature. Free monitors are checked automatically once a week.' }, 402, headers);
  }

  const rate = await checkRateLimit(env.FEEDMONITOR_RATE_LIMIT, 'manualcheck', id, { limit: 1, windowSeconds: 3600 });
  if (!rate.allowed) return jsonResponse({ error: 'rate_limited', message: 'One check per hour, please try again shortly.' }, 429, headers);

  const result = await runCheckForMonitor(env, monitor);
  await markManualCheck(env.DB, id);
  return jsonResponse({ ok: true, status: result.status, score: result.score }, 200, headers);
}

async function handleDelete(request, env, id) {
  const headers = corsFor(request, env);
  const key = new URL(request.url).searchParams.get('key') || '';
  const monitor = await getMonitorById(env.DB, id);
  if (!monitor || !key || monitor.manage_key !== key) {
    return jsonResponse({ error: 'not_found' }, 404, headers);
  }
  await deleteMonitor(env.DB, id);
  return jsonResponse({ ok: true, message: 'Monitor deleted. You will not get any more e-mails about this feed.' }, 200, headers);
}

const VALID_PLANS = new Set([PLANS.FREE, PLANS.PRO]);

/**
 * Admin-only: sets a monitor's plan/billing metadata. This is what
 * licence-service's Stripe webhook calls after a Feed Doctor Monitor Pro
 * checkout or cancellation (client_reference_id on the Payment Link is this
 * monitor's id). Same shared-secret pattern as arling-asistent's
 * PATCH /v1/tenants/:id/plan: without ADMIN_TOKEN configured, every request
 * is refused rather than silently allowed through.
 */
async function handleSetPlan(request, env, id) {
  const headers = corsFor(request, env);
  const providedToken = request.headers.get('X-Admin-Token') || '';
  if (!env.ADMIN_TOKEN || providedToken !== env.ADMIN_TOKEN) {
    return jsonResponse({ error: 'unauthorized' }, 401, headers);
  }

  let body;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch (e) {
    return jsonResponse({ error: 'invalid_json' }, 400, headers);
  }

  const plan = body && body.plan;
  if (!VALID_PLANS.has(plan)) {
    return jsonResponse({ error: 'validation_failed', issues: ['plan must be one of free, pro'] }, 400, headers);
  }

  const monitor = await getMonitorById(env.DB, id);
  if (!monitor) return jsonResponse({ error: 'not_found' }, 404, headers);

  await setPlan(env.DB, id, { plan, billingRef: (body && body.billing_ref) || null, validUntil: (body && body.valid_until) || null });
  return jsonResponse({ ok: true, id, plan }, 200, headers);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      const headers = corsFor(request, env);
      return new Response(null, { status: Object.keys(headers).length ? 204 : 403, headers });
    }

    try {
      if (url.pathname === '/health') {
        return jsonResponse({ status: 'ok', service: 'feed-monitor' }, 200, corsFor(request, env));
      }

      if (url.pathname === '/v1/monitors' && method === 'POST') {
        return await handleCreateMonitor(request, env, ctx);
      }

      if (url.pathname === '/v1/monitors/confirm' && method === 'GET') {
        return await handleConfirm(request, env, ctx, url);
      }

      const planMatch = url.pathname.match(/^\/v1\/monitors\/([^/]+)\/plan$/);
      if (planMatch && (method === 'PATCH' || method === 'POST')) {
        return await handleSetPlan(request, env, planMatch[1]);
      }

      const checkMatch = url.pathname.match(/^\/v1\/monitors\/([^/]+)\/check$/);
      if (checkMatch && method === 'POST') {
        return await handleManualCheck(request, env, checkMatch[1]);
      }

      const deleteLinkMatch = url.pathname.match(/^\/v1\/monitors\/([^/]+)\/delete$/);
      if (deleteLinkMatch && method === 'GET') {
        return await handleDelete(request, env, deleteLinkMatch[1]);
      }

      const idMatch = url.pathname.match(/^\/v1\/monitors\/([^/]+)$/);
      if (idMatch && method === 'GET') {
        return await handleGetStatus(request, env, idMatch[1]);
      }
      if (idMatch && method === 'DELETE') {
        return await handleDelete(request, env, idMatch[1]);
      }

      return jsonResponse({ error: 'not_found' }, 404, corsFor(request, env));
    } catch (err) {
      if (err instanceof ValidationError) {
        return jsonResponse({ error: 'validation_failed', issues: err.issues }, 400, corsFor(request, env));
      }
      console.error('[feed-monitor] internal error:', (err && err.stack) || err);
      return jsonResponse({ error: 'internal_error' }, 500, corsFor(request, env));
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshDueMonitors(env));
  },
};
