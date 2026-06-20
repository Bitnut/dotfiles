#!/usr/bin/env node
/**
 * DNS resolution monitor for test/staging environments (Docker / K8s friendly).
 *
 * Periodically runs dns.lookup() (same path as most HTTP clients) against
 * configured hostnames and prints aggregate statistics to stdout.
 *
 * Environment variables:
 *   DNS_MONITOR_HOSTS       Comma-separated hostnames (default: PayPal sandbox + Adyen test)
 *   DNS_MONITOR_INTERVAL_MS Delay between probe rounds (default: 5000)
 *   DNS_MONITOR_REPORT_MS   How often to print the stats table (default: 30000)
 *   DNS_MONITOR_FAMILY      0 = IPv4+IPv6, 4 = IPv4 only, 6 = IPv6 only (default: 0)
 *   DNS_MONITOR_VERBOSE     Set to "1" to log every probe result on one line
 *
 * Docker:
 *   docker run --rm -it node:22-alpine sh -c "wget -qO- https://raw.../dns-resolve-monitor.mjs | node"
 *   Or copy this file into an image and: node /app/dns-resolve-monitor.mjs
 *
 * Kubernetes:
 *   Use as a Job/CronJob sidecar or a tiny Deployment; ensure SIGTERM stops cleanly (preStop optional).
 */

import dns from 'node:dns/promises';
import { performance } from 'node:perf_hooks';

/**
 * @param {string | undefined} raw
 * @param {number} fallback
 * @param {number} min
 */
function parsePositiveMs(raw, fallback, min) {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(min, n);
}

const hosts = (process.env.DNS_MONITOR_HOSTS ??
  'api-m.sandbox.paypal.com,checkout-test.adyen.com')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const intervalMs = parsePositiveMs(process.env.DNS_MONITOR_INTERVAL_MS, 5000, 100);
const reportEveryMs = parsePositiveMs(process.env.DNS_MONITOR_REPORT_MS, 30000, 1000);
const familyRaw = Number(process.env.DNS_MONITOR_FAMILY ?? 0);
const family = [0, 4, 6].includes(familyRaw) ? familyRaw : 0;
const verbose = process.env.DNS_MONITOR_VERBOSE === '1';

/** Rounds skipped because the previous round had not finished (avoid corrupt stats). */
let skippedRounds = 0;
let roundInFlight = false;

if (hosts.length === 0) {
  console.error('DNS_MONITOR_HOSTS must list at least one hostname.');
  process.exit(1);
}

/** @typedef {{ host: string, rounds: number, ok: number, fail: number, eaiAgain: number, codes: Map<string, number>, latSumMs: number, latMaxMs: number, latMinMs: number, lastError?: string, lastOkAt?: number, lastFailAt?: number, consecutiveFail: number, maxConsecutiveFail: number }} HostStats */

/** @type {Map<string, HostStats>} */
const byHost = new Map();

function statFor(host) {
  let s = byHost.get(host);
  if (!s) {
    s = {
      host,
      rounds: 0,
      ok: 0,
      fail: 0,
      eaiAgain: 0,
      codes: new Map(),
      latSumMs: 0,
      latMaxMs: 0,
      latMinMs: Number.POSITIVE_INFINITY,
      consecutiveFail: 0,
      maxConsecutiveFail: 0,
    };
    byHost.set(host, s);
  }
  return s;
}

function bumpCode(s, code) {
  const k = code || 'UNKNOWN';
  s.codes.set(k, (s.codes.get(k) ?? 0) + 1);
}

/**
 * @param {string} host
 * @returns {Promise<void>}
 */
async function probe(host) {
  const s = statFor(host);
  s.rounds += 1;
  const t0 = performance.now();
  try {
    const r = await dns.lookup(host, { family, verbatim: true });
    const ms = performance.now() - t0;
    s.ok += 1;
    s.latSumMs += ms;
    s.latMaxMs = Math.max(s.latMaxMs, ms);
    s.latMinMs = Math.min(s.latMinMs, ms);
    s.lastOkAt = Date.now();
    s.consecutiveFail = 0;
    if (verbose) {
      console.log(
        `[ok] ${host} -> ${r.address} (${r.family === 6 ? 'IPv6' : 'IPv4'}) ${ms.toFixed(1)}ms`,
      );
    }
  } catch (err) {
    const ms = performance.now() - t0;
    const code = /** @type {NodeJS.ErrnoException} */ (err).code ?? err?.name ?? 'ERROR';
    s.fail += 1;
    bumpCode(s, String(code));
    if (code === 'EAI_AGAIN') s.eaiAgain += 1;
    s.lastError = `${code}: ${err?.message ?? err}`;
    s.lastFailAt = Date.now();
    s.consecutiveFail += 1;
    s.maxConsecutiveFail = Math.max(s.maxConsecutiveFail, s.consecutiveFail);
    if (verbose) {
      console.log(`[fail] ${host} ${code} ${ms.toFixed(1)}ms — ${err?.message ?? err}`);
    }
  }
}

function formatCodes(codes) {
  if (codes.size === 0) return '—';
  return [...codes.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => `${c}:${n}`)
    .join(' ');
}

function printReport() {
  const now = new Date().toISOString();
  console.log(`\n======== DNS monitor @ ${now} ========`);
  if (skippedRounds > 0) {
    console.log(
      `(skipped ${skippedRounds} probe tick(s): previous round still in flight — raise DNS_MONITOR_INTERVAL_MS or check DNS slowness)`,
    );
  }
  console.log(
    'host | rounds | ok% | fail | EAI_AGAIN | avgOkMs | min-max ms | maxStreakFail | error codes',
  );
  for (const host of hosts) {
    const s = statFor(host);
    const okPct = s.rounds ? ((100 * s.ok) / s.rounds).toFixed(1) : '0.0';
    const avgOk = s.ok ? (s.latSumMs / s.ok).toFixed(1) : '—';
    const minMax =
      s.ok && Number.isFinite(s.latMinMs)
        ? `${s.latMinMs.toFixed(1)}-${s.latMaxMs.toFixed(1)}`
        : '—';
    console.log(
      [
        s.host,
        String(s.rounds),
        okPct,
        String(s.fail),
        String(s.eaiAgain),
        avgOk,
        minMax,
        String(s.maxConsecutiveFail),
        formatCodes(s.codes),
      ].join(' | '),
    );
    if (s.lastError && s.fail > 0) {
      console.log(`  last error: ${s.lastError}`);
    }
  }
  console.log('=====================================\n');
}

async function runRound() {
  await Promise.all(hosts.map((h) => probe(h)));
}

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(probeTimer);
  clearInterval(reportTimer);
  console.error(`\nReceived ${signal}, flushing final report…`);
  printReport();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

if (familyRaw !== family) {
  console.error(
    `dns-resolve-monitor: DNS_MONITOR_FAMILY=${JSON.stringify(process.env.DNS_MONITOR_FAMILY)} invalid; using 0 (allowed: 0, 4, 6)`,
  );
}

console.log(
  `dns-resolve-monitor: hosts=${hosts.join(', ')} interval=${intervalMs}ms report=${reportEveryMs}ms family=${family}`,
);

await runRound();
printReport();

const probeTimer = setInterval(() => {
  if (roundInFlight) {
    skippedRounds += 1;
    return;
  }
  roundInFlight = true;
  runRound()
    .catch((e) => console.error('probe round error:', e))
    .finally(() => {
      roundInFlight = false;
    });
}, intervalMs);

const reportTimer = setInterval(() => {
  printReport();
}, reportEveryMs);

