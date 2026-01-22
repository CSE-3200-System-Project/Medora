"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Clock, Save } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeRange {
  id: string;
  startHour: number;
  startMinute: number;
  startPeriod: "AM" | "PM";
  endHour: number;
  endMinute: number;
  endPeriod: "AM" | "PM";
}

interface DaySchedule {
  enabled: boolean;
  timeRanges: TimeRange[];
}

interface ScheduleSetterProps {
  initialAvailableDays?: string[];
  initialTimeSlots?: string;
  initialDayTimeSlots?: Record<string, string[]>;  // NEW: per-day initial data
  appointmentDuration?: number;
  onSave: (dayTimeSlots: Record<string, string[]>, duration: number) => Promise<void>;  // NEW signature
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];

export function ScheduleSetter({ 
  initialAvailableDays = [], 
  initialTimeSlots = "",
  initialDayTimeSlots,  // NEW
  appointmentDuration = 30,
  onSave 
}: ScheduleSetterProps) {
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(() => {
    const initial: Record<string, DaySchedule> = {};
    DAYS.forEach(day => {
      initial[day] = {
        enabled: false,
        timeRanges: []
      };
    });
    
    // NEW: Use initialDayTimeSlots if provided (per-day structure)
    if (initialDayTimeSlots) {
      Object.entries(initialDayTimeSlots).forEach(([day, slots]) => {
        if (DAYS.includes(day)) {
          initial[day].enabled = true;
          initial[day].timeRanges = slots.flatMap(slot => parseTimeSlots(slot));
        }
      });
    } 
    // Legacy: Parse initial time slots and apply to all available days
    else if (initialTimeSlots && initialAvailableDays.length > 0) {
      const ranges = parseTimeSlots(initialTimeSlots);
      initialAvailableDays.forEach(day => {
        if (DAYS.includes(day)) {
          initial[day].enabled = true;
          initial[day].timeRanges = ranges;
        }
      });
    }
    
    return initial;
  });

  const [duration, setDuration] = useState(appointmentDuration);
  const [isSaving, setIsSaving] = useState(false);

  // Parse time slots string like "9:00 AM - 12:00 PM", "9 AM - 1 PM", or combined "9 AM - 1 PM, 5 PM - 9 PM"
  function parseTimeSlots(slots: string): TimeRange[] {
    const ranges: TimeRange[] = [];
    const rangePattern = /(\d{1,2}(?::(\d{2}))?)\s*(AM|PM|am|pm)\s*-\s*(\d{1,2}(?::(\d{2}))?)\s*(AM|PM|am|pm)/gi;
    let match;

    while ((match = rangePattern.exec(slots)) !== null) {
      const startPart = match[1];
      const startMinutePart = match[2];
      const startPeriod = match[3].toUpperCase() as "AM" | "PM";
      const endPart = match[4];
      const endMinutePart = match[5];
      const endPeriod = match[6].toUpperCase() as "AM" | "PM";

      const startHour = parseInt(startPart.split(":")[0]);
      const startMinute = startMinutePart ? parseInt(startMinutePart) : (startPart.includes(":") ? parseInt(startPart.split(":")[1]) : 0);
      const endHour = parseInt(endPart.split(":")[0]);
      const endMinute = endMinutePart ? parseInt(endMinutePart) : (endPart.includes(":") ? parseInt(endPart.split(":")[1]) : 0);

      ranges.push({
        id: Math.random().toString(36).substr(2, 9),
        startHour,
        startMinute,
        startPeriod,
        endHour,
        endMinute,
        endPeriod
      });
    }

    return ranges;
  }

  // Convert time ranges to string format
  function formatTimeRanges(ranges: TimeRange[]): string {
    return ranges.map(r => 
      `${r.startHour}:${r.startMinute.toString().padStart(2, '0')} ${r.startPeriod} - ${r.endHour}:${r.endMinute.toString().padStart(2, '0')} ${r.endPeriod}`
    ).join(", ");
  }

  const toggleDay = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
        timeRanges: prev[day].timeRanges.length === 0 && !prev[day].enabled
          ? [createDefaultTimeRange()]
          : prev[day].timeRanges
      }
    }));
  };

  const createDefaultTimeRange = (): TimeRange => ({
    id: Math.random().toString(36).substr(2, 9),
    startHour: 9,
    startMinute: 0,
    startPeriod: "AM",
    endHour: 5,
    endMinute: 0,
    endPeriod: "PM"
  });

  const addTimeRange = (day: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeRanges: [...prev[day].timeRanges, createDefaultTimeRange()]
      }
    }));
  };

  const removeTimeRange = (day: string, rangeId: string) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeRanges: prev[day].timeRanges.filter(r => r.id !== rangeId)
      }
    }));
  };

  const updateTimeRange = (day: string, rangeId: string, updates: Partial<TimeRange>) => {
    setSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        timeRanges: prev[day].timeRanges.map(r => 
          r.id === rangeId ? { ...r, ...updates } : r
        )
      }
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get enabled days
      const enabledDays = DAYS.filter(day => schedule[day].enabled);
      
      if (enabledDays.length === 0) {
        alert("Please select at least one available day");
        return;
      }

      // Build per-day time slots object
      const dayTimeSlots: Record<string, string[]> = {};
      
      for (const day of enabledDays) {
        const timeRanges = schedule[day].timeRanges;
        
        if (timeRanges.length === 0) {
          alert(`Please add at least one time range for ${day}`);
          return;
        }

        // Convert each time range to string format
        dayTimeSlots[day] = timeRanges.map(r => 
          `${r.startHour}:${r.startMinute.toString().padStart(2, '0')} ${r.startPeriod} - ${r.endHour}:${r.endMinute.toString().padStart(2, '0')} ${r.endPeriod}`
        );
      }
      
      await onSave(dayTimeSlots, duration);
    } catch (error: any) {
      alert(error.message || "Failed to save schedule");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Appointment Duration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appointment Duration</CardTitle>
          <CardDescription>How long is each appointment slot?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:gap-3">
            {[15, 20, 30, 45, 60].map(mins => (
              <Button
                key={mins}
                variant={duration === mins ? "medical" : "outline"}
                size="sm"
                onClick={() => setDuration(mins)}
                className="w-full"
              >
                {mins} min
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Days */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Available Days</CardTitle>
          <CardDescription>Select the days you're available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {DAYS.map(day => (
              <Button
                key={day}
                variant={schedule[day].enabled ? "medical" : "outline"}
                size="sm"
                onClick={() => toggleDay(day)}
                className="w-full"
              >
                {day.slice(0, 3)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time Ranges for Each Day */}
      {DAYS.filter(day => schedule[day].enabled).map(day => (
        <Card key={day}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{day}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addTimeRange(day)}
                className="h-8 gap-1"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">Add Range</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedule[day].timeRanges.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No time ranges set. Click "Add Range" to add one.
              </p>
            )}
            {schedule[day].timeRanges.map(range => (
              <div key={range.id} className="space-y-3 p-4 border rounded-xl bg-surface/50">
                {/* Start Time */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Start Time</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={range.startHour}
                      onChange={(e) => updateTimeRange(day, range.id, { startHour: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                    >
                      {HOURS.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={range.startMinute}
                      onChange={(e) => updateTimeRange(day, range.id, { startMinute: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                    >
                      {MINUTES.map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select
                      value={range.startPeriod}
                      onChange={(e) => updateTimeRange(day, range.id, { startPeriod: e.target.value as "AM" | "PM" })}
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">End Time</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={range.endHour}
                      onChange={(e) => updateTimeRange(day, range.id, { endHour: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                    >
                      {HOURS.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                    <select
                      value={range.endMinute}
                      onChange={(e) => updateTimeRange(day, range.id, { endMinute: parseInt(e.target.value) })}
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                    >
                      {MINUTES.map(m => (
                        <option key={m} value={m}>{m.toString().padStart(2, '0')}</option>
                      ))}
                    </select>
                    <select
                      value={range.endPeriod}
                      onChange={(e) => updateTimeRange(day, range.id, { endPeriod: e.target.value as "AM" | "PM" })}
                      className="px-3 py-2 border rounded-lg bg-background text-sm"
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </div>

                {/* Remove Button */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => removeTimeRange(day, range.id)}
                  className="w-full"
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Remove
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Save Button */}
      <div className="sticky bottom-4 z-10">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="medical"
          size="lg"
          className="w-full shadow-lg"
        >
          {isSaving ? (
            <>Saving...</>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Schedule
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
