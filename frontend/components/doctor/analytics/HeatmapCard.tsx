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
  if (value >= 90) return "bg-[#0360D9]";
  if (value >= 70) return "bg-[#0360D9]/80";
  if (value >= 50) return "bg-[#0360D9]/65";
  if (value >= 30) return "bg-[#0360D9]/40";
  if (value >= 15) return "bg-[#0360D9]/25";
  return "bg-[#0360D9]/12";
}

export const HeatmapCard = memo(function HeatmapCard({ data, isLoading = false }: HeatmapCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-[270px] animate-pulse p-6")} />;
  }

  if (data.days.length === 0 || data.hours.length === 0) {
    return (
      <div className={cn(glassCardClass, "p-6")}>
        <h3 className="mb-3 font-[family-name:var(--font-manrope)] font-bold text-slate-900 dark:text-white">Volume Heatmap</h3>
        <p className="text-sm text-slate-600 dark:text-[#c2c6d6]">No heatmap data available.</p>
      </div>
    );
  }

  return (
    <div className={cn(glassCardClass, "space-y-4 p-6")}>
      <h3 className="font-[family-name:var(--font-manrope)] font-bold text-slate-900 dark:text-white">Volume Heatmap</h3>

      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-1 text-[9px] text-slate-500 dark:text-[#c2c6d6]">
          <span />
          {data.hours.map((hour) => (
            <span key={hour} className="text-center">{hour}</span>
          ))}
        </div>

        {data.days.map((day, dayIndex) => (
          <div key={day} className="grid grid-cols-12 items-center gap-1">
            <span className="text-[9px] text-slate-500 dark:text-[#c2c6d6]">{day}</span>
            {data.values[dayIndex]?.map((value, hourIndex) => (
              <span
                key={`${day}-${hourIndex}`}
                className={cn("aspect-square rounded-[2px]", intensityClass(value))}
                title={`${day} ${data.hours[hourIndex]}: ${value}%`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});
