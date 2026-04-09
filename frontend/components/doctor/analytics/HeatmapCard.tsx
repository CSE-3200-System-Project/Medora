"use client";

import { memo } from "react";

import type { HeatmapData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type HeatmapCardProps = {
  data: HeatmapData;
  isLoading?: boolean;
};

function intensityClass(value: number): string {
  if (value >= 90) return "bg-primary";
  if (value >= 70) return "bg-primary/80";
  if (value >= 50) return "bg-primary/60";
  if (value >= 30) return "bg-primary/40";
  if (value >= 15) return "bg-primary/25";
  return "bg-primary/10";
}

export const HeatmapCard = memo(function HeatmapCard({ data, isLoading = false }: HeatmapCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-56 animate-pulse p-4 sm:p-6")} />;
  }

  if (data.days.length === 0 || data.hours.length === 0) {
    return (
      <div className={cn(glassCardClass, "p-5 sm:p-6")}>
        <h3 className="mb-3 text-lg font-semibold text-foreground">Volume Heatmap</h3>
        <p className="text-sm text-muted-foreground">No heatmap data available.</p>
      </div>
    );
  }

  const colCount = data.hours.length + 1;

  return (
    <div className={cn(glassCardClass, "p-5 sm:p-6")}>
      <h3 className="mb-4 text-lg font-semibold text-foreground">Volume Heatmap</h3>

      <div className="overflow-x-auto no-scrollbar">
        <div style={{ minWidth: `${colCount * 2.2}rem` }}>
          {/* Hour labels */}
          <div
            className="mb-1 grid gap-1"
            style={{ gridTemplateColumns: `3rem repeat(${data.hours.length}, minmax(0, 1fr))` }}
          >
            <span />
            {data.hours.map((hour) => (
              <span key={hour} className="text-center text-[10px] leading-tight text-muted-foreground">{hour}</span>
            ))}
          </div>

          {/* Day rows */}
          {data.days.map((day, dayIndex) => (
            <div
              key={day}
              className="mb-1 grid items-center gap-1"
              style={{ gridTemplateColumns: `3rem repeat(${data.hours.length}, minmax(0, 1fr))` }}
            >
              <span className="text-[10px] font-medium text-muted-foreground">{day}</span>
              {data.values[dayIndex]?.map((value, hourIndex) => (
                <span
                  key={`${day}-${hourIndex}`}
                  className={cn("aspect-square rounded-sm", intensityClass(value))}
                  title={`${day} ${data.hours[hourIndex]}: ${value}%`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
