"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2 } from "lucide-react";
import { syncAppointmentToCalendar } from "@/lib/google-calendar-actions";
import { toast } from "sonner";

interface SyncAppointmentToCalendarProps {
  appointmentId: string;
  summary: string;
  description: string;
  startDatetime: string; // ISO datetime string
  durationMinutes?: number;
  location?: string;
  className?: string;
}

export function SyncAppointmentToCalendar({
  appointmentId,
  summary,
  description,
  startDatetime,
  durationMinutes = 30,
  location,
  className = "",
}: SyncAppointmentToCalendarProps) {
  const [syncing, setSyncing] = React.useState(false);
  const [synced, setSynced] = React.useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncAppointmentToCalendar(appointmentId, {
        summary,
        description,
        start_datetime: startDatetime,
        duration_minutes: durationMinutes,
        location,
      });

      setSynced(true);
      toast.success("Appointment synced to Google Calendar");
    } catch (error) {
      console.error("Failed to sync appointment to calendar:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sync appointment to Google Calendar"
      );
    } finally {
      setSyncing(false);
    }
  };

  if (synced) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className={className}
      >
        <CalendarPlus className="h-4 w-4 mr-2 text-green-600" />
        Synced to Calendar
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className={className}
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <CalendarPlus className="h-4 w-4 mr-2" />
      )}
      {syncing ? "Syncing..." : "Add to Google Calendar"}
    </Button>
  );
}
