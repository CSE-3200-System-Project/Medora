import { expect, test } from "@playwright/test";

import { isFrontendReachable, loginIfCredentials, requireCredentialsOrSkip } from "./_helpers";

test.describe("Prescription Upload + OCR", () => {
  test("patient can upload prescription and view extracted text", async ({ page, request, baseURL }) => {
    test.skip(!(await isFrontendReachable(request, baseURL)), "Frontend is not reachable.");
    await requireCredentialsOrSkip(test.skip);

    await page.route("**/upload/prescription/extract", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          extracted_text: "Napa 500mg 1+0+1 5 days",
          confidence: 0.92,
          medications: [
            {
              name: "Napa",
              dosage: "500mg",
              frequency: "1+0+1",
              quantity: "5 days",
              confidence: 0.92,
            },
          ],
          raw_text: "Napa 500mg 1+0+1 5 days",
        }),
      });
    });

    await loginIfCredentials(page);
    await page.goto("/patient/find-medicine");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(/Prescription Upload Demo/i)).toBeVisible();
    const fileInput = page.locator("input[type='file']#prescription-upload");
    await fileInput.setInputFiles({
      name: "rx.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000000020001e221bc330000000049454e44ae426082",
        "hex",
      ),
    });

    await page.getByRole("button", { name: /Extract Text/i }).click();

    // The response is rendered as structured fields rather than echoed as the raw
    // string, and it lands in a review panel that a person has to approve. Assert that
    // shape: it is the human-in-the-loop behaviour the extraction is supposed to have.
    await expect(page.getByRole("heading", { name: /Extracted Text/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Napa/)).toBeVisible();
    await expect(page.getByText(/500mg/).first()).toBeVisible();
    await expect(page.getByText(/1\+0\+1/).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Medicine Review \(Human Approval\)/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve & Add to Profile/i })).toBeVisible();
  });
});
