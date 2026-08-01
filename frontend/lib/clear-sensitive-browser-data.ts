const SAFE_LOCAL_STORAGE_KEYS = new Set(["NEXT_LOCALE", "medora_theme"]);

async function settleWithin(promise: Promise<unknown>, timeoutMs = 3_000): Promise<void> {
  await Promise.race([
    promise.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);
}

export async function clearSensitiveBrowserData(): Promise<void> {
  if (typeof window === "undefined") return;

  for (const key of Object.keys(window.localStorage)) {
    if (!SAFE_LOCAL_STORAGE_KEYS.has(key)) window.localStorage.removeItem(key);
  }
  window.sessionStorage.clear();

  if ("caches" in window) {
    const names = await window.caches.keys();
    await settleWithin(Promise.allSettled(names.map((name) => window.caches.delete(name))));
  }

  if ("indexedDB" in window && typeof window.indexedDB.databases === "function") {
    const databases = await Promise.race([
      window.indexedDB.databases(),
      new Promise<IDBDatabaseInfo[]>((resolve) => window.setTimeout(() => resolve([]), 3_000)),
    ]);
    await settleWithin(Promise.all(
      databases
        .map((database) => database.name)
        .filter((name): name is string => Boolean(name))
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const request = window.indexedDB.deleteDatabase(name);
              request.onsuccess = () => resolve();
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            }),
        ),
    ));
  }

  // Cache Storage has already been cleared above. Notify an active worker as
  // a best-effort cleanup for older worker versions without delaying logout
  // while a newly installed worker is still activating.
  void navigator.serviceWorker
    ?.getRegistration()
    .then((registration) =>
      registration?.active?.postMessage({ type: "PURGE_MEDORA_PRIVATE_DATA" }),
    )
    .catch(() => undefined);
}
