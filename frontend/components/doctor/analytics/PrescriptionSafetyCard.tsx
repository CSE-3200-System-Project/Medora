"use client";

import { memo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { PrescriptionSafetyData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type PrescriptionSafetyCardProps = {
  data: PrescriptionSafetyData;
  isLoading?: boolean;
};

const safetyChartColors = ["#0360D9", "#1379B1", "#B91C1C"];

export const PrescriptionSafetyCard = memo(function PrescriptionSafetyCard({ data, isLoading = false }: PrescriptionSafetyCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-95 animate-pulse p-8")} />;
  }

  const chartData = [
    { label: "Safe Interactions", value: data.safe },
    { label: "Warnings flagged", value: data.warning },
    { label: "Blocked Interactions", value: data.blocked },
  ];

  return (
    <section className={cn(glassCardClass, "flex h-full flex-col p-8")}>
      <h3 className="mb-8 font-bold text-foreground">Prescription Safety Analysis</h3>

      <div className="flex h-full flex-col items-center gap-8 md:flex-row">
        <div className="relative h-48 w-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                innerRadius={62}
                outerRadius={86}
                stroke="none"
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell key={`safety-cell-${index}`} fill={safetyChartColors[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-bold text-foreground">
              {data.score.toFixed(1)}%
            </span>
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Safety Score</span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Safe Interactions</span>
            </div>
            <span className="text-sm font-bold text-foreground">{data.safe}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary-muted" />
              <span className="text-sm text-muted-foreground">Warnings flagged</span>
            </div>
            <span className="text-sm font-bold text-primary-muted">{data.warning}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/60 p-4">
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-destructive-muted" />
              <span className="text-sm text-muted-foreground">Blocked Interactions</span>
            </div>
            <span className="text-sm font-bold text-destructive-muted">{data.blocked}</span>
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              Override Rate: <span className="font-bold text-foreground">{data.overrideRate}%</span>
            </p>
            <span className="rounded px-2 py-1 text-xs font-bold text-emerald-600 uppercase bg-emerald-500/15 dark:text-emerald-400">Status: {data.status}</span>
          </div>
        </div>
      </div>
    </section>
  );
});
