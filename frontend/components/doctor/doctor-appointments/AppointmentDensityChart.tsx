"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

type AppointmentDensityChartProps = {
  data: Array<{ time: string; density: number }>;
  deltaLabel: string;
};

export function AppointmentDensityChart({ data, deltaLabel }: AppointmentDensityChartProps) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 16, right: 8, bottom: 24, left: 16, containLabel: true },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((d) => d.time),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#8c90a0" },
      },
      yAxis: {
        type: "value",
        show: false,
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
          type: "line",
          smooth: true,
          symbol: "none",
          data: data.map((d) => d.density),
          lineStyle: { color: "#0360D9", width: 3 },
          itemStyle: { color: "#0360D9" },
          animationDuration: 600,
        },
      ],
    }),
    [data],
  );

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Appointment Density</CardTitle>
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{deltaLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  );
}
