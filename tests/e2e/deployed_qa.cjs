/* eslint-disable no-console */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseURL = (process.env.QA_BASE_URL || "https://medorahealth.vercel.app").replace(/\/$/, "");
const role = (process.env.QA_ROLE || "").toLowerCase();
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const chromePath =
  process.env.QA_CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const outputRoot =
  process.env.QA_OUTPUT_DIR || path.join(process.env.TEMP || process.cwd(), "medora-deployed-qa-results");
const axePath = require.resolve("axe-core/axe.min.js");

if (!["patient", "doctor"].includes(role) || !email || !password) {
  throw new Error("Set QA_ROLE to patient/doctor and provide QA_EMAIL and QA_PASSWORD.");
}

const routesByRole = {
  patient: [
    "/patient/home",
    "/patient/find-doctor",
    "/patient/analytics",
    "/patient/appointments",
    "/patient/find-medicine",
    "/patient/medical-history",
    "/patient/medical-reports",
    "/patient/my-prescriptions",
    "/patient/prescriptions",
    "/patient/privacy",
    "/patient/profile",
    "/patient/reminders",
    "/patient/chorui-ai",
    "/settings",
    "/notifications",
  ],
  doctor: [
    "/doctor/home",
    "/doctor/analytics",
    "/doctor/appointments",
    "/doctor/patients",
    "/doctor/find-medicine",
    "/doctor/schedule",
    "/doctor/profile",
    "/doctor/chorui-ai",
    "/settings",
    "/notifications",
  ],
};

const mobileRoutesByRole = {
  patient: [
    "/patient/home",
    "/patient/find-doctor",
    "/patient/appointments",
    "/patient/medical-history",
    "/patient/profile",
  ],
  doctor: [
    "/doctor/home",
    "/doctor/appointments",
    "/doctor/patients",
    "/doctor/schedule",
    "/doctor/profile",
  ],
};

const publicRoutes = ["/", "/login", "/selection", "/forgot-password"];

function routeSlug(route) {
  if (route === "/") return "landing";
  return route.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-");
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

async function installVitalsObserver(context) {
  await context.addInitScript(() => {
    window.__medoraQaVitals = { lcp: 0, cls: 0, longTasks: [] };
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) window.__medoraQaVitals.lcp = last.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__medoraQaVitals.cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch {}
    try {
      new PerformanceObserver((list) => {
        window.__medoraQaVitals.longTasks.push(
          ...list.getEntries().map((entry) => ({
            startTime: entry.startTime,
            duration: entry.duration,
          })),
        );
      }).observe({ type: "longtask", buffered: true });
    } catch {}
  });
}

function attachDiagnostics(page, diagnostics) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      diagnostics.console.push({
        type: message.type(),
        text: message.text().slice(0, 800),
      });
    }
  });
  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(String(error.message || error).slice(0, 1000));
  });
  page.on("requestfailed", (request) => {
    diagnostics.failedRequests.push({
      method: request.method(),
      url: request.url().split("?")[0],
      failure: request.failure()?.errorText || "unknown",
    });
  });
  page.on("response", (response) => {
    const request = response.request();
    const resourceType = request.resourceType();
    if (response.status() >= 400 || ["document", "fetch", "xhr"].includes(resourceType)) {
      diagnostics.responses.push({
        status: response.status(),
        method: request.method(),
        resourceType,
        url: response.url().split("?")[0],
      });
    }
  });
  page.on("requestfinished", (request) => {
    if (!["document", "fetch", "xhr"].includes(request.resourceType())) return;
    const timing = request.timing();
    // Playwright exposes startTime as epoch time; all other timing fields are
    // offsets from startTime, so responseEnd is already the request duration.
    const duration = timing.responseEnd >= 0 ? timing.responseEnd : -1;
    diagnostics.requestTimings.push({
      method: request.method(),
      resourceType: request.resourceType(),
      url: request.url().split("?")[0],
      durationMs: Math.round(duration),
      responseStartMs: Math.round(timing.responseStart),
    });
  });
}

