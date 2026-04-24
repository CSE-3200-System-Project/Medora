"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, X } from "lucide-react";
import { updateDoctorLocationSchedule } from "@/lib/auth-actions";
import { toast } from "@/lib/notify";

const DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const;
const DURATIONS = [15, 20, 30, 45, 60] as const;

interface LocationScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  initialDayTimeSlots?: Record<string, string[]> | null;
  initialAvailableDays?: string[] | null;
  initialAppointmentDuration?: number | null;
  onSaved?: (result: {
    available_days: string[];
    day_time_slots: Record<string, string[]>;
    appointment_duration: number | null;
  }) => void;
}

export function LocationScheduleDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  initialDayTimeSlots,
  initialAvailableDays,
  initialAppointmentDuration,
  onSaved,
}: LocationScheduleDialogProps) {
  const [dayTimeSlots, setDayTimeSlots] = React.useState<Record<string, string[]>>({});
  const [duration, setDuration] = React.useState<number>(30);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    // Seed from either day_time_slots or available_days, whichever is present.
    const seeded: Record<string, string[]> = {};
    if (initialDayTimeSlots && Object.keys(initialDayTimeSlots).length > 0) {
      for (const [k, v] of Object.entries(initialDayTimeSlots)) {
        seeded[k] = Array.isArray(v) ? [...v] : [];
      }
    } else if (initialAvailableDays) {
      for (const d of initialAvailableDays) seeded[d] = [];
    }
    setDayTimeSlots(seeded);
    setDuration(initialAppointmentDuration ?? 30);
  }, [open, initialDayTimeSlots, initialAvailableDays, initialAppointmentDuration]);

  const toggleDay = (day: string) => {
    setDayTimeSlots((prev) => {
      const next = { ...prev };
      if (day in next) {
        delete next[day];
      } else {
        next[day] = [""];
      }
      return next;
    });
  };

  const updateSlot = (day: string, index: number, value: string) => {
    setDayTimeSlots((prev) => ({
      ...prev,
      [day]: prev[day].map((s, i) => (i === index ? value : s)),
    }));
  };

  const addSlot = (day: string) => {
    setDayTimeSlots((prev) => ({ ...prev, [day]: [...(prev[day] ?? []), ""] }));
  };

  const removeSlot = (day: string, index: number) => {
    setDayTimeSlots((prev) => {
      const slots = prev[day].filter((_, i) => i !== index);
      if (slots.length === 0) {
        const next = { ...prev };
        delete next[day];
        return next;
      }
      return { ...prev, [day]: slots };
    });
  };

  const handleSave = async () => {
    const cleaned: Record<string, string[]> = {};
    for (const [day, slots] of Object.entries(dayTimeSlots)) {
      const nonEmpty = slots.map((s) => s.trim()).filter(Boolean);
      if (nonEmpty.length > 0) cleaned[day] = nonEmpty;
    }
    const availableDays = Object.keys(cleaned);

    if (availableDays.length === 0) {
      toast.error("Add at least one day with time slots");
      return;
    }

    setSaving(true);
    try {
      const result = await updateDoctorLocationSchedule({
        locationId,
        availableDays,
        dayTimeSlots: cleaned,
        appointmentDuration: duration,
      });
      toast.success("Schedule updated");
      onSaved?.({
        available_days: result.available_days,
        day_time_slots: result.day_time_slots,
        appointment_duration: result.appointment_duration,
      });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update schedule");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit schedule</DialogTitle>
          <DialogDescription>
            Set the days and time windows you see patients at <span className="font-medium">{locationName}</span>. Use a
            format like <code className="rounded bg-muted px-1 text-xs">9:00 AM - 1:00 PM</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Day chips */}
          <div>
            <label className="text-sm font-medium text-foreground">Available days</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DAYS.map((day) => {
                const active = day in dayTimeSlots;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-day slots */}
          <div className="space-y-3">
            {Object.keys(dayTimeSlots).length === 0 ? (
              <p className="text-sm text-muted-foreground">Pick a day above to add time windows.</p>
            ) : (
              Object.entries(dayTimeSlots).map(([day, slots]) => (
                <div key={day} className="rounded-lg border border-border/60 bg-surface/30 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary" className="text-xs">
                      {day}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => toggleDay(day)}
                      className="text-xs text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${day}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {slots.map((slot, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={slot}
                          onChange={(e) => updateSlot(day, i, e.target.value)}
                          placeholder="9:00 AM - 1:00 PM"
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSlot(day, i)}
                          aria-label="Remove time window"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSlot(day)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Add window
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="text-sm font-medium text-foreground">Appointment duration (minutes)</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    duration === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
