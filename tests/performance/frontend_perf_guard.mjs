import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const resolveFromRoot = (value) => (path.isAbsolute(value) ? value : path.resolve(repoRoot, value));

const baselinePath = resolveFromRoot(
  process.env.MEDORA_WEB_VITALS_BASELINE ?? "tests/benchmarks/baselines/web_vitals_baseline.json",
);
const manifestPath = resolveFromRoot(process.env.MEDORA_LHCI_MANIFEST ?? ".lighthouseci/manifest.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function collectMetrics(manifest) {
  const manifestDir = path.dirname(manifestPath);
  const results = manifest.map((entry) => readJson(path.resolve(manifestDir, path.basename(entry.jsonPath))));
  const metrics = {
    performance_score: avg(results.map((r) => r.categories.performance.score ?? 0)),
    lcp: avg(results.map((r) => r.audits["largest-contentful-paint"]?.numericValue ?? 0)),
    inp: avg(results.map((r) => r.audits["interaction-to-next-paint"]?.numericValue ?? 0)),
    cls: avg(results.map((r) => r.audits["cumulative-layout-shift"]?.numericValue ?? 0)),
    ttfb: avg(results.map((r) => r.audits["server-response-time"]?.numericValue ?? 0)),
  };
  return metrics;
}

function regressionExceeded(baseline, current) {
  const violations = [];
  const ratio = (current - baseline) / Math.max(1, baseline);

  if (current.performance_score < baseline.performance_score - 0.1) {
    violations.push(`performance_score dropped from ${baseline.performance_score} to ${current.performance_score}`);
  }
  ["lcp", "inp", "cls", "ttfb"].forEach((k) => {
    const r = (current[k] - baseline[k]) / Math.max(1, baseline[k]);
    if (r > 0.2) {
      violations.push(`${k} regressed by ${(r * 100).toFixed(2)}%`);
    }
  });

  if (ratio > 0.2) {
    violations.push("aggregate ratio exceeded 20%");
  }

  return violations;
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Lighthouse manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = readJson(manifestPath);
const current = collectMetrics(manifest);
const baseline = readJson(baselinePath);
const violations = regressionExceeded(baseline, current);

fs.mkdirSync("tests/benchmarks/reports/current", { recursive: true });
fs.writeFileSync(
  path.resolve(repoRoot, "tests/benchmarks/reports/current/frontend_vitals_report.json"),
  JSON.stringify({ baseline, current, violations }, null, 2),
);

if (violations.length > 0) {
  console.error("Frontend performance regression detected:");
  violations.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}

console.log("Frontend performance guard passed.");
