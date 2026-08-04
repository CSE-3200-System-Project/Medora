"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Hook that subscribes to realtime slot-availability changes for a doctor+date.
 * When availability moves, `onSlotChange` fires so the UI can refetch slots
 * through the backend.
 *
 * This is a progressive enhancement — the booking flow works without it
 * (poll-on-focus), but with it, slots update in real time.
 *
 * It listens to `slot_change_events`, not `appointments`. That table is written by a
 * trigger and holds only (doctor_id, appointment_date, changed_at), so nothing
 * patient-identifying reaches the browser. Subscribing to `appointments` would stream
 * whole rows to any holder of the anon key, which is public by construction — see
 * migration `sec_001`.
 */
export function useRealtimeSlots(
  doctorId: string | null | undefined,
  date: string | null | undefined,
  onSlotChange: () => void,
) {
  const callbackRef = useRef(onSlotChange);

  useEffect(() => {
    callbackRef.current = onSlotChange;
  }, [onSlotChange]);

  useEffect(() => {
    if (!doctorId || !date || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const channel = supabase
      .channel(`slots:${doctorId}:${date}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "slot_change_events",
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          // The row carries no detail worth reading beyond the date it refers to;
          // the callback refetches authoritative slots from the backend.
          const candidate = Object.keys(payload.new).length ? payload.new : payload.old;
          const record = candidate as { appointment_date?: unknown };
          if (typeof record.appointment_date === "string") {
            if (record.appointment_date.slice(0, 10) === date) {
              callbackRef.current();
            }
          } else {
            // If we can't determine the date, refresh anyway
            callbackRef.current();
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorId, date]);
}
