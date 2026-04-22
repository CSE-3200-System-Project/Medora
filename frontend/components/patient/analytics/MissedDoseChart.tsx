"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { EChartsOption } from "echarts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/client";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

export type MissedDosePoint = {
  label: string;
  missed: number;
};

type MissedDoseChartProps = {
  data: MissedDosePoint[];
};

export function MissedDoseChart({ data }: MissedDoseChartProps) {
  const tCommon = useT("common");

  const option = useMemo<EChartsOption>(
    () => ({
      grid: { top: 12, right: 8, bottom: 28, left: 28, containLabel: true },
      xAxis: {
        type: "category",
        data: data.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#8c90a0" },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: "#8c90a0" },
        splitLine: { lineStyle: { color: "rgba(148,163,184,0.25)", type: "dashed" } },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(22,31,52,0.95)",
        borderColor: "rgba(148,163,184,0.35)",
        borderWidth: 1,
        textStyle: { color: "#d9e2fe", fontSize: 12 },
      },
      series: [
        {
          type: "bar",
          data: data.map((d) => d.missed),
          itemStyle: { color: "#0360D9", borderRadius: [10, 10, 0, 0] },
          barMaxWidth: 22,
          animationDuration: 600,
        },
      ],
    }),
    [data],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-xl">{tCommon("analytics.missedDoseChart.title")}</CardTitle>
        <Badge variant="secondary" className="rounded-full">
          {tCommon("analytics.missedDoseChart.last30Days")}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ReactECharts option={option} style={{ height: "100%", width: "100%" }} />
        </div>
      </CardContent>
    </Card>
  );
}
