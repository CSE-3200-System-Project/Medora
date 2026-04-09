import { expect, test } from "@playwright/test";

import { isFrontendReachable } from "./_helpers";

test.describe("Doctor Verification", () => {
  test("verify pending page renders verification state content", async ({ page, request, baseURL }) => {
    test.skip(!(await isFrontendReachable(request, baseURL)), "Frontend is not reachable.");

    await page.goto("/verify-pending");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading")).toContainText(
      /Account Verification Pending|Account Verified|Verification Rejected/i,
    );
    await expect(page.getByRole("button", { name: /Logout/i })).toBeVisible();
  });
});
