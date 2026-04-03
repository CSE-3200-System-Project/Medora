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
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            range === dateRange
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {RANGE_LABELS[range]}
        </button>
      )),
    [dateRange, onDateRangeChange],
  );

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Advanced Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground sm:text-base">
            Clinical performance, workload, and outcomes
          </p>
        </div>

        <label className="hidden items-center rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground lg:flex lg:w-64">
          <Search className="mr-2 h-4 w-4 shrink-0" />
          <input
            type="text"
            placeholder="Search analytics..."
            className="w-full border-none bg-transparent text-sm outline-none placeholder:text-current focus:ring-0"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border/50 bg-background p-1">
          {rangeButtons}
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <Switch
            checked={comparePeriod}
            onCheckedChange={onComparePeriodChange}
            className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-border"
          />
          <span className="text-sm font-medium text-muted-foreground">Compare</span>
        </label>

        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-muted"
        >
          <Upload className="h-3.5 w-3.5" />
          Export
        </button>
      </div>

      <label className="flex items-center rounded-lg border border-border bg-background px-3 py-2 text-muted-foreground lg:hidden">
        <Search className="mr-2 h-4 w-4 shrink-0" />
        <input
          type="text"
          placeholder="Search analytics..."
          className="w-full border-none bg-transparent text-sm outline-none placeholder:text-current focus:ring-0"
        />
      </label>
    </header>
  );
}
