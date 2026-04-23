"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { RevenueData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

type RevenueChartCardProps = {
  data: RevenueData;
  isLoading?: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export const RevenueChartCard = memo(function RevenueChartCard({ data, isLoading = false }: RevenueChartCardProps) {
  const hasSeries = data.series.length > 0;

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 12, right: 12, bottom: 24, left: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: data.series.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#8c90a0" },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          fontSize: 11,
          color: "#8c90a0",
          formatter: (value: number) =>
            value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value}`,
        },
        splitLine: { lineStyle: { color: "rgba(140,144,160,0.18)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(22,31,52,0.95)",
        borderColor: "rgba(176,198,255,0.25)",
        borderWidth: 1,
        textStyle: { color: "#d9e2fe", fontSize: 12 },
        valueFormatter: (value) =>
          typeof value === "number" ? formatCurrency(value) : String(value ?? ""),
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "none",
          data: data.series.map((d) => d.value),
          lineStyle: { color: "#0360D9", width: 2.5 },
          itemStyle: { color: "#0360D9" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(3,96,217,0.35)" },
                { offset: 1, color: "rgba(3,96,217,0)" },
              ],
            },
          },
          animationDuration: 600,
        },
      ],
    }),
    [data.series],
  );

  if (isLoading) {
    return <div className={cn(glassCardClass, "h-96 animate-pulse p-4 sm:p-6")} />;
  }

  return (
    <section className={cn(glassCardClass, "flex h-full flex-col p-5 sm:p-6")}>
      <h3 className="mb-5 text-lg font-semibold text-foreground">Revenue Analysis</h3>

      <div className="mb-5 h-52 sm:h-56">
        {hasSeries ? (
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-border/60 bg-muted/25 text-sm text-muted-foreground">
            No revenue trend data available yet.
          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(data.total)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Pending</p>
          <p className="text-lg font-bold tabular-nums text-primary-muted">{formatCurrency(data.pending)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Avg / visit</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(data.avgPerVisit)}</p>
        </div>
      </div>
    </section>
  );
});
