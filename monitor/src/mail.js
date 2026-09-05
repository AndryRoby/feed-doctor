/*
 * mail.js
 *
 * Everything this worker sends by e-mail, and the one place that calls out
 * to the homelab mailer (products/subscribe-service/app.py, POST /api/mail,
 * see that file's module docstring for the SMTP side). Nothing here ever
 * blocks an HTTP response to the visitor: every call site wraps sendMail()
 * in ctx.waitUntil and/or a try/catch, so a mailer outage delays an alert
 * by at most one more cron run, never a 500 for the person filling in the
 * form.
 *
 * MAIL_URL/MAIL_TOKEN are not yet live as of this worker's own deploy (the
 * mailer is a separate build step against the same
 * C:/Users/User/.secrets/feed-monitor.txt); sendMail() is written to fail
 * closed and quiet either way, so signup and confirmation keep working
 * (mail just does not arrive) until the mailer side is deployed.
 */

const FROM_NOTE = 'ARLing Feed Doctor Monitor';

/**
 * POST {to, subject, text, html, unsubscribe_url} to env.MAIL_URL with the
 * X-Mail-Token header. Never throws: returns {ok: false, error} on any
 * failure (network error, non-2xx, MAIL_URL/MAIL_TOKEN not configured) so
 * callers can log and move on rather than needing their own try/catch.
 *
 * `unsubscribe_url` is not in the mailer's documented minimum body
 * ({to, subject, text, html?}) but is sent on every alert/manual-check mail
 * so the mailer can populate the List-Unsubscribe header from it once that
 * lands; an older mailer build simply ignores the extra field.
 */
export async function sendMail(env, { to, subject, text, html, unsubscribeUrl } = {}) {
  const fetchImpl = env.fetchImpl || fetch;
  if (!env.MAIL_URL || !env.MAIL_TOKEN) {
    return { ok: false, error: 'mail_not_configured' };
  }
  try {
    const body = { to, subject, text };
    if (html) body.html = html;
    if (unsubscribeUrl) body.unsubscribe_url = unsubscribeUrl;
    const res = await fetchImpl(env.MAIL_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Mail-Token': env.MAIL_TOKEN },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return { ok: false, error: `mail_send_failed_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err && err.message) || err) };
  }
}

// ---------------------------------------------------------------------------
// Message builders (pure functions: no fetch, easy to unit test)
// ---------------------------------------------------------------------------

export function confirmationEmail({ feedUrl, confirmUrl }) {
  const subject = 'Confirm your Feed Doctor Monitor';
  const text = [
    `You (or someone with your e-mail address) asked ARLing Feed Doctor Monitor to watch this feed:`,
    feedUrl,
    '',
    'Confirm your e-mail to start weekly checks, free:',
    confirmUrl,
    '',
    'We fetch only this feed URL on our server. The Feed Doctor checker in your browser stays local and untouched.',
    '',
    "If you did not ask for this, ignore this e-mail and nothing will be created.",
  ].join('\n');
  const html = `<p>You (or someone with your e-mail address) asked <strong>ARLing Feed Doctor Monitor</strong> to watch this feed:</p><p><code>${escapeHtml(feedUrl)}</code></p><p><a href="${escapeHtml(confirmUrl)}">Confirm your e-mail to start weekly checks, free</a></p><p>We fetch only this feed URL on our server. The Feed Doctor checker in your browser stays local and untouched.</p><p>If you did not ask for this, ignore this e-mail and nothing will be created.</p>`;
  return { subject, text, html };
}

/**
 * Alert e-mail for one check result. `previous` is the prior check row (or
 * null on a monitor's first-ever alert-worthy check, which should not
 * normally happen since check.js only alerts when there is a previous
 * check to compare against).
 */
export function alertEmail({ feedUrl, current, previous, manageUrl, deleteUrl, plan }) {
  if (current.status === 'fetch_failed') {
    const subject = 'Feed Doctor Monitor could not reach your feed';
    const text = [
      `We could not fetch your product feed:`,
      feedUrl,
      '',
      'This is the first time this happened since the last successful check, so this is the only alert you will get until it is fixed (or fails again after a successful check in between).',
      '',
      `Manage this monitor: ${manageUrl}`,
      `Stop these e-mails: ${deleteUrl}`,
    ].join('\n');
    return { subject, text, html: textToHtml(text) };
  }

  const scoreLine = previous && typeof previous.score === 'number' ? `Score: ${current.score} (was ${previous.score})` : `Score: ${current.score}`;
  const countsLine = `Errors: ${current.errors}, warnings: ${current.warnings}, info: ${current.infos}`;
  const newErrorRules = (current.topIssues || []).filter((i) => i.severity === 'error' && !(previous && (previous.topIssues || []).some((p) => p.rule === i.rule)));
  const lines = [`Feed Doctor Monitor checked your feed and found a change:`, feedUrl, '', scoreLine, countsLine];
  if (newErrorRules.length > 0) {
    lines.push('', 'New error rules triggered:');
    for (const rule of newErrorRules) lines.push(`- ${rule.rule} (${rule.count})`);
  }
  lines.push('', `Manage this monitor, see the full history: ${manageUrl}`);
  if (plan === 'free') {
    lines.push('Upgrade to Pro for daily checks and 90-day history.');
  }
  lines.push(`Stop these e-mails: ${deleteUrl}`);
  const text = lines.join('\n');
  return { subject: `Feed Doctor Monitor: your feed score changed to ${current.score}`, text, html: textToHtml(text) };
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function textToHtml(text) {
  return `<p>${escapeHtml(text).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

export { FROM_NOTE };
