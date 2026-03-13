#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const nextChunksDir = path.join(repoRoot, ".next", "static", "chunks");
const budgetPath = path.join(repoRoot, "perf", "bundle-budget.json");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(nextChunksDir)) {
  fail("Missing .next/static/chunks. Run `npm run build` before bundle budget checks.");
}
if (!fs.existsSync(budgetPath)) {
  fail("Missing perf/bundle-budget.json.");
}

const budgetConfig = JSON.parse(fs.readFileSync(budgetPath, "utf8"));
const thresholdPercent = Number(budgetConfig.regressionThresholdPercent ?? 10);
const baselineMetrics = budgetConfig.metrics ?? {};

if (!Number.isFinite(thresholdPercent) || thresholdPercent < 0) {
  fail("Invalid regressionThresholdPercent in perf/bundle-budget.json.");
}
if (Object.keys(baselineMetrics).length === 0) {
  fail("Bundle budget baseline is empty. Populate perf/bundle-budget.json with metric baselines.");
}

const chunkFiles = fs
  .readdirSync(nextChunksDir)
  .filter((filename) => filename.endsWith(".js"))
  .map((filename) => {
    const fullPath = path.join(nextChunksDir, filename);
    return {
      filename,
      bytes: fs.statSync(fullPath).size,
    };
  });

if (chunkFiles.length === 0) {
  fail("No client JS chunks found in .next/static/chunks.");
}

function findChunkBytes(matchFn) {
  const match = chunkFiles.find((chunk) => matchFn(chunk.filename));
  return match ? match.bytes : 0;
}

const sortedChunks = [...chunkFiles].sort((a, b) => b.bytes - a.bytes);
const actualMetrics = {
  totalClientJsBytes: chunkFiles.reduce((sum, chunk) => sum + chunk.bytes, 0),
  largestClientChunkBytes: sortedChunks[0]?.bytes ?? 0,
  frameworkBundleBytes: findChunkBytes((filename) => filename.startsWith("framework-")),
  mainBundleBytes: findChunkBytes(
    (filename) => filename.startsWith("main-") && !filename.startsWith("main-app-"),
  ),
  mainAppBundleBytes: findChunkBytes((filename) => filename.startsWith("main-app-")),
  polyfillsBundleBytes: findChunkBytes((filename) => filename.startsWith("polyfills-")),
};

console.log("Client bundle metrics (bytes):");
for (const [metricName, metricValue] of Object.entries(actualMetrics)) {
  console.log(`  ${metricName}: ${metricValue}`);
}

const failures = [];
for (const [metricName, expectedRaw] of Object.entries(baselineMetrics)) {
  const expected = Number(expectedRaw);
  if (!Number.isFinite(expected) || expected <= 0) {
    fail(`Invalid baseline value for metric "${metricName}".`);
  }

  const actual = actualMetrics[metricName];
  if (!Number.isFinite(actual)) {
    failures.push({
      metricName,
      expected,
      actual: null,
      allowed: null,
      message: "metric missing in current measurement",
    });
    continue;
  }

  const allowed = Math.round(expected * (1 + thresholdPercent / 100));
  if (actual > allowed) {
    failures.push({
      metricName,
      expected,
      actual,
      allowed,
      message: "bundle size regression above threshold",
    });
  }
}

if (failures.length > 0) {
  console.error("\nBundle budget regressions detected:");
  for (const failure of failures) {
    console.error(
      `  ${failure.metricName}: ${failure.message} (baseline=${failure.expected}, allowed=${failure.allowed ?? "n/a"}, actual=${failure.actual ?? "missing"})`,
    );
  }
  process.exit(1);
}

console.log(`\nBundle budget check passed (threshold: ${thresholdPercent}%).`);
