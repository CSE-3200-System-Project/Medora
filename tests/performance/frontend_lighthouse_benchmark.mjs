/**
 * Collect Lighthouse measurements for the three public routes and summarise them.
 *
 * This exists because `lhci autorun` does not complete on Windows: chrome-launcher
 * raises EPERM removing its temporary Chrome profile under %TEMP%, which kills the
 * Node process and aborts the run before anything is collected. The crash happens
 * strictly after the report file is written, so each run is spawned on its own and
 * judged by whether its report file appeared, not by the exit code.
 *
 * It also reports medians per route and form factor rather than one mean across
 * everything, so a slow route cannot be hidden by two fast ones.
 *
 * Nothing is uploaded. The committed lighthouserc files upload to
 * `temporary-public-storage`, which publishes the report and its screenshots to a
 * public URL; this script writes to the local filesystem only.
 *
 *   # requires a production build and `next start` already listening
 *   CHROME_PATH=/path/to/chrome node tests/performance/frontend_lighthouse_benchmark.mjs
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");

const baseUrl = (process.env.MEDORA_FRONTEND_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const runsPerUrl = Number(process.env.MEDORA_LIGHTHOUSE_RUNS ?? 3);
const outputDir = path.resolve(
  repoRoot,
  process.env.MEDORA_LIGHTHOUSE_OUT ?? "tests/benchmarks/reports/current/lighthouse",
);
const lighthouseCli = path.resolve(repoRoot, "frontend/node_modules/lighthouse/cli/index.js");

const ROUTES = { root: "/", login: "/login", selection: "/selection" };
const FORM_FACTORS = { mobile: "perf", desktop: "desktop" };
const METRICS = {
  lcp_ms: "largest-contentful-paint",
  fcp_ms: "first-contentful-paint",
  cls: "cumulative-layout-shift",
  tbt_ms: "total-blocking-time",
  speed_index_ms: "speed-index",
  server_response_ms: "server-response-time",
};

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function collect(formFactor, routeName, run) {
  const target = path.join(outputDir, `${formFactor}_${routeName}_${run}.json`);
  // Resume rather than re-measure, so an interrupted sweep does not discard the runs
  // it already paid for. Set MEDORA_LIGHTHOUSE_FORCE=1 for a clean re-collection.
  if (process.env.MEDORA_LIGHTHOUSE_FORCE !== "1" && fs.existsSync(target) && fs.statSync(target).size > 0) {
    return JSON.parse(fs.readFileSync(target, "utf-8"));
  }
  spawnSync(
    process.execPath,
    [
      lighthouseCli,
      `${baseUrl}${ROUTES[routeName]}`,
      `--preset=${FORM_FACTORS[formFactor]}`,
      "--only-categories=performance",
      "--output=json",
      `--output-path=${target}`,
      "--chrome-flags=--headless=new --no-sandbox --disable-gpu",
      "--quiet",
    ],
    { stdio: "ignore" },
  );
  // Deliberately ignoring the exit code: see the EPERM note above.
  if (!fs.existsSync(target) || fs.statSync(target).size === 0) {
    throw new Error(`Lighthouse produced no report for ${formFactor} ${routeName} run ${run}`);
  }
  return JSON.parse(fs.readFileSync(target, "utf-8"));
}

function summarise(reports) {
  const summary = { runs: reports.length, performance_score: median(reports.map((r) => r.categories.performance.score)) };
  for (const [key, audit] of Object.entries(METRICS)) {
    summary[key] = median(reports.map((r) => r.audits[audit]?.numericValue).filter((v) => typeof v === "number"));
  }
  return summary;
}

if (!fs.existsSync(lighthouseCli)) {
  console.error(`Lighthouse CLI not found at ${lighthouseCli}. Run \`npm ci\` in frontend/ first.`);
  process.exit(1);
}
fs.mkdirSync(outputDir, { recursive: true });

const results = {};
let chromeVersion = null;
let lighthouseVersion = null;

for (const formFactor of Object.keys(FORM_FACTORS)) {
  results[formFactor] = {};
  for (const routeName of Object.keys(ROUTES)) {
    const reports = [];
    for (let run = 1; run <= runsPerUrl; run += 1) {
      const report = collect(formFactor, routeName, run);
      chromeVersion ??= report.environment?.hostUserAgent ?? null;
      lighthouseVersion ??= report.lighthouseVersion ?? null;
      reports.push(report);
      console.log(`${formFactor} ${routeName} run ${run}: score ${report.categories.performance.score}`);
    }
    results[formFactor][routeName] = summarise(reports);
  }
}

const reportPath = path.resolve(repoRoot, "tests/benchmarks/reports/current/frontend_lighthouse_results.json");
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      base_url: baseUrl,
      runs_per_url: runsPerUrl,
      statistic: "median across runs, per route and form factor",
      lighthouse_version: lighthouseVersion,
      host_user_agent: chromeVersion,
      throttling: "Lighthouse simulated throttling; mobile uses the default mobile emulation, desktop uses the desktop preset",
      results,
    },
    null,
    2,
  ),
);
console.log(`Wrote ${path.relative(repoRoot, reportPath)}`);
