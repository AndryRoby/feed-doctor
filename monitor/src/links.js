/*
 * links.js
 *
 * Every URL this worker hands back to a person or puts in an e-mail:
 *   - the manage page (a static page on arling.sk, not this worker)
 *   - this worker's own confirm/delete routes, which need an absolute URL
 *     because they are clicked from an e-mail client, not called from a
 *     page already on this origin.
 *
 * This worker's own origin is derived from the incoming request when one is
 * available (every HTTP route); the cron and the ctx.waitUntil() background
 * check kicked off by the confirm route have no request to read, so they
 * fall back to the WORKER_BASE_URL var (set once, right after the first
 * `wrangler deploy`, to this worker's own workers.dev URL).
 */

export const MANAGE_BASE_URL = 'https://arling.sk/feed-doctor/monitor/';

export function manageUrl(id, key, extraParams = {}) {
  const url = new URL(MANAGE_BASE_URL);
  url.searchParams.set('id', id);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(extraParams)) url.searchParams.set(k, v);
  return url.toString();
}

/** This worker's own origin: the request that is being handled, if any, otherwise the configured fallback. */
export function workerOrigin(env, request) {
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch (e) {
      // fall through to the configured fallback
    }
  }
  return env.WORKER_BASE_URL || '';
}

export function confirmUrl(env, id, token, request) {
  const origin = workerOrigin(env, request);
  return `${origin}/v1/monitors/confirm?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
}

export function deleteUrl(env, id, key, request) {
  const origin = workerOrigin(env, request);
  return `${origin}/v1/monitors/${encodeURIComponent(id)}/delete?key=${encodeURIComponent(key)}`;
}

export function upgradeUrl(env, id) {
  if (!env.STRIPE_LINK) return '';
  const url = new URL(env.STRIPE_LINK);
  url.searchParams.set('client_reference_id', id);
  return url.toString();
}
