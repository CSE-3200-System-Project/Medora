/* eslint-disable no-console */
"use strict";

const { chromium } = require("playwright");

const baseURL = (process.env.QA_BASE_URL || "https://medorahealth.vercel.app").replace(/\/$/, "");
const role = String(process.env.QA_ROLE || "").toLowerCase();
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const chromePath =
  process.env.QA_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
let browser;
let page;
let stage = "launch";
let searchResponse;

if (!["patient", "doctor"].includes(role) || !email || !password) {
  throw new Error("Set QA_ROLE and its QA_EMAIL/QA_PASSWORD credentials.");
}

async function main() {
  browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  const started = Date.now();
  const errors = [];
  page.on("response", (response) => {
    if (response.status() >= 400) {
      errors.push({ status: response.status(), url: response.url().replace(/\?.*$/, "") });
    }
  });

  stage = "login page";
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel(/Email Address|Email/i).fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /Sign In|Log In/i }).click();
  stage = "login redirect";
  await page.waitForURL((url) => url.pathname === `/${role}/home`, { timeout: 90_000 });
  const loginMs = Date.now() - started;

  const featureStarted = Date.now();
  if (role === "doctor") {
    stage = "doctor schedule heading";
    await page.goto(`${baseURL}/doctor/schedule`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.getByText("Schedule Settings", { exact: false }).waitFor({
      state: "visible",
      timeout: 45_000,
    });
    if (await page.getByText(/Unable to load doctor profile/i).isVisible().catch(() => false)) {
      throw new Error("Doctor schedule still reports an unavailable profile.");
    }
    stage = "doctor schedule content";
    await page.getByText(/Weekly|Availability/i).first().waitFor({
      state: "visible",
      timeout: 45_000,
    });
  } else {
    stage = "find-doctor heading";
    await page.goto(`${baseURL}/patient/find-doctor`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.getByText("Find Your Doctor", { exact: false }).first().waitFor({
      state: "visible",
      timeout: 45_000,
    });
    await page.getByPlaceholder(/Search by doctor name/i).fill("Maruf Morshed");
    const responsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname.endsWith("/doctor/search") &&
        url.searchParams.get("query") === "Maruf Morshed";
    }, { timeout: 45_000 }).catch(() => null);
    await page.getByRole("button", { name: /^Search$/i }).click();
    stage = "full-name doctor result";
    await page.getByText(/Maruf\s+Morshed/i).first().waitFor({
      state: "visible",
      timeout: 45_000,
    });
    const response = await Promise.race([
      responsePromise,
      page.waitForTimeout(1_000).then(() => null),
    ]);
    if (response) {
      const data = await response.json();
      searchResponse = {
        status: response.status(),
        total: data.total,
        resultNames: (data.doctors || []).map(
          (doctor) => `${doctor.first_name || ""} ${doctor.last_name || ""}`.trim(),
        ),
      };
    }
  }
  const featureMs = Date.now() - featureStarted;
  await browser.close();

  console.log(JSON.stringify({
    role,
    passed: true,
    loginMs,
    featureMs,
    finalPath: new URL(page.url()).pathname,
    httpErrors: errors,
  }, null, 2));
}

main().catch(async (error) => {
  await browser?.close().catch(() => {});
  console.error(JSON.stringify({
    role,
    passed: false,
    stage,
    finalPath: page ? new URL(page.url()).pathname : null,
    searchResponse,
    error: String(error?.message || error).split("\n")[0],
  }, null, 2));
  process.exitCode = 1;
});
