/**
 * Timeline Filters Component
 * Compact filter row with year selector and upcoming toggle
 */

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CalendarDays, ChevronDown } from "lucide-react";

interface TimelineFiltersProps {
  selectedYear: string;
  years: string[];
  selectedYearEventCount: number;
  upcomingOnly: boolean;
  onYearChange: (year: string) => void;
  onUpcomingChange: (value: boolean) => void;
}

export const TimelineFilters = React.memo(function TimelineFilters({
  selectedYear,
  years,
  selectedYearEventCount,
  upcomingOnly,
  onYearChange,
  onUpcomingChange,
}: TimelineFiltersProps) {
  const yearLabel = selectedYear === "all" ? "All Years" : selectedYear;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/70 bg-background p-2 shadow-xs">
      <div className="relative w-full sm:min-w-40 sm:flex-1">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={selectedYear}
          onChange={(event) => onYearChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-border bg-background pl-9 pr-8 text-sm font-medium text-foreground outline-hidden focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Years</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <Button
        variant={!upcomingOnly ? "default" : "outline"}
        size="sm"
        onClick={() => onUpcomingChange(false)}
        className="h-11 flex-1 rounded-xl px-4 sm:h-10 sm:flex-none"
      >
        All Events
      </Button>

      <Button
        variant={upcomingOnly ? "default" : "outline"}
        size="sm"
        onClick={() => onUpcomingChange(!upcomingOnly)}
        className="h-11 flex-1 rounded-xl px-4 sm:h-10 sm:flex-none"
      >
        <Clock className="mr-2 h-4 w-4" />
        Upcoming Events
      </Button>

      <Badge variant="outline" className="h-11 w-full justify-center rounded-xl px-4 text-sm font-semibold text-muted-foreground sm:h-10 sm:w-auto">
        {yearLabel} • {selectedYearEventCount} events
      </Badge>
    </div>
  );
});

TimelineFilters.displayName = "TimelineFilters";
