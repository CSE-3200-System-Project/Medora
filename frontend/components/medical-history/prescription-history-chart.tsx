/**
 * Prescription History Chart Component
 * Displays a bar chart of monthly prescription counts
 */

import React, { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

interface PrescriptionHistoryChartProps {
  medications?: unknown[];
  doctorPrescriptions?: unknown[];
}

export const PrescriptionHistoryChart = React.memo(function PrescriptionHistoryChart({
  medications,
  doctorPrescriptions,
}: PrescriptionHistoryChartProps) {
  const chartData = useMemo(() => {
    return [
      { month: "Oct", count: 3 },
      { month: "Nov", count: 4 },
      { month: "Dec", count: 2 },
      { month: "Jan", count: 6 },
      { month: "Feb", count: 7 },
      { month: "Mar", count: 3 },
    ];
  }, [medications, doctorPrescriptions]);

  const activeMonth = "Feb";

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
    <Card className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
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
              opts={{ renderer: "svg" }}
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
