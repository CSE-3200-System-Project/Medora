/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  BackgroundSyncQueue,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
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

// Background sync queue for failed API requests
const bgSyncQueue = new BackgroundSyncQueue("medora-api-queue", {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
});

const API_CACHE_TTL_SECONDS = Number(process.env.NEXT_PUBLIC_PERF_API_CACHE_TTL ?? "60") || 60;

function toManifestUrl(entry: PrecacheEntry | string): string {
  const url = typeof entry === "string" ? entry : entry.url;
  return url.replaceAll("\\", "/");
}

function isInstallCriticalAsset(url: string): boolean {
  if (url === "/" || url === "/manifest.json" || url.startsWith("/icons/")) {
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
        url.pathname.startsWith("/assets/") ||
        url.pathname.startsWith("/_next/image")),
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
  {
    matcher: ({ request, sameOrigin, url }) =>
      request.method === "GET" &&
      ((sameOrigin && url.pathname.startsWith("/api/")) ||
        (!sameOrigin && url.pathname.startsWith("/api/"))),
    handler: new StaleWhileRevalidate({
      cacheName: "api-get-v1",
      plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: API_CACHE_TTL_SECONDS })],
    }),
  },
  {
    matcher: ({ request, sameOrigin, url }) =>
      sameOrigin &&
      request.method === "GET" &&
      request.mode === "navigate" &&
      !url.pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: "pages-v1",
      networkTimeoutSeconds: 3,
      plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 })],
    }),
  },
];

// Listen for failed fetch requests and add to background sync queue
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = new URL(event.request.url);

  // Only queue POST/PATCH/PUT requests to the backend API for background sync
  if (
    url.pathname.startsWith("/api/") &&
    ["POST", "PATCH", "PUT"].includes(event.request.method)
  ) {
    const bgSyncLogic = async () => {
      try {
        const response = await fetch(event.request.clone());
        return response;
      } catch {
        await bgSyncQueue.pushRequest({ request: event.request });
        return Response.error();
      }
    };

    event.respondWith(bgSyncLogic());
  }
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
