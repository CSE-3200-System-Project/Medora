"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  Save,
  CalendarOff,
  CalendarPlus,
  Clock,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import {
  getWeeklyAvailability,
  updateWeeklyAvailability,
  addException,
  removeException,
  addScheduleOverride,
  removeScheduleOverride,
} from "@/lib/availability-actions";
import { ExceptionCalendar } from "./exception-calendar";

// === Types ===

interface TimeBlock {
  id: string;
  start_time: string; // "HH:MM" 24h format
  end_time: string;
  slot_duration_minutes: number;
}

interface DaySchedule {
  is_active: boolean;
  time_blocks: TimeBlock[];
}

interface ExceptionData {
  id: string;
  exception_date: string;
  is_available: boolean;
  reason: string | null;
}

interface OverrideData {
  id: string;
  override_date: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}

interface AvailabilityManagerProps {
  doctorId: string;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 15, 30, 45];
const DURATION_OPTIONS = [15, 20, 30, 45, 60];

function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

function to24h(hour: number, minute: number, period: "AM" | "PM"): string {
  let h = hour;
  if (period === "PM" && hour !== 12) h += 12;
  if (period === "AM" && hour === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

function from24h(time24: string): {
  hour: number;
  minute: number;
  period: "AM" | "PM";
} {
  const [h, m] = time24.split(":").map(Number);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return { hour, minute: m, period };
}

function formatTime12(time24: string): string {
  const { hour, minute, period } = from24h(time24);
  return `${hour}:${minute.toString().padStart(2, "0")} ${period}`;
}

// Parse legacy "9:00 AM - 5:00 PM" ranges to 24h time blocks
function parseLegacyRange(rangeStr: string): TimeBlock | null {
  const match = rangeStr.match(
    /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i
  );
  if (!match) return null;

  const startH = parseInt(match[1]);
  const startM = match[2] ? parseInt(match[2]) : 0;
  const startP = match[3].toUpperCase() as "AM" | "PM";
  const endH = parseInt(match[4]);
  const endM = match[5] ? parseInt(match[5]) : 0;
  const endP = match[6].toUpperCase() as "AM" | "PM";

  return {
    id: generateId(),
    start_time: to24h(startH, startM, startP),
    end_time: to24h(endH, endM, endP),
    slot_duration_minutes: 30,
  };
}

export function AvailabilityManager({ doctorId }: AvailabilityManagerProps) {
  const [activeTab, setActiveTab] = useState<
    "weekly" | "exceptions" | "overrides"
  >("weekly");
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({});
  const [duration, setDuration] = useState(30);
  const [exceptions, setExceptions] = useState<ExceptionData[]>([]);
  const [overrides, setOverrides] = useState<OverrideData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Override form state
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("17:00");
  const [overrideDuration, setOverrideDuration] = useState(30);

  const loadAvailability = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWeeklyAvailability(doctorId);
      if (!data) {
        // Initialize empty schedule
        const empty: Record<string, DaySchedule> = {};
        DAYS.forEach((d) => {
          empty[d] = { is_active: false, time_blocks: [] };
        });
        setSchedule(empty);
        setExceptions([]);
        setOverrides([]);
        setLoading(false);
        return;
      }

      // Map structured availability to local state
      const newSchedule: Record<string, DaySchedule> = {};
      DAYS.forEach((day, idx) => {
        const dayData = data.days?.find(
          (d: any) => d.day_of_week === idx
        );
        if (dayData) {
          newSchedule[day] = {
            is_active: dayData.is_active,
            time_blocks: dayData.time_blocks.map((b: any) => ({
              id: b.id || generateId(),
              start_time: b.start_time,
              end_time: b.end_time,
              slot_duration_minutes: b.slot_duration_minutes || 30,
            })),
          };
        } else {
          newSchedule[day] = { is_active: false, time_blocks: [] };
        }
      });

      setSchedule(newSchedule);
      setExceptions(data.exceptions || []);
      setOverrides(data.overrides || []);
    } catch (error) {
      console.error("Failed to load availability:", error);
      // Initialize from empty
      const empty: Record<string, DaySchedule> = {};
      DAYS.forEach((d) => {
        empty[d] = { is_active: false, time_blocks: [] };
      });
      setSchedule(empty);
    } finally {
      setLoading(false);
    }
  }, [doctorId]);

  useEffect(() => {
    loadAvailability();
  }, [loadAvailability]);

  // === Weekly Schedule Handlers ===

  const toggleDay = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        is_active: !prev[day].is_active,
        time_blocks:
          prev[day].time_blocks.length === 0 && !prev[day].is_active
            ? [
                {
                  id: generateId(),
                  start_time: "09:00",
                  end_time: "17:00",
                  slot_duration_minutes: duration,
                },
              ]
            : prev[day].time_blocks,
      },
    }));
  };

  const addTimeBlock = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        time_blocks: [
          ...prev[day].time_blocks,
          {
            id: generateId(),
            start_time: "09:00",
            end_time: "17:00",
            slot_duration_minutes: duration,
          },
        ],
      },
    }));
  };

  const removeTimeBlock = (day: string, blockId: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        time_blocks: prev[day].time_blocks.filter((b) => b.id !== blockId),
      },
    }));
  };

  const updateTimeBlock = (
    day: string,
    blockId: string,
    field: keyof TimeBlock,
    value: string | number
  ) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        time_blocks: prev[day].time_blocks.map((b) =>
          b.id === blockId ? { ...b, [field]: value } : b
        ),
      },
    }));
  };

  const handleSaveWeekly = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const days = DAYS.map((day, idx) => ({
        day_of_week: idx,
        is_active: schedule[day]?.is_active ?? false,
        time_blocks: (schedule[day]?.time_blocks ?? []).map((b) => ({
          start_time: b.start_time,
          end_time: b.end_time,
          slot_duration_minutes: b.slot_duration_minutes,
        })),
      }));

      await updateWeeklyAvailability({
        days,
        appointment_duration: duration,
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error: any) {
      alert(error.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  // === Exception Handlers ===

  const handleAddException = async (
    date: string,
    reason: string
  ) => {
    try {
      await addException({
        exception_date: date,
        is_available: false,
        reason: reason || undefined,
      });
      await loadAvailability();
    } catch (error: any) {
      alert(error.message || "Failed to add exception");
    }
  };

  const handleRemoveException = async (exceptionId: string) => {
    try {
      await removeException(exceptionId);
      setExceptions((prev) => prev.filter((e) => e.id !== exceptionId));
    } catch (error: any) {
      alert(error.message || "Failed to remove exception");
    }
  };

  // === Override Handlers ===

  const handleAddOverride = async () => {
    if (!overrideDate) {
      alert("Please select a date");
      return;
    }
    try {
      await addScheduleOverride({
        override_date: overrideDate,
        start_time: overrideStart,
        end_time: overrideEnd,
        slot_duration_minutes: overrideDuration,
      });
      setOverrideDate("");
      await loadAvailability();
    } catch (error: any) {
      alert(error.message || "Failed to add override");
    }
  };

  const handleRemoveOverride = async (overrideId: string) => {
    try {
      await removeScheduleOverride(overrideId);
      setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    } catch (error: any) {
      alert(error.message || "Failed to remove override");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {(
          [
            { key: "weekly", label: "Weekly Schedule" },
            { key: "exceptions", label: "Leave & Holidays" },
            { key: "overrides", label: "Special Dates" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Weekly Schedule Tab */}
      {activeTab === "weekly" && (
        <div className="space-y-4">
          {/* Appointment Duration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Appointment Duration</CardTitle>
              <CardDescription>
                How long is each appointment slot?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:gap-3">
                {DURATION_OPTIONS.map((mins) => (
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

          {/* Day Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Available Days</CardTitle>
              <CardDescription>
                Select the days you see patients
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                {DAYS.map((day) => (
                  <Button
                    key={day}
                    variant={
                      schedule[day]?.is_active ? "medical" : "outline"
                    }
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

          {/* Time Blocks for Active Days */}
          {DAYS.filter((day) => schedule[day]?.is_active).map((day) => (
            <Card key={day}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{day}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addTimeBlock(day)}
                    className="h-8 gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span className="hidden sm:inline">Add Block</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {schedule[day].time_blocks.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No time blocks set. Click &quot;Add Block&quot; to add one.
                  </p>
                )}
                {schedule[day].time_blocks.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center gap-3 p-3 border rounded-xl bg-surface/50"
                  >
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Start
                        </Label>
                        <Input
                          type="time"
                          value={block.start_time}
                          onChange={(e) =>
                            updateTimeBlock(
                              day,
                              block.id,
                              "start_time",
                              e.target.value
                            )
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          End
                        </Label>
                        <Input
                          type="time"
                          value={block.end_time}
                          onChange={(e) =>
                            updateTimeBlock(
                              day,
                              block.id,
                              "end_time",
                              e.target.value
                            )
                          }
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label className="text-xs text-muted-foreground">
                          Slot
                        </Label>
                        <select
                          value={block.slot_duration_minutes}
                          onChange={(e) =>
                            updateTimeBlock(
                              day,
                              block.id,
                              "slot_duration_minutes",
                              parseInt(e.target.value)
                            )
                          }
                          className="w-full h-9 px-3 border rounded-lg bg-background text-sm"
                        >
                          {DURATION_OPTIONS.map((m) => (
                            <option key={m} value={m}>
                              {m} min
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTimeBlock(day, block.id)}
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {/* Save Button */}
          <div className="sticky bottom-4 z-10">
            <Button
              onClick={handleSaveWeekly}
              disabled={saving}
              variant="medical"
              size="lg"
              className="w-full shadow-lg"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Weekly Schedule
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Exceptions Tab */}
      {activeTab === "exceptions" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarOff className="h-5 w-5" />
                Leave & Holidays
              </CardTitle>
              <CardDescription>
                Mark dates when you&apos;re unavailable. Patients won&apos;t be
                able to book on these dates.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExceptionCalendar
                exceptions={exceptions}
                onAdd={handleAddException}
                onRemove={handleRemoveException}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Overrides Tab */}
      {activeTab === "overrides" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarPlus className="h-5 w-5" />
                Special Date Schedule
              </CardTitle>
              <CardDescription>
                Set a custom schedule for a specific date that overrides your
                weekly availability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add Override Form */}
              <div className="p-4 border rounded-xl space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Date
                    </Label>
                    <Input
                      type="date"
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        Start
                      </Label>
                      <Input
                        type="time"
                        value={overrideStart}
                        onChange={(e) => setOverrideStart(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        End
                      </Label>
                      <Input
                        type="time"
                        value={overrideEnd}
                        onChange={(e) => setOverrideEnd(e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs text-muted-foreground">
                      Slot Duration
                    </Label>
                    <select
                      value={overrideDuration}
                      onChange={(e) =>
                        setOverrideDuration(parseInt(e.target.value))
                      }
                      className="w-full h-9 px-3 border rounded-lg bg-background text-sm"
                    >
                      {DURATION_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m} minutes
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleAddOverride}
                    variant="medical"
                    size="sm"
                    className="mt-5"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              {/* Existing Overrides */}
              {overrides.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No special date schedules set.
                </p>
              ) : (
                <div className="space-y-2">
                  {overrides.map((override) => (
                    <div
                      key={override.id}
                      className="flex items-center justify-between p-3 border rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">
                          {override.override_date}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatTime12(override.start_time)} –{" "}
                          {formatTime12(override.end_time)}
                        </span>
                        <Badge variant="secondary">
                          {override.slot_duration_minutes}min slots
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOverride(override.id)}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
