import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const resolveFromRoot = (value) => (path.isAbsolute(value) ? value : path.resolve(repoRoot, value));

const baselinePath = resolveFromRoot(
  process.env.MEDORA_WEB_VITALS_BASELINE ?? "tests/benchmarks/baselines/web_vitals_baseline.json",
);
const reportsDir = resolveFromRoot(
  process.env.MEDORA_LHCI_REPORTS_DIR ?? "frontend/.lighthouseci",
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function avg(values) {
  if (!values.length) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function collectMetrics() {
  const resultPaths = fs
    .readdirSync(reportsDir)
    .filter((name) => /^lhr-\d+\.json$/.test(name))
    .map((name) => path.join(reportsDir, name));
  if (!resultPaths.length) {
    throw new Error(`No Lighthouse JSON reports found in ${reportsDir}`);
  }
  const results = resultPaths.map(readJson);
  const metrics = {
    performance_score: avg(results.map((r) => r.categories.performance.score ?? 0)),
    lcp: avg(results.map((r) => r.audits["largest-contentful-paint"]?.numericValue ?? 0)),
    cls: avg(results.map((r) => r.audits["cumulative-layout-shift"]?.numericValue ?? 0)),
    ttfb: avg(results.map((r) => r.audits["server-response-time"]?.numericValue ?? 0)),
  };
  return metrics;
}

function regressionExceeded(baseline, current) {
  const violations = [];

  if (current.performance_score < baseline.performance_score - 0.1) {
    violations.push(`performance_score dropped from ${baseline.performance_score} to ${current.performance_score}`);
  }
  ["lcp", "cls", "ttfb"].forEach((k) => {
    const r = (current[k] - baseline[k]) / Math.max(1, baseline[k]);
    if (r > 0.2) {
      violations.push(`${k} regressed by ${(r * 100).toFixed(2)}%`);
    }
  });

  return violations;
}

if (!fs.existsSync(reportsDir)) {
  console.error(`Lighthouse reports directory not found at ${reportsDir}`);
  process.exit(1);
}

const current = collectMetrics();
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
