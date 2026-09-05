// mock-d1.mjs
// A narrow, purpose-built in-memory stand-in for Cloudflare D1, implementing
// only the exact prepared statements src/db.js issues (imported from its SQL
// export). Same approach as products/arling-asistent's mock-d1.mjs: this is
// deliberately not a general SQL engine, it pattern-matches on the known
// query strings so the worker code under test can use real SQL while the
// test mock stays small and auditable.

import { SQL } from '../../src/db.js';

export function createMockD1() {
  const monitors = new Map(); // id -> row
  let checks = []; // array of check rows, insertion order

  const clone = (row) => (row ? { ...row } : row);

  function run(sql, args) {
    switch (sql) {
      case SQL.INSERT_MONITOR: {
        const [id, email, feedUrl, manageKey, confirmToken, createdAt] = args;
        if (monitors.has(id)) {
          throw new Error('D1_ERROR: UNIQUE constraint failed: monitors.id: SQLITE_CONSTRAINT');
        }
        monitors.set(id, {
          id,
          email,
          email_confirmed: 0,
          feed_url: feedUrl,
          plan: 'free',
          status: 'pending_confirmation',
          manage_key: manageKey,
          confirm_token: confirmToken,
          billing_ref: null,
          valid_until: null,
          created_at: createdAt,
          last_check_at: null,
          next_check_at: null,
          last_manual_check_at: null,
        });
        return { success: true, meta: { changes: 1 } };
      }
      case SQL.CONFIRM_MONITOR: {
        const [id, token] = args;
        const row = monitors.get(id);
        if (row && row.confirm_token === token) {
          row.email_confirmed = 1;
          row.status = 'active';
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 0 } };
      }
      case SQL.SET_PLAN: {
        const [plan, billingRef, validUntil, id] = args;
        const row = monitors.get(id);
        if (row) {
          row.plan = plan;
          row.billing_ref = billingRef;
          row.valid_until = validUntil;
        }
        return { success: true, meta: { changes: row ? 1 : 0 } };
      }
      case SQL.SET_LAST_CHECK: {
        const [at, nextCheckAt, id] = args;
        const row = monitors.get(id);
        if (row) {
          row.last_check_at = at;
          row.next_check_at = nextCheckAt;
        }
        return { success: true, meta: { changes: row ? 1 : 0 } };
      }
      case SQL.SET_LAST_MANUAL_CHECK: {
        const [at, id] = args;
        const row = monitors.get(id);
        if (row) row.last_manual_check_at = at;
        return { success: true, meta: { changes: row ? 1 : 0 } };
      }
      case SQL.DELETE_MONITOR: {
        const [id] = args;
        const existed = monitors.delete(id);
        return { success: true, meta: { changes: existed ? 1 : 0 } };
      }
      case SQL.DELETE_CHECKS_FOR_MONITOR: {
        const [monitorId] = args;
        const before = checks.length;
        checks = checks.filter((c) => c.monitor_id !== monitorId);
        return { success: true, meta: { changes: before - checks.length } };
      }
      case SQL.INSERT_CHECK: {
        const [id, monitorId, at, status, score, errors, warnings, infos, topIssuesJson, fetchMs] = args;
        checks.push({ id, monitor_id: monitorId, at, status, score, errors, warnings, infos, top_issues_json: topIssuesJson, fetch_ms: fetchMs });
        return { success: true, meta: { changes: 1 } };
      }
      default:
        throw new Error(`mock-d1: unhandled statement in run(): ${sql}`);
    }
  }

  function first(sql, args) {
    switch (sql) {
      case SQL.GET_MONITOR_BY_ID:
        return clone(monitors.get(args[0])) || null;
      case SQL.GET_MONITOR_BY_EMAIL: {
        for (const row of monitors.values()) if (row.email === args[0]) return clone(row);
        return null;
      }
      case SQL.LATEST_CHECK_FOR_MONITOR: {
        const rows = checks.filter((c) => c.monitor_id === args[0]).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
        return rows.length ? clone(rows[0]) : null;
      }
      default:
        throw new Error(`mock-d1: unhandled statement in first(): ${sql}`);
    }
  }

  function all(sql, args) {
    switch (sql) {
      case SQL.RECENT_CHECKS_FOR_MONITOR: {
        const [monitorId, limit] = args;
        const rows = checks
          .filter((c) => c.monitor_id === monitorId)
          .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
          .slice(0, limit)
          .map(clone);
        return { results: rows };
      }
      case SQL.MONITORS_DUE_FOR_CHECK: {
        const [cutoffIso] = args;
        const rows = Array.from(monitors.values())
          .filter((m) => m.status === 'active')
          .filter((m) => m.plan === 'pro' || (m.plan === 'free' && (!m.last_check_at || m.last_check_at <= cutoffIso)))
          .map(clone);
        return { results: rows };
      }
      default:
        throw new Error(`mock-d1: unhandled statement in all(): ${sql}`);
    }
  }

  return {
    prepare(sql) {
      const statement = (args) => ({
        bind(...newArgs) {
          return statement(newArgs);
        },
        async run() {
          return run(sql, args);
        },
        async first() {
          return first(sql, args);
        },
        async all() {
          return all(sql, args);
        },
      });
      return statement([]);
    },
    _monitors: monitors,
    _checks: checks,
  };
}
