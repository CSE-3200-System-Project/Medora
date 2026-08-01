/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
  type RuntimeCaching,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

function toManifestUrl(entry: PrecacheEntry | string): string {
  const url = typeof entry === "string" ? entry : entry.url;
  return url.replaceAll("\\", "/");
}

function isInstallCriticalAsset(url: string): boolean {
  if (url === "/manifest.json" || url.startsWith("/icons/")) {
    return true;
  }

  if (url.includes("/_next/static/")) {
    if (url.endsWith("_buildManifest.js") || url.endsWith("_ssgManifest.js")) {
      return true;
    }
    if (url.includes("/_next/static/css/")) {
      return true;
    }
    if (
      url.includes("/_next/static/chunks/framework-") ||
      url.includes("/_next/static/chunks/main-") ||
      url.includes("/_next/static/chunks/main-app-") ||
      url.includes("/_next/static/chunks/polyfills-") ||
      url.includes("/_next/static/chunks/webpack-") ||
      url.includes("/_next/static/chunks/app/layout-") ||
      url.includes("/_next/static/chunks/app/page-")
    ) {
      return true;
    }
  }

  return false;
}

const runtimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ url, sameOrigin }) =>
      sameOrigin && url.pathname.startsWith("/_next/static/"),
    handler: new CacheFirst({
      cacheName: "next-static-assets-v1",
      plugins: [new ExpirationPlugin({ maxEntries: 96, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin &&
      request.method === "GET" &&
      (url.pathname.startsWith("/icons/") ||
        url.pathname.startsWith("/images/") ||
        url.pathname.startsWith("/assets/")),
    handler: new StaleWhileRevalidate({
      cacheName: "image-assets-v1",
      plugins: [new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 14 * 24 * 60 * 60 })],
    }),
  },
  {
    matcher: ({ request, sameOrigin }) => sameOrigin && request.destination === "font",
    handler: new CacheFirst({
      cacheName: "font-assets-v1",
      plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    }),
  },
];

// Logout/session-expiry cleanup. Only immutable public assets may be cached,
// but clearing all Medora caches also removes data left by older workers.
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type !== "PURGE_MEDORA_PRIVATE_DATA") return;
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name.includes("medora") || name.includes("api-") || name.includes("pages-"))
          .map((name) => caches.delete(name)),
      ),
    ),
  );
});

// Push notification handler
self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() ?? {
    title: "Medora",
    body: "You have a new notification",
    icon: "/icons/icon-192x192.png",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      tag: data.tag || "medora-notification",
      data: data.data || {},
    }),
  );
});

// Notification click handler
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }
        // Open new window
        return self.clients.openWindow(urlToOpen);
      }),
  );
});

const serwist = new Serwist({
  precacheEntries: (self.__SW_MANIFEST ?? []).filter((entry) =>
    isInstallCriticalAsset(toManifestUrl(entry)),
  ),
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
});

serwist.addEventListeners();
