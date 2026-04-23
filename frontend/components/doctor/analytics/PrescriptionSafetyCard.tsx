"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { PrescriptionSafetyData } from "@/components/doctor/analytics/types";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

type PrescriptionSafetyCardProps = {
  data: PrescriptionSafetyData;
  isLoading?: boolean;
};

const safetyChartColors = ["#0360D9", "#1379B1", "#B91C1C"];

export const PrescriptionSafetyCard = memo(function PrescriptionSafetyCard({ data, isLoading = false }: PrescriptionSafetyCardProps) {
  const option = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: "pie",
          radius: ["65%", "90%"],
          center: ["50%", "50%"],
          padAngle: 2,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderWidth: 0 },
          data: [
            { value: data.safe, name: "Safe", itemStyle: { color: safetyChartColors[0] } },
            { value: data.warning, name: "Warnings", itemStyle: { color: safetyChartColors[1] } },
            { value: data.blocked, name: "Blocked", itemStyle: { color: safetyChartColors[2] } },
          ],
          animationDuration: 600,
        },
      ],
    }),
    [data.safe, data.warning, data.blocked],
  );

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
      {/* Chart */}
      <div className="relative mx-auto h-40 w-40 shrink-0 sm:mx-0">
        <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
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
