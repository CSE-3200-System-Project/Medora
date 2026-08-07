import { expect, test } from "@playwright/test";

import { isFrontendReachable, loginIfCredentials, requireCredentialsOrSkip } from "./_helpers";

test.describe("Appointment Booking and Rescheduling", () => {
  test("patient can use AI doctor search input with Bangla + English query", async ({ page, request, baseURL }) => {
    test.skip(!(await isFrontendReachable(request, baseURL)), "Frontend is not reachable.");
    await requireCredentialsOrSkip(test.skip);

    await page.route("**/ai/search", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          doctors: [
            {
              profile_id: "doctor-1",
              first_name: "Arefin",
              last_name: "Sayeed",
              title: "Dr.",
              specialization: "Cardiology",
              score: 0.94,
              reason: "Specializes in Cardiology",
            },
          ],
          ambiguity: "low",
          medical_intent: {
            primary_specialties: ["Cardiology"],
            secondary_specialties: [],
          },
        }),
      });
    });

    await loginIfCredentials(page);
    await page.goto("/patient/find-doctor");
    await page.waitForLoadState("networkidle");

    // AI mode is on by default now, and the button that used to enter it is the button
    // that leaves it. Clicking unconditionally toggled the mode off.
    const enterAiMode = page.getByRole("button", { name: /Try AI Search/i });
    if (await enterAiMode.isVisible().catch(() => false)) {
      await enterAiMode.click();
    }
    await expect(page.getByRole("button", { name: /Switch to Standard/i })).toBeVisible();

    const concernField = page
      .getByPlaceholder(/Describe symptoms|Describe your health concern|Bangla\/English/i)
      .first();
    await concernField.fill("আমার chest pain হচ্ছে তিন দিন ধরে");
    await expect(concernField).toHaveValue(/chest pain/);

    await page.getByRole("button", { name: /Find Doctors with AI/i }).click();
    // The mocked doctor's name, specialty, and match reason all match, so scope to one.
    await expect(page.getByText(/Arefin/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Cardiology/i).first()).toBeVisible();
  });
});
