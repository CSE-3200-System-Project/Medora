/* eslint-disable no-console */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { performance } = require("node:perf_hooks");

const frontendBase = (process.env.QA_BASE_URL || "https://medorahealth.vercel.app").replace(/\/$/, "");
const backendBase = (
  process.env.QA_BACKEND_URL ||
  "https://medora-backend.agreeablebush-6bac3035.eastus.azurecontainerapps.io"
).replace(/\/$/, "");
const role = (process.env.QA_ROLE || "").toLowerCase();
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const iterations = Number(process.env.QA_API_ITERATIONS || 5);
const outputRoot =
  process.env.QA_OUTPUT_DIR || path.join(process.env.TEMP || process.cwd(), "medora-deployed-qa-results");

if (!["patient", "doctor"].includes(role) || !email || !password) {
  throw new Error("Set QA_ROLE to patient/doctor and provide QA_EMAIL and QA_PASSWORD.");
}

function loadPublicFrontendEnv() {
  const envText = fs.readFileSync(path.resolve("frontend/.env"), "utf8");
  const env = {};
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]);
}

const endpoints = {
  patient: [
    "/auth/me",
    "/patient/dashboard",
    "/appointment/my-appointments",
    "/appointment/patient/calendar/summary",
    "/appointment/upcoming?limit=3",
    "/profile/patient/profile",
    "/notifications/?limit=20",
    "/notifications/unread-count",
    "/reminders/",
    "/medical-reports?limit=20&offset=0",
    "/patient-access/my-access-history",
    "/patient-access/my-ai-access-history",
    "/patient-access/my-doctor-access",
    "/consultation/patient/prescriptions",
    "/health-metrics/trends",
  ],
  doctor: [
    "/auth/me",
    "/appointment/stats",
    "/appointment/my-appointments",
    "/appointment/doctor/patients",
    "/appointment/upcoming?limit=3",
    "/profile/doctor/profile",
    "/profile/doctor/schedule",
    "/notifications/?limit=20",
    "/notifications/unread-count",
    "/consultation/doctor/active",
    "/consultation/doctor/history",
    "/health-data/doctor/patients-with-consent",
  ],
};

async function timedFetch(url, options) {
  const started = performance.now();
  const response = await fetch(url, options);
  const body = await response.arrayBuffer();
  return {
    status: response.status,
    durationMs: Math.round(performance.now() - started),
    bytes: body.byteLength,
    contentType: response.headers.get("content-type") || "",
  };
}

async function main() {
  const frontendEnv = loadPublicFrontendEnv();
  const supabaseUrl = frontendEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = frontendEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) throw new Error("Missing public Supabase frontend configuration.");

  const authStarted = performance.now();
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const authPayload = await authResponse.json();
  const authMs = Math.round(performance.now() - authStarted);
  const token = authPayload.access_token;
  if (!authResponse.ok || !token) {
    throw new Error(`Supabase authentication failed with status ${authResponse.status}.`);
  }

  const results = [];
  for (const endpoint of endpoints[role]) {
    const samples = [];
    for (let index = 0; index < iterations; index += 1) {
      samples.push(
        await timedFetch(`${backendBase}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      );
    }
    const durations = samples.map((sample) => sample.durationMs);
    results.push({
      endpoint,
      statuses: [...new Set(samples.map((sample) => sample.status))],
      bytes: samples[samples.length - 1].bytes,
      latencyMs: {
        min: Math.min(...durations),
        p50: percentile(durations, 0.5),
        p95: percentile(durations, 0.95),
        max: Math.max(...durations),
      },
    });
  }

  const healthSamples = [];
  for (let index = 0; index < iterations; index += 1) {
    healthSamples.push(await timedFetch(`${backendBase}/health`));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    deployedCommit: process.env.QA_DEPLOYED_COMMIT || null,
    frontendBase,
    backendBase,
    role,
    iterations,
    authentication: { status: authResponse.status, durationMs: authMs },
    health: healthSamples,
    endpoints: results,
  };
  const roleRoot = path.join(outputRoot, role);
  fs.mkdirSync(roleRoot, { recursive: true });
  fs.writeFileSync(path.join(roleRoot, "api-report.json"), JSON.stringify(report, null, 2));

  console.log(
    JSON.stringify(
      {
        role,
        authentication: report.authentication,
        endpoints: results,
        healthMs: healthSamples.map((sample) => sample.durationMs),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
