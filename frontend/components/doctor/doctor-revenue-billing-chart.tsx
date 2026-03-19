"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type DoctorRevenueBillingChartProps = {
  labels: string[];
  billingTrend: number[];
  claimsTrend: number[];
};

export function DoctorRevenueBillingChart({
  labels,
  billingTrend,
  claimsTrend,
}: DoctorRevenueBillingChartProps) {
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
      animationDuration: 760,
      grid: {
        top: 20,
        right: 12,
        bottom: 34,
        left: 16,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(12, 34, 55, 0.97)" : "rgba(255, 255, 255, 0.98)",
        borderColor: isDark ? "rgba(92, 132, 171, 0.45)" : "rgba(3, 96, 217, 0.18)",
        borderWidth: 1,
        textStyle: { color: isDark ? "#e4efff" : "#14365f" },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: labels,
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
        splitNumber: 4,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: {
          lineStyle: {
            color: isDark ? "rgba(117, 157, 204, 0.18)" : "rgba(117, 157, 204, 0.22)",
          },
        },
      },
      series: [
        {
          name: "Billing Trends",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: {
            width: 3,
            color: "#0360D9",
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(3, 96, 217, 0.28)" },
                { offset: 1, color: "rgba(3, 96, 217, 0.03)" },
              ],
            },
          },
          data: billingTrend,
        },
        {
          name: "Claims Processed",
          type: "line",
          smooth: true,
          symbol: "none",
          lineStyle: {
            width: 2,
            type: "dashed",
            color: isDark ? "rgba(178, 200, 228, 0.7)" : "rgba(140, 160, 186, 0.82)",
          },
          data: claimsTrend,
        },
      ],
    }),
    [billingTrend, claimsTrend, isDark, labels],
  );

  return (
    <div className="h-72 w-full">
      <ReactECharts option={option} style={{ width: "100%", height: "100%" }} opts={{ renderer: "svg" }} />
    </div>
  );
}
