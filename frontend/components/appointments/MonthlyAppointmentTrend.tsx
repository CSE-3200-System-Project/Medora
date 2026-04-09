"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { useT } from "@/i18n/client";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface MonthStat {
  month: string;
  value: number;
  isCurrent?: boolean;
}

interface MonthlyAppointmentTrendProps {
  stats: MonthStat[];
}

export function MonthlyAppointmentTrend({ stats }: MonthlyAppointmentTrendProps) {
  const tCommon = useT("common");
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

  const option = React.useMemo(
    () => ({
      animationDuration: 700,
      grid: { left: 16, right: 12, top: 18, bottom: 28, containLabel: true },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: isDark ? "rgba(22, 30, 45, 0.96)" : "rgba(237, 245, 255, 0.98)",
        borderColor: isDark ? "rgba(104, 123, 154, 0.35)" : "rgba(3, 96, 217, 0.18)",
        borderWidth: 1,
        textStyle: { color: isDark ? "#d8e6ff" : "#1e3a63" },
      },
      xAxis: {
        type: "category",
        data: stats.map((item) => item.month),
        axisLine: { lineStyle: { color: isDark ? "#3e4f69" : "#c3d3eb" } },
        axisTick: { show: false },
        axisLabel: { color: isDark ? "#9eb5d8" : "#5a7299", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: isDark ? "#2c3b53" : "#d6e2f2" } },
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
      },
      series: [
        {
          type: "bar",
          barWidth: "42%",
          data: stats.map((item) => ({
            value: item.value,
            itemStyle: {
              color: item.isCurrent ? "#0360D9" : isDark ? "#4f6fa8" : "#bfd6ff",
              borderRadius: [8, 8, 4, 4],
            },
          })),
          emphasis: {
            itemStyle: {
              color: "#0C71F2",
              shadowBlur: 10,
              shadowColor: "rgba(3, 96, 217, 0.25)",
            },
          },
        },
      ],
    }),
    [isDark, stats],
  );

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-6 h-full">
      <h3 className="text-lg font-semibold text-foreground">{tCommon("patientAppointments.monthlyTrend.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{tCommon("patientAppointments.monthlyTrend.subtitle")}</p>
      <div className="mt-4 h-55">
        <ReactECharts option={option} style={{ width: "100%", height: "100%" }} />
      </div>
    </Card>
  );
}
