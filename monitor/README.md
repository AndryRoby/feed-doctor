# Feed Doctor Monitor (worker)

Cloudflare Worker (`feed-monitor`, D1 database `feedmonitor`) that turns a
one-time [Feed Doctor](../) check into an opt-in recurring one: a shop gives
its feed URL and e-mail, the worker fetches that feed on a schedule, runs
`feed-doctor.js`'s `analyze()` unchanged (imported straight from
`../feed-doctor.js`, no fork), stores the score and issue counts, and e-mails
an alert when something got worse. Same shape as
`products/arling-asistent/worker`: routing/validation/CORS/rate-limit in
`src/index.js`, D1 access in `src/db.js`, the fetch-analyze-alert pipeline in
`src/check.js`, e-mail content and sending in `src/mail.js`, URL helpers in
`src/links.js`.

Feed content is never stored. Only the score, per-severity counts and the
triggered rule ids go into `checks`.

Live at `https://feed-monitor.arling.workers.dev`.

## Plans

- **Free**: 1 monitor per e-mail, checked weekly (or whenever it is 6+ days
  stale, picked up by the daily cron). Alerted only when a new *error* rule
  appears or the score drops 5+ points.
- **Pro** (9 EUR/month, Stripe Payment Link below): checked daily, alerted on
  *any* change in error/warning/info counts, 90-day history on the manage
  page, manual "check now" (rate-limited 1/hour).

## Endpoints

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/v1/monitors` | Body `{feed_url, email}`. Validates a public http(s) host (`isPrivateHost`, same idea as `arling-asistent/worker/src/tenants.js`) and e-mail syntax, rejects a second monitor for the same e-mail (`409 duplicate_email`), rate-limited 5/IP/hour (KV). Creates the monitor `pending_confirmation`, sends the confirmation e-mail via the homelab mailer. Returns `201 {id, status}` |
| GET | `/v1/monitors/confirm?id=&token=` | Confirms, kicks off the first check in the background (`ctx.waitUntil`), `302` to `https://arling.sk/feed-doctor/monitor/?id=<id>&key=<manage_key>` |
| GET | `/v1/monitors/:id?key=` | Full status: `feed_url, email_masked, plan, status, last_score, last_counts, last_top_issues (up to 10), history (last 90 checks), next_check_at, upgrade_url`. Wrong key -> `404` |
| POST | `/v1/monitors/:id/check?key=` | Manual check now. `402` on the free plan (calm upgrade message), rate-limited 1/hour on Pro |
| DELETE | `/v1/monitors/:id?key=` | Deletes the monitor and its checks. On a Pro monitor whose `billing_ref` is a Stripe subscription id (`sub_...`) it first cancels that subscription, see "Delete and the Pro subscription" below |
| GET | `/v1/monitors/:id/delete?key=` | Same as DELETE, reachable from a plain e-mail link |
| PATCH (or POST) | `/v1/monitors/:id/plan` | Header `X-Admin-Token`. Body `{plan, billing_ref?, valid_until?}`. Called by `licence-service`'s Stripe webhook on activation/cancellation, never by anything else |
| GET | `/health` | `{"ok": true}` |

## Delete and the Pro subscription

Deleting a monitor must not leave a paid subscription running (audit
`ops/audit/2026-09-10/pravo-a-platby.md`, section 3). `handleDelete` in
`src/index.js` therefore does, in this order:

1. Free monitor: deleted as before, reply
   `{ok: true, message: "Monitor deleted. You will not get any more e-mails about this feed."}`.
2. Pro monitor, `billing_ref` starts with `sub_`, `STRIPE_SECRET_KEY` set:
   `DELETE https://api.stripe.com/v1/subscriptions/{billing_ref}` with
   `Authorization: Bearer <STRIPE_SECRET_KEY>` (no body). On a 2xx, or on a
   404 / `resource_missing` (already cancelled), the monitor is deleted and
   the reply is `{ok: true, subscription_cancelled: true, message: "Monitor deleted and your Pro subscription was cancelled. No further charges."}`.
   On anything else (401 bad key, 5xx, network error) the monitor is NOT
   deleted and the reply is `502 {error: "subscription_cancel_failed", message: "We could not cancel your Pro subscription automatically. Cancel it at https://billing.stripe.com/p/login/3cIaER9M63hNeFcg8B4ko00 (log in with the e-mail you paid with), then delete the monitor again."}`.
3. Pro monitor, but `STRIPE_SECRET_KEY` is not set (or `billing_ref` is a
   checkout session id `cs_...` rather than a subscription): the monitor is
   deleted and the reply is `{ok: true, subscription_cancelled: false, message: ...}`
   telling the customer to cancel the subscription in the Stripe customer
   portal at the URL above.

