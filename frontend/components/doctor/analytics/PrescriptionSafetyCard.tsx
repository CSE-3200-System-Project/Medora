"use client";

import { memo } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { SafeChartContainer } from "@/components/doctor/analytics/SafeChartContainer";
import type { PrescriptionSafetyData } from "@/components/doctor/analytics/types";

type PrescriptionSafetyCardProps = {
  data: PrescriptionSafetyData;
  isLoading?: boolean;
};

const safetyChartColors = ["#0360D9", "#1379B1", "#B91C1C"];

export const PrescriptionSafetyCard = memo(function PrescriptionSafetyCard({ data, isLoading = false }: PrescriptionSafetyCardProps) {
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  const chartData = [
    { label: "Safe", value: data.safe },
    { label: "Warnings", value: data.warning },
    { label: "Blocked", value: data.blocked },
  ];

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
      {/* Chart */}
      <div className="relative mx-auto h-40 w-40 shrink-0 sm:mx-0">
        <SafeChartContainer
          className="h-full w-full"
          minHeight={160}
          render={({ width, height }) => (
            <PieChart width={width} height={height}>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={52}
                outerRadius={72}
                stroke="none"
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell key={`safety-cell-${index}`} fill={safetyChartColors[index]} />
                ))}
              </Pie>
            </PieChart>
          )}
        />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tabular-nums text-foreground">{data.score.toFixed(1)}%</span>
          <span className="text-xs font-medium text-muted-foreground">Safety score</span>
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex-1 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Safe Interactions</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-foreground">{data.safe}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary-muted" />
            <span className="text-sm text-muted-foreground">Warnings flagged</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-primary-muted">{data.warning}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive-muted" />
            <span className="text-sm text-muted-foreground">Blocked</span>
          </div>
          <span className="text-sm font-semibold tabular-nums text-destructive-muted">{data.blocked}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <p className="text-sm text-muted-foreground">
            Override rate: <span className="font-semibold tabular-nums text-foreground">{data.overrideRate}%</span>
          </p>
          <span className="rounded-md bg-emerald-500/12 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            {data.status}
          </span>
        </div>
      </div>
    </div>
  );
});
