"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Hook that subscribes to realtime appointment changes for a specific doctor+date.
 * When an appointment is created, updated, or deleted for the given doctor,
 * the `onSlotChange` callback fires so the UI can refresh available slots.
 *
 * This is a progressive enhancement — the booking flow works without it
 * (poll-on-focus), but with it, slots update in real time.
 */
export function useRealtimeSlots(
  doctorId: string | null | undefined,
  date: string | null | undefined,
  onSlotChange: () => void,
) {
  const callbackRef = useRef(onSlotChange);
  callbackRef.current = onSlotChange;

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
          table: "appointments",
          filter: `doctor_id=eq.${doctorId}`,
        },
        (payload) => {
          // Check if the change is for the date we're watching
          const record = (payload.new as any) || (payload.old as any);
          if (record?.appointment_date) {
            const recordDate = record.appointment_date.slice(0, 10);
            if (recordDate === date) {
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
