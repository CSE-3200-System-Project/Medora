/**
 * Prescription History Chart Component
 * Displays a bar chart of monthly prescription counts
 */

import React, { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

interface PrescriptionHistoryChartProps {
  medications?: unknown[];
  doctorPrescriptions?: unknown[];
}

export const PrescriptionHistoryChart = React.memo(function PrescriptionHistoryChart(
  { medications = [], doctorPrescriptions = [] }: PrescriptionHistoryChartProps,
) {
  const chartData = useMemo(
    () => buildMonthlyPrescriptionCounts([...medications, ...doctorPrescriptions]),
    [doctorPrescriptions, medications],
  );

  const activeMonth = new Date().toLocaleString("en-US", { month: "short" });

  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderColor: "#ccc",
        textStyle: {
          color: "#fff",
        },
        axisPointer: {
          type: "shadow",
        },
      },
      grid: {
        left: "10%",
        right: "10%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: chartData.map((d) => d.month),
        axisLabel: {
          color: "#6B7280",
          fontSize: 12,
        },
        axisLine: {
          lineStyle: {
            color: "#E5E7EB",
          },
        },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          color: "#6B7280",
          fontSize: 12,
        },
        splitLine: {
          lineStyle: {
            color: "#F3F4F6",
          },
        },
      },
      series: [
        {
          data: chartData.map((d) => ({
            value: d.count,
            itemStyle: {
              color: d.month === activeMonth ? "#0360D9" : "#DBEAFE",
            },
          })),
          type: "bar",
          itemStyle: {
            borderRadius: [4, 4, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: "#025EB8",
            },
          },
        },
      ],
    }),
    [activeMonth, chartData]
  );

  return (
    <Card className="bg-card dark:bg-background rounded-2xl p-6 border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary" />
            Prescription History
          </CardTitle>
          <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-1 rounded">Monthly</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {chartData.some((d) => d.count > 0) ? (
          <div className="h-56 w-full">
            <ReactECharts
              option={option}
              style={{ height: "100%", width: "100%" }}
             
            />
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-center">
            <div>
              <p className="text-sm text-muted-foreground">No prescription data available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

PrescriptionHistoryChart.displayName = "PrescriptionHistoryChart";

function buildMonthlyPrescriptionCounts(records: unknown[]) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: date.toLocaleString("en-US", { month: "short" }),
      count: 0,
    };
  });
  const byMonth = new Map(months.map((month) => [month.key, month]));

  records.forEach((record) => {
    const date = getPrescriptionDate(record);
    if (!date) return;
    const month = byMonth.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (month) month.count += 1;
  });

  return months.map(({ month, count }) => ({ month, count }));
}

function getPrescriptionDate(record: unknown): Date | null {
  if (!record || typeof record !== "object") return null;
  const candidate = record as Record<string, unknown>;
  const rawDate = candidate.created_at ?? candidate.prescribed_date ?? candidate.started_date ?? candidate.date;
  if (typeof rawDate !== "string") return null;
  const date = new Date(rawDate);
  return Number.isNaN(date.getTime()) ? null : date;
}

