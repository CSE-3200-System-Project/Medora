import { expect, Page, Request } from "@playwright/test";

export async function isFrontendReachable(request: Request, baseURL?: string): Promise<boolean> {
  if (!baseURL) return false;
  try {
    const res = await request.get(baseURL, { timeout: 5000 });
    return res.status() < 500;
  } catch {
    return false;
  }
}

export async function loginIfCredentials(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    return;
  }

  await page.goto("/login");
  await page.getByLabel(/Email Address/i).fill(email);
  // Not /Password/i: that also matches the "Show password" toggle button next to the
  // field, and the ambiguity fails in strict mode.
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /Sign In/i }).click();

  await page.waitForLoadState("networkidle");

  // Without this the specs below would run as an anonymous visitor and still pass on
  // whatever the login page happens to render, which is the failure mode that let the
  // broken locator above go unnoticed for as long as these tests were skipped.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

export async function requireCredentialsOrSkip(testSkip: (condition: boolean, description: string) => void) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    const message = "Set E2E_EMAIL and E2E_PASSWORD for authenticated flow validation.";
    if (process.env.E2E_ALLOW_SKIPS === "1") {
      testSkip(true, message);
      return;
    }
    throw new Error(`${message} Release verification does not permit skipped authenticated tests.`);
  }
}

export async function expectAnyVisible(page: Page, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const locator = page.getByText(pattern).first();
    try {
      await expect(locator).toBeVisible({ timeout: 4000 });
      return;
    } catch {
      // continue
    }
  }
  throw new Error(`None of the expected text patterns were visible: ${patterns.map((p) => p.source).join(", ")}`);
}
