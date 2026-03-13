"use client";

import { useEffect, useState } from "react";

type PushSubscriptionState = {
  isSupported: boolean;
  isSubscribed: boolean;
  subscription: PushSubscription | null;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushSubscriptionState>({
    isSupported: false,
    isSubscribed: false,
    subscription: null,
  });

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setState((prev) => ({ ...prev, isSupported: true }));
      checkExistingSubscription();
    }
  }, []);

  async function checkExistingSubscription() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        await registration.pushManager.getSubscription();
      if (subscription) {
        setState({
          isSupported: true,
          isSubscribed: true,
          subscription,
        });
      }
    } catch (error) {
      console.error("Error checking push subscription:", error);
    }
  }

  async function subscribe(authToken: string) {
    try {
      const registration = await navigator.serviceWorker.ready;

      // Fetch VAPID public key from backend
      const keyResponse = await fetch(`${BACKEND_URL}/notifications/vapid-key`);
      if (!keyResponse.ok) throw new Error("Failed to fetch VAPID key");
      const { public_key } = await keyResponse.json();

      const applicationServerKey = urlBase64ToUint8Array(public_key);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to backend
      await fetch(`${BACKEND_URL}/notifications/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(
              String.fromCharCode(
                ...new Uint8Array(subscription.getKey("p256dh")!),
              ),
            ),
            auth: btoa(
              String.fromCharCode(
                ...new Uint8Array(subscription.getKey("auth")!),
              ),
            ),
          },
        }),
      });

      setState({
        isSupported: true,
        isSubscribed: true,
        subscription,
      });

      return subscription;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      throw error;
    }
  }

  async function unsubscribe(authToken: string) {
    try {
      if (state.subscription) {
        const endpoint = state.subscription.endpoint;
        await state.subscription.unsubscribe();

        // Notify backend
        await fetch(`${BACKEND_URL}/notifications/unsubscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ endpoint }),
        });
      }

      setState({
        isSupported: true,
        isSubscribed: false,
        subscription: null,
      });
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error);
      throw error;
    }
  }

  async function requestPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) return "denied";
    return await Notification.requestPermission();
  }

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    permission:
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : ("default" as NotificationPermission),
  };
}
