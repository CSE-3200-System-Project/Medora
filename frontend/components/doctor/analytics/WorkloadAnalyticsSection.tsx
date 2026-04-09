"use client";

import { memo } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { SafeChartContainer } from "@/components/doctor/analytics/SafeChartContainer";
import type { WorkloadPoint } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type WorkloadAnalyticsSectionProps = {
  chart: WorkloadPoint[];
  peakWindow: string;
  averagePatientsPerDay: string;
  burnoutRisk: string;
  isLoading?: boolean;
};

const WorkloadChart = memo(function WorkloadChart({ chart }: { chart: WorkloadPoint[] }) {
  return (
    <SafeChartContainer
      className="h-52 rounded-lg bg-muted/40 p-3 sm:h-56"
      minHeight={208}
      render={({ width, height }) => (
        <BarChart data={chart} barGap={6} width={width} height={height}>
          <CartesianGrid strokeDasharray="4 4" stroke="rgba(140,144,160,0.18)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: "#8c90a0", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#8c90a0", fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            cursor={{ fill: "rgba(176,198,255,0.12)" }}
            contentStyle={{
              background: "#161f34",
              border: "1px solid rgba(176,198,255,0.25)",
              borderRadius: "12px",
              color: "#d9e2fe",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="capacity" fill="#A8A8A8" radius={[6, 6, 0, 0]} maxBarSize={22} />
          <Bar dataKey="actual" fill="#0360D9" radius={[6, 6, 0, 0]} maxBarSize={22} />
        </BarChart>
      )}
    />
  );
});

export const WorkloadAnalyticsSection = memo(function WorkloadAnalyticsSection({
  chart,
  peakWindow,
  averagePatientsPerDay,
  burnoutRisk,
  isLoading = false,
}: WorkloadAnalyticsSectionProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-96 animate-pulse p-4 sm:p-6")} />;
  }

  if (chart.length === 0) {
    return (
      <section className={cn(glassCardClass, "p-5 sm:p-6")}>
        <h2 className="text-lg font-semibold text-foreground">Workload Analytics</h2>
        <p className="mt-2 text-sm text-muted-foreground">No workload data available.</p>
      </section>
    );
  }

  return (
    <section className={cn(glassCardClass, "flex h-full flex-col p-5 sm:p-6")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Workload Analytics</h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Actual
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground-muted" /> Capacity
          </span>
        </div>
      </div>

      <WorkloadChart chart={chart} />

      <div className="mt-auto grid grid-cols-3 gap-4 border-t border-border/60 pt-4 sm:pt-5">
        <div>
          <p className="text-xs font-medium text-muted-foreground">Peak workload</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{peakWindow}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Avg patients</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{averagePatientsPerDay}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">Burnout risk</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "text-lg font-semibold",
                burnoutRisk.toLowerCase() === "high"
                  ? "text-destructive-muted"
                  : burnoutRisk.toLowerCase() === "moderate"
                    ? "text-warning"
                    : "text-success-muted",
              )}
            >
              {burnoutRisk}
            </span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                burnoutRisk.toLowerCase() === "high"
                  ? "bg-destructive-muted"
                  : burnoutRisk.toLowerCase() === "moderate"
                    ? "bg-warning"
                    : "bg-success-muted",
              )}
            />
          </div>
        </div>
      </div>
    </section>
  );
});