async function scanPage(page, route, viewportName, screenshotDir) {
  const diagnostics = {
    console: [],
    pageErrors: [],
    failedRequests: [],
    responses: [],
    requestTimings: [],
  };
  attachDiagnostics(page, diagnostics);

  const started = Date.now();
  let navigationError = null;
  let response = null;
  try {
    response = await page.goto(`${baseURL}${route}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
  } catch (error) {
    navigationError = String(error.message || error);
  }
  const wallMs = Date.now() - started;

  const browserMetrics = await page
    .evaluate(() => {
      const navigation = performance.getEntriesByType("navigation")[0];
      const paint = Object.fromEntries(
        performance.getEntriesByType("paint").map((entry) => [entry.name, entry.startTime]),
      );
      const bodyText = document.body?.innerText || "";
      const interactive = [...document.querySelectorAll("button, a, input, select, textarea")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const name =
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            element.textContent?.trim() ||
            element.getAttribute("placeholder") ||
            "";
          return {
            tag: element.tagName.toLowerCase(),
            name: name.slice(0, 100),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
      const unlabeledInputs = [...document.querySelectorAll("input, select, textarea")]
        .filter((element) => {
          const labels = element.labels ? [...element.labels] : [];
          return (
            labels.length === 0 &&
            !element.getAttribute("aria-label") &&
            !element.getAttribute("aria-labelledby") &&
            !element.getAttribute("placeholder")
          );
        })
        .map((element) => ({
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute("type") || "",
          id: element.id || "",
        }));
      return {
        title: document.title,
        finalUrl: location.href,
        h1: document.querySelector("h1")?.textContent?.trim().slice(0, 200) || "",
        bodyTextSample: bodyText.slice(0, 500),
        possibleErrorText: bodyText
          .split("\n")
          .filter((line) =>
            /failed to load|something went wrong|internal server error|application error/i.test(line),
          )
          .slice(0, 10),
        navigation: navigation
          ? {
              ttfbMs: navigation.responseStart,
              domContentLoadedMs: navigation.domContentLoadedEventEnd,
              loadMs: navigation.loadEventEnd,
              transferBytes: navigation.transferSize,
              encodedBytes: navigation.encodedBodySize,
            }
          : null,
        fcpMs: paint["first-contentful-paint"] || 0,
        vitals: window.__medoraQaVitals || null,
        viewport: {
          width: innerWidth,
          height: innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1,
        },
        smallTargets: interactive.filter((item) => item.width < 44 || item.height < 44).slice(0, 30),
        unlabeledInputs,
      };
    })
    .catch((error) => ({ evaluationError: String(error.message || error) }));

  let axe = { violations: [], incomplete: [] };
  if (!navigationError) {
    try {
      await page.addScriptTag({ path: axePath });
      axe = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        });
        const simplify = (items) =>
          items.map((item) => ({
            id: item.id,
            impact: item.impact,
            description: item.description,
            help: item.help,
            nodes: item.nodes.slice(0, 8).map((node) => ({
              target: node.target,
              failureSummary: node.failureSummary,
            })),
          }));
        return {
          violations: simplify(result.violations),
          incomplete: simplify(result.incomplete),
        };
      });
    } catch (error) {
      axe = { violations: [], incomplete: [], error: String(error.message || error) };
    }
  }

  const screenshotPath = path.join(
    screenshotDir,
    `${viewportName}-${routeSlug(route)}.png`,
  );
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});

  return {
    role,
    route,
    viewportName,
    status: response?.status() || null,
    wallMs,
    navigationError,
    browserMetrics,
    axe,
    diagnostics,
    screenshotPath,
  };
}

async function login(page) {
  const started = Date.now();
  await page.goto(`${baseURL}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel(/Email Address|Email/i).fill(email);
  await page.getByLabel(/Password/i).fill(password);
  await page.getByRole("button", { name: /Sign In|Log In/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 90_000 });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1_500);
  return {
    elapsedMs: Date.now() - started,
    destination: page.url(),
  };
}

async function main() {
  const roleRoot = path.join(outputRoot, role);
  const screenshotDir = path.join(roleRoot, "screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
    args: ["--disable-dev-shm-usage"],
  });

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    locale: "en-US",
    serviceWorkers: "block",
  });
  await installVitalsObserver(desktopContext);

  const publicResults = [];
  if (role === "patient") {
    for (const route of publicRoutes) {
      const page = await desktopContext.newPage();
      publicResults.push(await scanPage(page, route, "desktop-public", screenshotDir));
      await page.close();
    }
  }

  const loginPage = await desktopContext.newPage();
  const loginResult = await login(loginPage);
  await loginPage.close();

  const desktopResults = [];
  for (const route of routesByRole[role]) {
    const page = await desktopContext.newPage();
    desktopResults.push(await scanPage(page, route, "desktop", screenshotDir));
    await page.close();
  }

  const crossRolePage = await desktopContext.newPage();
  const forbiddenRoute = role === "patient" ? "/doctor/home" : "/patient/home";
  await crossRolePage.goto(`${baseURL}${forbiddenRoute}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await crossRolePage.waitForTimeout(500);
  const crossRoleResult = {
    requested: forbiddenRoute,
    finalUrl: crossRolePage.url(),
    passed: !new URL(crossRolePage.url()).pathname.startsWith(forbiddenRoute),
  };
  await crossRolePage.close();

  const storageState = await desktopContext.storageState();
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    locale: "en-US",
    serviceWorkers: "block",
    storageState,
  });
  await installVitalsObserver(mobileContext);
  const mobileResults = [];
  for (const route of mobileRoutesByRole[role]) {
    const page = await mobileContext.newPage();
    mobileResults.push(await scanPage(page, route, "mobile", screenshotDir));
    await page.close();
  }
  await mobileContext.close();

  const darkContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    locale: "en-US",
    serviceWorkers: "block",
    storageState,
  });
  await installVitalsObserver(darkContext);
  const darkPage = await darkContext.newPage();
  await darkPage.addInitScript(() => localStorage.setItem("theme", "dark"));
  const darkResult = await scanPage(
    darkPage,
    role === "patient" ? "/patient/home" : "/doctor/home",
    "desktop-dark",
    screenshotDir,
  );
  await darkContext.close();

  await browser.close();

  const allPageResults = [...publicResults, ...desktopResults, ...mobileResults, darkResult];
  const report = {
    generatedAt: new Date().toISOString(),
    baseURL,
    deployedCommit: process.env.QA_DEPLOYED_COMMIT || null,
    role,
    login: loginResult,
    crossRole: crossRoleResult,
    summary: {
      pages: allPageResults.length,
      navigationFailures: allPageResults.filter((item) => item.navigationError).length,
      httpErrors: allPageResults.reduce(
        (sum, item) =>
          sum + item.diagnostics.responses.filter((response) => response.status >= 400).length,
        0,
      ),
      consoleErrors: allPageResults.reduce(
        (sum, item) =>
          sum + item.diagnostics.console.filter((message) => message.type === "error").length,
        0,
      ),
      axeViolations: allPageResults.reduce(
        (sum, item) => sum + item.axe.violations.length,
        0,
      ),
      overflowPages: allPageResults.filter(
        (item) => item.browserMetrics.viewport?.horizontalOverflow,
      ).length,
      wallMs: {
        p50: percentile(allPageResults.map((item) => item.wallMs), 0.5),
        p95: percentile(allPageResults.map((item) => item.wallMs), 0.95),
        max: Math.max(...allPageResults.map((item) => item.wallMs)),
      },
      lcpMs: {
        p50: percentile(
          allPageResults.map((item) => item.browserMetrics.vitals?.lcp || 0).filter(Boolean),
          0.5,
        ),
        p95: percentile(
          allPageResults.map((item) => item.browserMetrics.vitals?.lcp || 0).filter(Boolean),
          0.95,
        ),
      },
    },
    publicResults,
    desktopResults,
    mobileResults,
    darkResult,
  };

  fs.writeFileSync(path.join(roleRoot, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ role, login: loginResult, crossRole: crossRoleResult, summary: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