The secret is never logged or echoed. The customer portal URL is exported as
`STRIPE_PORTAL_URL` from `src/index.js`.

## Tables (`migrations/0001.sql`)

- `monitors(id, email, email_confirmed, feed_url, plan, status, manage_key, confirm_token, billing_ref, valid_until, created_at, last_check_at, next_check_at)`
- `checks(id, monitor_id, at, status, score, errors, warnings, infos, top_issues_json, fetch_ms)`

## Cron

Daily at 05:00 UTC (`wrangler.toml` `[triggers]`): every Pro monitor, plus
free monitors whose last check is 6+ days old. Fetches the feed (15 s
timeout, 8 MB cap, `User-Agent: ARLing Feed Doctor Monitor
(+https://arling.sk/feed-doctor/monitor/)`), runs `analyze()`, stores the
check, compares with the previous one, sends an alert e-mail per the plan
rule above. A fetch failure is stored as a `fetch_failed` check and alerts
once (not on every subsequent failed run).

Run it by hand:

```
cd products/feed-doctor/monitor
npx wrangler deploy   # picks up any code change first
npx wrangler dev --test-scheduled
# then, in another shell:
curl "http://localhost:8787/__scheduled?cron=0+5+*+*+*"
```

(`wrangler dev --test-scheduled` exposes `/__scheduled` as a manual trigger
for local testing; there is no remote equivalent, so to force a real run
against production, temporarily add a debug route or wait for 05:00 UTC.)

## Secrets and vars

Not committed. Values live in `C:/Users/User/.secrets/feed-monitor.txt`.

| Name | Kind | Purpose |
| --- | --- | --- |
| `ADMIN_TOKEN` | secret (`wrangler secret put`) | `X-Admin-Token` required on `PATCH /v1/monitors/:id/plan`. Same value as `FEEDMONITOR_ADMIN_TOKEN` in `products/licence-service`'s `.env` |
| `MAIL_TOKEN` | secret (`wrangler secret put`) | `X-Mail-Token` sent with every call to the homelab mailer (`MAIL_URL`). Same value as `MAIL_TOKEN` in `products/subscribe-service`'s `.env` |
| `STRIPE_SECRET_KEY` | secret (`wrangler secret put`) | Only used by DELETE `/v1/monitors/:id` to cancel a Pro monitor's Stripe subscription (see "Delete and the Pro subscription"). A **restricted** key from the Stripe Dashboard (Developers > API keys > Create restricted key) with only "Subscriptions: Write" is enough; keep it in `C:/Users/User/.secrets/stripe.txt`. Without it a Pro delete still works but the reply tells the customer to cancel in the portal themselves |
| `MAIL_URL` | var (`wrangler.toml`) | `https://homelab.tailbf8f27.ts.net/subscribe/api/mail` |
| `STRIPE_LINK` | var (`wrangler.toml`), also `monitor/STRIPE_LINK.txt` | Payment Link for the Pro upgrade, `client_reference_id=<monitor id>` appended per request in `src/links.js` |
| `ALLOWED_ORIGINS` | var | `arling.sk` (CORS allowlist for the signup box and manage page) |
| `WORKER_BASE_URL` | var | This worker's own `workers.dev` origin, used only when there is no incoming request to derive it from (cron, background first-check) |

## Stripe (by name, ids in `C:/Users/User/.secrets/stripe.txt`)

Product "Feed Doctor Monitor", recurring price 9.00 EUR/month, Payment Link
redirecting to `https://arling.sk/feed-doctor/monitor/?paid=1`. The
`licence-service` webhook maps this price to plan key `feed-monitor-pro` and
PATCHes this worker's `/v1/monitors/:id/plan` on `checkout.session.completed`
/ `invoice.paid` (plan `pro`) and on `customer.subscription.deleted` / expiry
(plan `free`), see `products/licence-service/README.md`.

## Tests

```
cd products/feed-doctor/monitor
node --test test/*.test.mjs
```

Mocked D1 (`test/helpers/mock-d1.mjs`) and KV (`test/helpers/mock-kv.mjs`),
mocked `fetch` (the same `env.fetchImpl` hook stubs the feed, the mailer and
Stripe). Covers validation, rate limits, every route, the fetch cap/timeout,
the alert decision logic, and every branch of the delete-cancels-subscription
flow (2xx, 404 `resource_missing`, 401/500, network error, no secret, `cs_`
fallback ref). Run `node tests.mjs` in the
parent `products/feed-doctor` directory for the shared rule engine's own
tests (`feed-doctor.js` is imported here unchanged).

## Provisioned infra

- D1 `feedmonitor` (`bba3adc7-7457-4475-abcc-f478db01f5de`)
- KV `FEEDMONITOR_RATE_LIMIT` (`18c103da6027431088c67c730d2d074d`)
- Same Cloudflare account as `arling-asistent`.
