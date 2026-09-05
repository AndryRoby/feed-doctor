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
| DELETE | `/v1/monitors/:id?key=` | Deletes the monitor and its checks |
| GET | `/v1/monitors/:id/delete?key=` | Same as DELETE, reachable from a plain e-mail link |
| PATCH (or POST) | `/v1/monitors/:id/plan` | Header `X-Admin-Token`. Body `{plan, billing_ref?, valid_until?}`. Called by `licence-service`'s Stripe webhook on activation/cancellation, never by anything else |
| GET | `/health` | `{"ok": true}` |

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
mocked `fetch`. Covers validation, rate limits, every route, the fetch
cap/timeout, and the alert decision logic. Run `node tests.mjs` in the
parent `products/feed-doctor` directory for the shared rule engine's own
tests (`feed-doctor.js` is imported here unchanged).

## Provisioned infra

- D1 `feedmonitor` (`bba3adc7-7457-4475-abcc-f478db01f5de`)
- KV `FEEDMONITOR_RATE_LIMIT` (`18c103da6027431088c67c730d2d074d`)
- Same Cloudflare account as `arling-asistent`.
