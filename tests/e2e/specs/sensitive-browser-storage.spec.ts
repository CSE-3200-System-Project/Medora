import { expect, test } from "@playwright/test";

test.describe("Sensitive browser storage", () => {
  test("service worker does not cache private API responses", async ({ page }) => {
    await page.goto("/selection");
    await page.evaluate(() => {
      void navigator.serviceWorker.register("/sw.js");
    });
    await expect.poll(
      () => page
        .evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? null)
        .catch(() => null),
      { timeout: 45_000 },
    ).toBe("activated");
    await page.reload();
    await expect.poll(
      () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      { timeout: 30_000 },
    ).toBe(true);

    await page.evaluate(async () => {
      await fetch("/api/softwarex-private-fixture");
    });
    const cachedUrls = await page.evaluate(async () => {
      const urls: string[] = [];
      for (const cacheName of await window.caches.keys()) {
        const cache = await window.caches.open(cacheName);
        urls.push(...(await cache.keys()).map((request) => request.url));
      }
      return urls;
    });

    expect(cachedUrls.some((url) => url.includes("/api/softwarex-private-fixture"))).toBe(false);
  });

  test("session cleanup purges private local, session, cache, and IndexedDB data", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(async () => {
      localStorage.setItem("medora_theme", "system");
      localStorage.setItem("patient_access_token", "synthetic-secret");
      sessionStorage.setItem("draft_prescription", "synthetic-health-data");
      const cache = await window.caches.open("medora-private-test");
      await cache.put("/api/private-record", new Response("synthetic-health-data"));
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("medora-private-test", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("records");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          request.result.close();
          resolve();
        };
      });
    });

    await page.goto("/session-cleanup");
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    const state = await page.evaluate(async () => ({
      localKeys: Object.keys(localStorage),
      theme: localStorage.getItem("medora_theme"),
      sessionKeys: Object.keys(sessionStorage),
      cacheNames: await window.caches.keys(),
      cachedUrls: (
        await Promise.all(
          (await window.caches.keys()).map(async (name) =>
            (await (await window.caches.open(name)).keys()).map((request) => request.url),
          ),
        )
      ).flat(),
      databaseNames:
        typeof indexedDB.databases === "function"
          ? (await indexedDB.databases()).map((database) => database.name)
          : [],
    }));

    expect(state.localKeys).toEqual(["medora_theme"]);
    expect(state.theme).toBe("system");
    expect(state.sessionKeys).toEqual([]);
    expect(state.cacheNames).not.toContain("medora-private-test");
    expect(state.cachedUrls.some((url) => url.includes("/api/private-record"))).toBe(false);
    expect(state.databaseNames).not.toContain("medora-private-test");
  });
});
