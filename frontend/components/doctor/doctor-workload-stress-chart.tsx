"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export type WsiWeekPoint = {
  week: string;
  appointments: number;
  noShows: number;
  pendingTasks: number;
  overdueTasks: number;
  wsi: number;
};

type DoctorWorkloadStressChartProps = {
  data: WsiWeekPoint[];
};

type TooltipAxisParam = {
  dataIndex: number;
};

function getLoadLevel(score: number) {
  if (score >= 72) return "High Load";
  if (score >= 50) return "Moderate Load";
  return "Low Load";
}

export function DoctorWorkloadStressChart({ data }: DoctorWorkloadStressChartProps) {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const readDarkMode = () => setIsDark(document.documentElement.classList.contains("dark"));
    readDarkMode();

    const observer = new MutationObserver(readDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const option = React.useMemo<EChartsOption>(
    () => ({
      animationDuration: 750,
      grid: {
        top: 24,
        right: 12,
        bottom: 34,
        left: 16,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          lineStyle: {
            color: isDark ? "rgba(125, 172, 235, 0.45)" : "rgba(3, 96, 217, 0.28)",
            width: 1,
          },
        },
        backgroundColor: isDark ? "rgba(12, 34, 55, 0.97)" : "rgba(255, 255, 255, 0.98)",
        borderColor: isDark ? "rgba(92, 132, 171, 0.45)" : "rgba(3, 96, 217, 0.18)",
        borderWidth: 1,
        textStyle: { color: isDark ? "#e4efff" : "#14365f" },
        padding: 12,
        formatter: (params: unknown) => {
          const axisParams = Array.isArray(params) ? (params as TooltipAxisParam[]) : [];
          const point = axisParams[0];
          if (!point) return "";
          const target = data[point.dataIndex];
          if (!target) return "";
          return [
            `<div style="font-weight:700; margin-bottom:8px;">${target.week}</div>`,
            `<div>Appointments: <b>${target.appointments}</b></div>`,
            `<div>No-shows: <b>${target.noShows}</b></div>`,
            `<div>Pending: <b>${target.pendingTasks}</b></div>`,
            `<div>Overdue: <b>${target.overdueTasks}</b></div>`,
            `<div style="margin-top:8px; font-weight:700;">WSI: ${target.wsi} (${getLoadLevel(target.wsi)})</div>`,
          ].join("");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((item) => item.week),
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: isDark ? "#c2d7f3" : "#6e83a7",
          fontSize: 11,
          fontWeight: 600,
        },
      },
      yAxis: {
        type: "value",
        min: 40,
        max: 100,
        splitNumber: 4,
        axisLabel: {
          color: isDark ? "#9bb8de" : "#86a0c2",
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: isDark ? "rgba(117, 157, 204, 0.18)" : "rgba(117, 157, 204, 0.22)",
          },
        },
        axisLine: { show: false },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "none",
          data: data.map((item) => item.wsi),
          lineStyle: {
            color: "#0360D9",
            width: 3,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(3, 96, 217, 0.26)" },
                { offset: 1, color: "rgba(3, 96, 217, 0.02)" },
              ],
            },
          },
        },
      ],
    }),
    [data, isDark],
  );

  return (
    <div className="h-72 w-full">
      <ReactECharts option={option} style={{ height: "100%", width: "100%" }} opts={{ renderer: "svg" }} />
    </div>
  );
}
