"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Bell, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { createReminder, type ReminderType } from "@/lib/reminder-actions";

const DAYS_OF_WEEK = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
];

interface ReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  itemId?: string;
  type: ReminderType;
  onSuccess?: () => void;
}

export function ReminderDialog({
  open,
  onOpenChange,
  itemName,
  itemId,
  type,
  onSuccess,
}: ReminderDialogProps) {
  const [time, setTime] = useState("09:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSelectAllDays = () => {
    if (selectedDays.length === 7) {
      setSelectedDays([]);
    } else {
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      await createReminder({
        type,
        item_name: itemName,
        item_id: itemId,
        reminder_times: [time],  // Single time wrapped in array
        days_of_week: selectedDays.length > 0 ? selectedDays : undefined,
        notes: notes || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setTime("09:00");
        setSelectedDays([]);
        setNotes("");
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10">
            {success ? (
              <CheckCircle2 className="w-6 h-6 text-success" />
            ) : (
              <Bell className="w-6 h-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center">
            {success ? "Reminder Set!" : "Set Reminder"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {success
              ? `You'll be reminded about ${itemName}`
              : `Set a reminder for ${itemName}`}
          </DialogDescription>
        </DialogHeader>

        {!success && (
          <div className="space-y-6 py-4">
            {/* Time Picker */}
            <div className="space-y-2">
              <Label htmlFor="reminder-time" className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Reminder Time
              </Label>
              <Input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="text-center text-lg font-medium"
              />
            </div>

            {/* Days of Week */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Repeat on days</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllDays}
                  className="text-xs"
                >
                  {selectedDays.length === 7 ? "Clear all" : "Every day"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={cn(
                      "w-10 h-10 rounded-full text-sm font-medium transition-colors",
                      selectedDays.includes(day.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedDays.length === 0
                  ? "Reminder will repeat every day"
                  : `Reminder will repeat on selected days`}
              </p>
            </div>

            {/* Notes (optional) */}
            <div className="space-y-2">
              <Label htmlFor="reminder-notes">Notes (optional)</Label>
              <Input
                id="reminder-notes"
                placeholder="e.g., Take with food"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-center gap-2">
          {!success && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Set Reminder
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Prescription Reminder Dialog - handles multiple times per day based on dosage
 */
interface PrescriptionReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineName: string;
  prescriptionId: string;
  doseTimes?: {
    morning?: boolean;
    afternoon?: boolean;
    evening?: boolean;
    night?: boolean;
  };
  onSuccess?: () => void;
}

export function PrescriptionReminderDialog({
  open,
  onOpenChange,
  medicineName,
  prescriptionId,
  doseTimes = {},
  onSuccess,
}: PrescriptionReminderDialogProps) {
  // Default times based on dose schedule
  const getDefaultTimes = () => {
    const times: string[] = [];
    if (doseTimes.morning) times.push("08:00");
    if (doseTimes.afternoon) times.push("14:00");
    if (doseTimes.evening) times.push("19:00");
    if (doseTimes.night) times.push("22:00");
    return times.length > 0 ? times : ["09:00"];
  };

  const [times, setTimes] = useState<string[]>(getDefaultTimes);
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]); // Default to every day
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTimeChange = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const addTime = () => {
    setTimes([...times, "12:00"]);
  };

  const removeTime = (index: number) => {
    if (times.length > 1) {
      setTimes(times.filter((_, i) => i !== index));
    }
  };

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSelectAllDays = () => {
    if (selectedDays.length === 7) {
      setSelectedDays([]);
    } else {
      setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setError(null);

      await createReminder({
        type: "medication",
        item_name: medicineName,
        prescription_id: prescriptionId,
        reminder_times: times,
        days_of_week: selectedDays.length > 0 ? selectedDays : undefined,
        notes: notes || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        onOpenChange(false);
        setSuccess(false);
        setTimes(getDefaultTimes());
        setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
        setNotes("");
        onSuccess?.();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      onOpenChange(false);
      setError(null);
      setSuccess(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10">
            {success ? (
              <CheckCircle2 className="w-6 h-6 text-success" />
            ) : (
              <Bell className="w-6 h-6 text-primary" />
            )}
          </div>
          <DialogTitle className="text-center">
            {success ? "Reminder Set!" : "Set Medication Reminder"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {success
              ? `You'll be reminded to take ${medicineName}`
              : `Set reminder times for ${medicineName}`}
          </DialogDescription>
        </DialogHeader>

        {!success && (
          <div className="space-y-6 py-4">
            {/* Multiple Time Pickers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Reminder Times
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addTime}
                  className="text-xs text-primary"
                >
                  + Add time
                </Button>
              </div>
              <div className="space-y-2">
                {times.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      className="flex-1 text-center font-medium"
                    />
                    {times.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTime(index)}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {times.length} reminder{times.length > 1 ? "s" : ""} per day
              </p>
            </div>

            {/* Days of Week */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Repeat on days</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllDays}
                  className="text-xs"
                >
                  {selectedDays.length === 7 ? "Clear all" : "Every day"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={cn(
                      "w-10 h-10 rounded-full text-sm font-medium transition-colors",
                      selectedDays.includes(day.value)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="prescription-reminder-notes">Notes (optional)</Label>
              <Input
                id="prescription-reminder-notes"
                placeholder="e.g., Take with food"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                {error}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-center gap-2">
          {!success && (
            <>
              <Button variant="outline" onClick={handleClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting...
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Set {times.length} Reminder{times.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
