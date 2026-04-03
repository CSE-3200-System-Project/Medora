"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface SpecialtyStat {
  name: string;
  value: number;
}

interface SpecialtyDistributionChartProps {
  stats: SpecialtyStat[];
}

const SPECIALTY_COLORS: Record<string, string> = {
  "General Practice": "#0360D9",
  Cardiology: "#2563EB",
  Dermatology: "#059669",
  Neurology: "#D97706",
};

function colorFor(name: string) {
  return SPECIALTY_COLORS[name] || "#1D4ED8";
}

export function SpecialtyDistributionChart({ stats }: SpecialtyDistributionChartProps) {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const readDark = () => setIsDark(document.documentElement.classList.contains("dark"));
    readDark();

    const observer = new MutationObserver(readDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const maxValue = React.useMemo(() => Math.max(1, ...stats.map((item) => item.value)), [stats]);

  const bubblePoints = React.useMemo(
    () =>
      stats.map((item, index) => {
        const horizontalPositions = [18, 40, 62, 84, 30, 74];
        const verticalPositions = [45, 30, 50, 35, 60, 62];
        const lengthScale = Math.min(18, Math.max(0, item.name.length - 10));
        const valueScale = Math.round((item.value / maxValue) * 24);
        const radius = 28 + valueScale + lengthScale;

        return {
          value: [horizontalPositions[index % horizontalPositions.length], verticalPositions[index % verticalPositions.length], radius, item.value],
          name: item.name,
          itemStyle: {
            color: colorFor(item.name),
            opacity: isDark ? 0.24 : 0.14,
            borderColor: colorFor(item.name),
            borderWidth: 2,
          },
          label: {
            show: true,
            formatter: `${item.name}\n${item.value} Visits`,
            color: isDark ? "#d8e6ff" : "#17345a",
            fontSize: 10,
            fontWeight: 600,
            lineHeight: 14,
          },
        };
      }),
    [stats, maxValue, isDark],
  );

  const option = React.useMemo(
    () => ({
      animationDuration: 700,
      xAxis: { min: 0, max: 100, show: false },
      yAxis: { min: 0, max: 100, show: false },
      grid: { left: 0, right: 0, top: 0, bottom: 0 },
      tooltip: {
        trigger: "item",
        backgroundColor: isDark ? "rgba(22, 30, 45, 0.96)" : "rgba(237, 245, 255, 0.98)",
        borderColor: isDark ? "rgba(104, 123, 154, 0.35)" : "rgba(3, 96, 217, 0.18)",
        borderWidth: 1,
        textStyle: { color: isDark ? "#d8e6ff" : "#1e3a63" },
        formatter: (params: { data: { name: string; value: [number, number, number, number] } }) =>
          `${params.data.name}: ${params.data.value[3]} visits`,
      },
      series: [
        {
          type: "scatter",
          symbolSize: (value: [number, number, number]) => value[2],
          data: bubblePoints,
          emphasis: {
            scale: true,
          },
        },
      ],
    }),
    [bubblePoints, isDark],
  );

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-6 h-full">
      <h3 className="text-lg font-semibold text-foreground">Specialty Distribution</h3>
      <p className="mt-1 text-sm text-muted-foreground">Frequency of specialist interactions</p>

      <div className="mt-4 h-55">
        <ReactECharts option={option} style={{ width: "100%", height: "100%" }} notMerge lazyUpdate />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {stats.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(item.name) }} />
            {item.name}
          </span>
        ))}
      </div>
    </Card>
  );
}
