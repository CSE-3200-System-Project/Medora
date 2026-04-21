"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Loader2 } from "lucide-react";
import { syncMedicationReminderToCalendar } from "@/lib/google-calendar-actions";
import { toast } from "sonner";

interface SyncReminderToCalendarProps {
  reminderId: string;
  itemName: string;
  reminderTimes: string[];
  daysOfWeek: number[];
  startDate: string; // ISO date string
  endDate?: string; // Optional ISO date string
  notes?: string;
  className?: string;
}

export function SyncReminderToCalendar({
  reminderId,
  itemName,
  reminderTimes,
  daysOfWeek,
  startDate,
  endDate,
  notes,
  className = "",
}: SyncReminderToCalendarProps) {
  const [syncing, setSyncing] = React.useState(false);
  const [synced, setSynced] = React.useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncMedicationReminderToCalendar(reminderId, {
        item_name: itemName,
        reminder_times: reminderTimes,
        days_of_week: daysOfWeek,
        start_date: startDate,
        end_date: endDate,
        notes,
      });

      setSynced(true);
      toast.success("Medication reminder synced to Google Calendar");
    } catch (error) {
      console.error("Failed to sync reminder to calendar:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to sync reminder to Google Calendar"
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
