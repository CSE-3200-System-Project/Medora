import { expect, test } from "@playwright/test";

import { isFrontendReachable, loginIfCredentials, requireCredentialsOrSkip } from "./_helpers";

test.describe("Patient Onboarding", () => {
  test("patient onboarding supports bilingual input (Bangla + English)", async ({ page, request, baseURL }) => {
    test.skip(!(await isFrontendReachable(request, baseURL)), "Frontend is not reachable.");
    await requireCredentialsOrSkip(test.skip);

    await loginIfCredentials(page);
    await page.goto("/onboarding/patient?mode=edit");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/onboarding\/patient/i);

    const firstTextInput = page.locator("input, textarea").first();
    await expect(firstTextInput).toBeVisible();
    await firstTextInput.fill("রোগীর নাম Rahim Uddin - bilingual data check");
    await expect(firstTextInput).toHaveValue(/রোগীর নাম|Rahim/);
  });
});
