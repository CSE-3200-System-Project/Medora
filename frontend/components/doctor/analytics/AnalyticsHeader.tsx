"use client";

import { useMemo } from "react";
import { Upload, Search } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import type { DateRangeOption } from "@/components/doctor/analytics/types";
import { cn } from "@/lib/utils";

type AnalyticsHeaderProps = {
  dateRange: DateRangeOption;
  comparePeriod: boolean;
  onDateRangeChange: (range: DateRangeOption) => void;
  onComparePeriodChange: (checked: boolean) => void;
};

const RANGE_OPTIONS: DateRangeOption[] = ["7d", "30d", "90d", "6mo", "1yr", "2yr"];

const RANGE_LABELS: Record<DateRangeOption, string> = {
  "7d": "7 Days",
  "30d": "30 Days",
  "90d": "90 Days",
  "6mo": "6 Months",
  "1yr": "1 Year",
  "2yr": "2 Years",
};

export function AnalyticsHeader({
  dateRange,
  comparePeriod,
  onDateRangeChange,
  onComparePeriodChange,
}: AnalyticsHeaderProps) {
  const rangeButtons = useMemo(
    () =>
      RANGE_OPTIONS.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onDateRangeChange(range)}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors",
            range === dateRange
              ? "bg-primary-light text-primary shadow-sm"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          {RANGE_LABELS[range]}
        </button>
      )),
    [dateRange, onDateRangeChange],
  );

  return (
    <header className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          Advanced Analytics
        </h1>
        <p className="max-w-2xl text-base md:text-lg text-muted-foreground">
          Deep insights into your clinical performance, workload, and outcomes
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-muted/60 p-2">
        <div className="flex overflow-hidden rounded-lg bg-background border border-border/50">{rangeButtons}</div>

        <div className="mx-2 h-8 w-px bg-border/70" />

        <label className="group flex cursor-pointer items-center gap-2">
          <Switch checked={comparePeriod} onCheckedChange={onComparePeriodChange} className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-border" />
          <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
            Compare Period
          </span>
        </label>

        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-muted"
        >
          <Upload className="h-4 w-4" />
          Export
        </button>
      </div>

      <div className="hidden items-center rounded-xl border border-border bg-background px-4 py-2 text-muted-foreground lg:flex">
        <Search className="mr-2 h-4 w-4" />
        <input
          type="text"
          placeholder="Search analytics..."
          className="w-48 border-none bg-transparent text-sm outline-none placeholder:text-current focus:ring-0"
        />
      </div>
    </header>
  );
}
