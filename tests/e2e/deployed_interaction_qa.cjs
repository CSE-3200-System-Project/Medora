/* eslint-disable no-console */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseURL = (process.env.QA_BASE_URL || "https://medorahealth.vercel.app").replace(/\/$/, "");
const role = String(process.env.QA_ROLE || "").toLowerCase();
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const chromePath =
  process.env.QA_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const skipAi = process.env.QA_SKIP_AI === "1";
const outputRoot =
  process.env.QA_OUTPUT_DIR ||
  path.join(process.env.TEMP || process.cwd(), "medora-deployed-qa-results");
let browser;

if (!["patient", "doctor"].includes(role) || !email || !password) {
  throw new Error("Set QA_ROLE and its QA_EMAIL/QA_PASSWORD credentials.");
}

function safeMessage(error) {
  return String(error?.message || error).split("\n")[0].slice(0, 400);
}

async function main() {
  browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();
  const checks = [];
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text().slice(0, 500));
  });
  page.on("pageerror", (error) => consoleErrors.push(safeMessage(error)));

  async function check(name, action) {
    const started = Date.now();
    try {
      const detail = (await action()) || {};
      checks.push({ name, passed: true, durationMs: Date.now() - started, ...detail });
    } catch (error) {
      checks.push({
        name,
        passed: false,
        durationMs: Date.now() - started,
        error: safeMessage(error),
      });
    }
  }

  async function navigate(route, readyText, loadingText) {
    const response = await page.goto(`${baseURL}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    if (!response?.ok()) throw new Error(`Navigation returned ${response?.status() || "no response"}`);
    if (readyText) {
      await page.getByText(readyText, { exact: false }).first().waitFor({
        state: "visible",
        timeout: 35_000,
      });
    }
    if (loadingText) {
      await page.getByText(loadingText, { exact: false }).first().waitFor({
        state: "hidden",
        timeout: 35_000,
      }).catch(() => {});
    }
    return { finalPath: new URL(page.url()).pathname };
  }

  await check("sign in and reach role home", async () => {
    await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByLabel(/Email Address|Email/i).fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /Sign In|Log In/i }).click();
    await page.waitForURL(
      (url) => url.pathname === `/${role}/home`,
      { timeout: 90_000 },
    );
    return { finalPath: new URL(page.url()).pathname };
  });

  if (role === "patient") {
    await check("patient dashboard becomes usable", () =>
      navigate("/patient/home", "Overall Health Score"),
    );
    await check("find supplied doctor through UI", async () => {
      await navigate("/patient/find-doctor", "Find Your Doctor");
      const input = page.getByPlaceholder(/Search by doctor name/i);
      await input.fill("Maruf Morshed");
      const responsePromise = page.waitForResponse(
        (response) => response.url().includes("/doctor/search") && response.status() === 200,
        { timeout: 30_000 },
      );
      const searchButton = page.getByRole("button", { name: /^Search$/i });
      if (await searchButton.isVisible().catch(() => false)) await searchButton.click();
      await responsePromise;
      await page.getByText(/Maruf\s+Morshed/i).first().waitFor({ timeout: 20_000 });
      return { matchingCards: await page.getByText(/Maruf\s+Morshed/i).count() };
    });
    await check("patient medicine lookup", async () => {
      await navigate("/patient/find-medicine", "Find Medicine");
      const input = page.getByPlaceholder(/Search medicine by name or brand/i);
      await input.fill("Napa");
      const result = page.getByText(/Napa/i).first();
      await result.waitFor({ state: "visible", timeout: 30_000 });
      return { resultTextPresent: true };
    });
    await check("appointments finish loading", () =>
      navigate("/patient/appointments", "My Appointments", "Loading appointments"),
    );
    await check("medical history finishes loading", () =>
      navigate("/patient/medical-history", "Medical History", "Loading medical history"),
    );
    await check("privacy controls finish loading", () =>
      navigate("/patient/privacy", "Privacy", "Loading privacy settings"),
    );
    await check("reminders finish loading", () =>
      navigate("/patient/reminders", "My Reminders", "Loading reminders"),
    );
  } else {
    await check("doctor dashboard becomes usable", () =>
      navigate("/doctor/home", "TOTAL PATIENT POPULATION"),
    );
    await check("doctor appointments finish loading", () =>
      navigate("/doctor/appointments", "Appointments", "Loading schedule dashboard"),
    );
    await check("doctor patients finish loading", () =>
      navigate("/doctor/patients", "My Patients", "Loading patients"),
    );
    await check("doctor analytics becomes usable", () =>
      navigate("/doctor/analytics", "Advanced Analytics"),
    );
    await check("doctor medicine lookup", async () => {
      await navigate("/doctor/find-medicine", "Medicine Reference");
      const input = page.getByPlaceholder(/Search medicine by name or brand/i);
      await input.fill("Napa");
      const result = page.getByText(/Napa/i).first();
      await result.waitFor({ state: "visible", timeout: 30_000 });
      return { resultTextPresent: true };
    });
    await check("doctor schedule manager renders", async () => {
      await navigate("/doctor/schedule", "Schedule Settings");
      await page.getByText(/Unable to load doctor profile/i).waitFor({
        state: "hidden",
        timeout: 20_000,
      });
      await page.getByText(/Weekly|Availability|Schedule/i).last().waitFor({
        state: "visible",
        timeout: 20_000,
      });
    });
  }

  await check("profile finishes loading", () =>
    navigate(`/${role}/profile`, "Profile", "Loading profile"),
  );
  await check("notifications finish loading", () =>
    navigate("/notifications", "Notifications", "Loading notifications"),
  );
  await check("theme changes live and restores", async () => {
    await navigate("/settings", "Settings");
    await page.getByRole("button", { name: /^Dark$/i }).click();
    await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
    await page.getByRole("button", { name: /^Light$/i }).click();
    await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  });
  if (!skipAi) {
    await check("Chorui responds to a harmless capability prompt", async () => {
      await navigate(`/${role}/chorui-ai`, "Chorui");
      const input = page.getByPlaceholder("Type your response here...");
      const initialMessages = await page.locator("[data-message-id]").count().catch(() => 0);
      await input.fill("In one sentence, what Medora tasks can you help me with?");
      await page.getByRole("button", { name: "Send message" }).click();
      await page.getByText("Thinking...", { exact: true }).waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
      await page.getByText("Thinking...", { exact: true }).waitFor({ state: "hidden", timeout: 90_000 });
      const body = await page.locator("body").innerText();
      if (/failed to|unable to respond|try again/i.test(body.slice(-2000))) {
        throw new Error("Chorui displayed a failure state.");
      }
      return {
        initialMessageNodes: initialMessages,
        inputCleared: (await input.inputValue()) === "",
      };
    });
  }

  await browser.close();
  const report = {
    generatedAt: new Date().toISOString(),
    baseURL,
    role,
    passed: checks.filter((item) => item.passed).length,
    failed: checks.filter((item) => !item.passed).length,
    consoleErrors: [...new Set(consoleErrors)],
    checks,
  };
  const roleRoot = path.join(outputRoot, role);
  fs.mkdirSync(roleRoot, { recursive: true });
  fs.writeFileSync(
    path.join(roleRoot, "interaction-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch(async (error) => {
  await browser?.close().catch(() => {});
  console.error(error?.stack || error);
  process.exitCode = 1;
});
