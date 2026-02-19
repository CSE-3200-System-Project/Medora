"use client";

import { useEffect, useRef, useCallback } from "react";
import { getReminders } from "@/lib/reminder-actions";

/**
 * Client-side reminder notification service.
 * Mounts once in the (home) layout, checks active reminders every 60s,
 * and fires browser Notification when the current HH:MM matches a reminder time.
 */
export function ReminderNotificationService() {
  const firedRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<NotificationPermission>("default");

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    permissionRef.current = Notification.permission;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  const checkReminders = useCallback(async () => {
    if (permissionRef.current !== "granted") return;

    try {
      const { reminders } = await getReminders({ active_only: true });
      if (!reminders || reminders.length === 0) return;

      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes()
      ).padStart(2, "0")}`;
      const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon..6=Sun
      const todayKey = now.toISOString().split("T")[0]; // YYYY-MM-DD for dedup

      for (const reminder of reminders) {
        if (!reminder.is_active) continue;

        // Check if today's day-of-week matches
        if (
          reminder.days_of_week &&
          reminder.days_of_week.length > 0 &&
          !reminder.days_of_week.includes(currentDay)
        ) {
          continue;
        }

        // Check each reminder time
        for (const time of reminder.reminder_times) {
          if (time !== currentHHMM) continue;

          const firedKey = `${reminder.id}-${todayKey}-${time}`;
          if (firedRef.current.has(firedKey)) continue;

          // Fire notification
          firedRef.current.add(firedKey);
          const typeLabel =
            reminder.type === "medication" ? "Medicine" : "Test";

          new Notification(`${typeLabel} Reminder`, {
            body: `Time to take: ${reminder.item_name}${
              reminder.notes ? ` — ${reminder.notes}` : ""
            }`,
            icon: "/favicon.ico",
            tag: firedKey,
          });
        }
      }

      // Cleanup old fired keys (keep only today's)
      for (const key of firedRef.current) {
        if (!key.includes(todayKey)) {
          firedRef.current.delete(key);
        }
      }
    } catch {
      // Silently ignore — reminders are best-effort
    }
  }, []);

  useEffect(() => {
    // Initial check
    checkReminders();

    // Check every 60 seconds
    const interval = setInterval(checkReminders, 60_000);
    return () => clearInterval(interval);
  }, [checkReminders]);

  // This component renders nothing
  return null;
}
