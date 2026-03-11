"use client";

import { useEffect, useState, useCallback } from "react";

type NetworkStatus = {
  isOnline: boolean;
  wasOffline: boolean;
};

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    wasOffline: false,
  });

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({
        isOnline: true,
        wasOffline: prev.wasOffline || !prev.isOnline,
      }));
    };

    const handleOffline = () => {
      setStatus({ isOnline: false, wasOffline: true });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}

// Trigger background sync manually
export async function requestBackgroundSync(tag: string = "medora-sync") {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
  }
}

// Cache API data for offline use
export function useOfflineCache<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      // Cache the result in localStorage for offline access
      try {
        localStorage.setItem(
          `medora_cache_${key}`,
          JSON.stringify({ data: result, timestamp: Date.now() }),
        );
      } catch {
        // localStorage might be full
      }
    } catch (err) {
      // Try loading from cache
      try {
        const cached = localStorage.getItem(`medora_cache_${key}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setData(parsed.data);
        } else {
          setError(err instanceof Error ? err : new Error("Fetch failed"));
        }
      } catch {
        setError(err instanceof Error ? err : new Error("Fetch failed"));
      }
    } finally {
      setIsLoading(false);
    }
  }, [key, fetcher]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, isLoading, error, refresh };
}
