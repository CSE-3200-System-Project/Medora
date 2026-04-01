"use client";

import { memo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { WorkloadPoint } from "@/components/doctor/analytics/types";
import { glassCardClass, sectionTitleClass } from "@/components/doctor/analytics/shared";
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
    <div className="h-64 rounded-xl bg-muted/50 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chart} barGap={8}>
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
          <Bar dataKey="capacity" fill="#A8A8A8" radius={[8, 8, 0, 0]} maxBarSize={24} />
          <Bar dataKey="actual" fill="#0360D9" radius={[8, 8, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
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
    return <div className={cn(glassCardClass, "h-125 animate-pulse p-8")} />;
  }

  if (chart.length === 0) {
    return (
      <section className={cn(glassCardClass, "p-8")}>
        <h2 className={sectionTitleClass("mb-4")}>Workload Analytics</h2>
        <p className="text-sm text-muted-foreground">No workload data available.</p>
      </section>
    );
  }

  return (
    <section className={cn(glassCardClass, "relative space-y-8 overflow-hidden p-8")}>
      <div className="flex items-center justify-between gap-4">
        <h2 className={sectionTitleClass()}>Workload Analytics</h2>
        <div className="flex gap-4">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-3 w-3 rounded-full bg-primary" /> Actual
          </span>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="h-3 w-3 rounded-full bg-foreground-muted" /> Capacity
          </span>
        </div>
      </div>

      <WorkloadChart chart={chart} />

      <div className="grid grid-cols-1 gap-6 border-t border-border/80 pt-6 md:grid-cols-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Peak workload</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{peakWindow}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Average patients</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{averagePatientsPerDay}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Burnout risk</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-2xl font-semibold text-destructive-muted">{burnoutRisk}</span>
            <span className="h-2 w-2 rounded-full bg-destructive-muted" />
          </div>
        </div>
      </div>
    </section>
  );
});
