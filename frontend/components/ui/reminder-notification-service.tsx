"use client";

import { useEffect, useRef, useCallback } from "react";
import { getReminders, type Reminder } from "@/lib/reminder-actions";

const CLIENT_TICK_MS = 60_000;
const REMINDER_FETCH_BASE_MS = 20 * 60_000;
const REMINDER_FETCH_MAX_MS = 60 * 60_000;

/**
 * Client-side reminder notification service.
 * Mounts once in the (home) layout, checks active reminders,
 * and fires browser Notification when the current HH:MM matches a reminder time.
 */
export function ReminderNotificationService() {
  const firedRef = useRef<Set<string>>(new Set());
  const permissionRef = useRef<NotificationPermission>("default");
  const remindersRef = useRef<Reminder[]>([]);
  const lastReminderFetchAtRef = useRef(0);
  const reminderFetchDelayRef = useRef(REMINDER_FETCH_BASE_MS);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    permissionRef.current = Notification.permission;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        permissionRef.current = perm;
      });
    }
  }, []);

  const refreshReminders = useCallback(async (force = false) => {
    if (document.visibilityState !== "visible") return;
    if (permissionRef.current !== "granted") return;
    const nowMs = Date.now();

    if (!force && nowMs - lastReminderFetchAtRef.current < reminderFetchDelayRef.current) {
      return;
    }

    try {
      const { reminders } = await getReminders({ active_only: true });
      remindersRef.current = reminders || [];
      lastReminderFetchAtRef.current = nowMs;
      reminderFetchDelayRef.current = REMINDER_FETCH_BASE_MS;
    } catch {
      // Back off reminder-list refresh retries while still doing local tick checks.
      lastReminderFetchAtRef.current = nowMs;
      reminderFetchDelayRef.current = Math.min(reminderFetchDelayRef.current * 2, REMINDER_FETCH_MAX_MS);
    }
  }, []);

  const checkReminders = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    if (permissionRef.current !== "granted") return;

    await refreshReminders();

    const reminders = remindersRef.current;
    if (!reminders || reminders.length === 0) return;

    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`;
    const currentDay = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon..6=Sun
    const todayKey = now.toISOString().split("T")[0];

    for (const reminder of reminders) {
      if (!reminder.is_active) continue;

      if (
        reminder.days_of_week &&
        reminder.days_of_week.length > 0 &&
        !reminder.days_of_week.includes(currentDay)
      ) {
        continue;
      }

      for (const time of reminder.reminder_times) {
        if (time !== currentHHMM) continue;

        const firedKey = `${reminder.id}-${todayKey}-${time}`;
        if (firedRef.current.has(firedKey)) continue;

        firedRef.current.add(firedKey);
        const typeLabel = reminder.type === "medication" ? "Medicine" : "Test";

        new Notification(`${typeLabel} Reminder`, {
          body: `Time to take: ${reminder.item_name}${
            reminder.notes ? ` - ${reminder.notes}` : ""
          }`,
          icon: "/favicon.ico",
          tag: firedKey,
        });
      }
    }

    for (const key of firedRef.current) {
      if (!key.includes(todayKey)) {
        firedRef.current.delete(key);
      }
    }
  }, [refreshReminders]);

  useEffect(() => {
    let timeoutId: number | null = null;
    let disposed = false;

    const schedule = async () => {
      if (disposed) return;
      await checkReminders();
      timeoutId = window.setTimeout(schedule, CLIENT_TICK_MS);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshReminders(true);
        void checkReminders();
      }
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      disposed = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkReminders, refreshReminders]);

  return null;
}
