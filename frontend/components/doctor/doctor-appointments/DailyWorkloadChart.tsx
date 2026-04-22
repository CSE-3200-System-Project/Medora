"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

type DailyWorkloadChartProps = {
  data: Array<{ day: string; patients: number }>;
  averageLabel: string;
};

export function DailyWorkloadChart({ data, averageLabel }: DailyWorkloadChartProps) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 8, right: 8, bottom: 24, left: 28, containLabel: true },
      xAxis: {
        type: "category",
        data: data.map((d) => d.day),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#8c90a0" },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#8c90a0" },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(22,31,52,0.95)",
        borderColor: "rgba(176,198,255,0.25)",
        borderWidth: 1,
        textStyle: { color: "#d9e2fe", fontSize: 12 },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => d.patients),
          itemStyle: { color: "#0360D9", borderRadius: [10, 10, 0, 0] },
          barMaxWidth: 26,
          animationDuration: 600,
        },
      ],
    }),
    [data],
  );

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Daily Workload Distribution</CardTitle>
        <p className="text-xs text-muted-foreground">{averageLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  );
}
