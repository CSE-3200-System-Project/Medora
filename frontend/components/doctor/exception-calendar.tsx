"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CalendarOff,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExceptionData {
  id: string;
  exception_date: string;
  is_available: boolean;
  reason: string | null;
}

interface ExceptionCalendarProps {
  exceptions: ExceptionData[];
  onAdd: (date: string, reason: string) => Promise<void>;
  onRemove: (exceptionId: string) => Promise<void>;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function ExceptionCalendar({
  exceptions,
  onAdd,
  onRemove,
}: ExceptionCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);

  const exceptionDates = new Set(exceptions.map((e) => e.exception_date));

  // Calendar grid
  const firstDay = new Date(currentYear, currentMonth, 1);
  // Monday=0, Tuesday=1, ... Sunday=6
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const dateStr = (day: number) => {
    const m = (currentMonth + 1).toString().padStart(2, "0");
    const d = day.toString().padStart(2, "0");
    return `${currentYear}-${m}-${d}`;
  };

  const isPast = (day: number) => {
    const d = new Date(currentYear, currentMonth, day);
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return d < todayStart;
  };

  const handleDayClick = (day: number) => {
    if (isPast(day)) return;
    const ds = dateStr(day);
    if (exceptionDates.has(ds)) {
      // Already an exception — clicking will toggle selection for removal
      setSelectedDate(selectedDate === ds ? null : ds);
    } else {
      setSelectedDate(ds);
    }
  };

  const handleAdd = async () => {
    if (!selectedDate) return;
    setAdding(true);
    try {
      await onAdd(selectedDate, reason);
      setSelectedDate(null);
      setReason("");
    } catch {
      // Error handled by parent
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!selectedDate) return;
    const exc = exceptions.find((e) => e.exception_date === selectedDate);
    if (!exc) return;
    setAdding(true);
    try {
      await onRemove(exc.id);
      setSelectedDate(null);
    } catch {
      // Error handled by parent
    } finally {
      setAdding(false);
    }
  };

  const selectedIsException = selectedDate
    ? exceptionDates.has(selectedDate)
    : false;
  const selectedExceptionData = selectedDate
    ? exceptions.find((e) => e.exception_date === selectedDate)
    : null;

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-sm font-semibold">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </h3>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="h-10" />;
          }

          const ds = dateStr(day);
          const isException = exceptionDates.has(ds);
          const isSelected = selectedDate === ds;
          const past = isPast(day);
          const isToday =
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear();

          return (
            <button
              key={day}
              onClick={() => handleDayClick(day)}
              disabled={past}
              className={cn(
                "h-10 w-full rounded-lg text-sm font-medium transition-colors relative",
                past && "text-muted-foreground/40 cursor-not-allowed",
                !past && !isException && !isSelected && "hover:bg-muted",
                isException && !isSelected && "bg-destructive/10 text-destructive",
                isSelected && !isException && "bg-primary text-primary-foreground",
                isSelected && isException && "bg-destructive text-destructive-foreground",
                isToday && !isSelected && !isException && "ring-1 ring-primary"
              )}
            >
              {day}
              {isException && !isSelected && (
                <CalendarOff className="h-3 w-3 absolute bottom-0.5 right-0.5 text-destructive" />
              )}
            </button>
          );
        })}
      </div>

      {/* Action Panel */}
      {selectedDate && (
        <div className="p-4 border rounded-xl space-y-3 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2">
            <Badge variant={selectedIsException ? "destructive" : "outline"} className="font-mono">
              {selectedDate}
            </Badge>
            {selectedIsException && (
              <Badge variant="secondary">
                {selectedExceptionData?.reason || "Leave"}
              </Badge>
            )}
          </div>

          {selectedIsException ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This date is marked as unavailable.
              </p>
              <Button
                onClick={handleRemove}
                disabled={adding}
                variant="outline"
                size="sm"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Exception
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Reason (optional)
                </Label>
                <Input
                  placeholder="e.g., Personal leave, Holiday..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-9"
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={adding}
                variant="medical"
                size="sm"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Mark as Unavailable
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Exception List */}
      {exceptions.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-sm font-medium text-muted-foreground">
            Upcoming Leave Dates
          </h4>
          {exceptions
            .filter((e) => e.exception_date >= today.toISOString().split("T")[0])
            .sort((a, b) => a.exception_date.localeCompare(b.exception_date))
            .map((exc) => (
              <div
                key={exc.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
              >
                <div className="flex items-center gap-2">
                  <CalendarOff className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-mono">{exc.exception_date}</span>
                  {exc.reason && (
                    <span className="text-sm text-muted-foreground">
                      — {exc.reason}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(exc.id)}
                  className="h-7 w-7 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
