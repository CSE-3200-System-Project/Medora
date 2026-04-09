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

    await page.getByRole("button", { name: /Try AI Search|Switch to Standard/i }).click();
    const concernField = page.getByPlaceholder(/Bangla\/English|Describe your health concern/i).first();
    await concernField.fill("আমার chest pain হচ্ছে তিন দিন ধরে");
    await expect(concernField).toHaveValue(/chest pain/);

    await page.getByRole("button", { name: /Find Doctors with AI/i }).click();
    await expect(page.getByText(/Cardiology|Arefin/i)).toBeVisible({ timeout: 10000 });
  });
});
