"use client";

import { cn } from "@/lib/utils";
import type { DateOption } from "@/components/doctor-profile/types";

interface AppointmentDateSelectorProps {
  dates: DateOption[];
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

export function AppointmentDateSelector({
  dates,
  selectedDate,
  onSelectDate,
}: AppointmentDateSelectorProps) {
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {dates.map((date) => {
        const isSelected = selectedDate === date.key;

        return (
          <button
            key={date.key}
            type="button"
            disabled={date.disabled}
            onClick={() => onSelectDate(date.key)}
            className={cn(
              "min-w-[64px] rounded-xl border px-3 py-2.5 text-center transition-colors",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
              date.disabled && "cursor-not-allowed opacity-45",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/40"
            )}
          >
            <p className={cn("text-[10px] font-semibold uppercase", isSelected ? "text-primary-foreground/85" : "text-muted-foreground")}>
              {date.monthLabel}
            </p>
            <p className="text-xl font-bold leading-tight">{date.dayNumber}</p>
            <p className={cn("text-[11px] font-medium", isSelected ? "text-primary-foreground/85" : "text-muted-foreground")}>{date.helperLabel}</p>
          </button>
        );
      })}
    </div>
  );
}
