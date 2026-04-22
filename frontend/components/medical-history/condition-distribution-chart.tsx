/**
 * Condition Distribution Chart Component
 * Displays a donut/pie chart of patient's chronic conditions
 */

import React, { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

interface ConditionDistributionChartProps {
  patientData?: Record<string, unknown>;
}

export const ConditionDistributionChart = React.memo(function ConditionDistributionChart({
  patientData,
}: ConditionDistributionChartProps) {
  const chartData = useMemo(() => {
    return [
      { name: "Hypertension", value: 40, color: "#0360D9" },
      { name: "Diabetes", value: 25, color: "#10B981" },
      { name: "Thyroid", value: 15, color: "#F59E0B" },
      { name: "Other", value: 20, color: "#CBD5E1" },
    ];
  }, [patientData]);

  const totalActive = 5;

  const option = useMemo<EChartsOption>(
    () => ({
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        borderColor: "#ccc",
        textStyle: {
          color: "#fff",
        },
      },
      graphic: [
        {
          type: "text",
          left: "center",
          top: "44%",
          style: {
            text: `${totalActive}`,
            fill: "#0f172a",
            fontSize: 28,
            fontWeight: 700,
            textAlign: "center",
          },
        },
        {
          type: "text",
          left: "center",
          top: "58%",
          style: {
            text: "TOTAL ACTIVE",
            fill: "#64748b",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.2,
            textAlign: "center",
          },
        },
      ],
      series: [
        {
          name: "Conditions",
          type: "pie",
          radius: ["56%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: [4, 4],
            borderColor: "#fff",
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: "bold",
            },
          },
          labelLine: {
            show: false,
          },
          data: chartData.map((item) => ({
            value: item.value,
            name: item.name,
            itemStyle: {
              color: item.color,
            },
          })),
        },
      ],
    }),
    [chartData, totalActive]
  );

  return (
    <Card className="bg-card dark:bg-background rounded-2xl p-6 border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="p-0 pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          Condition Distribution
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {chartData.length > 0 ? (
          <>
            <div className="h-56 w-full">
              <ReactECharts
                option={option}
                style={{ height: "100%", width: "100%" }}
               
              />
            </div>
            <ul className="mt-4 space-y-2">
              {chartData.map((item) => (
                <li key={item.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground dark:text-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.name}
                  </span>
                  <span className="font-semibold text-foreground dark:text-foreground">{item.value}%</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="h-64 flex items-center justify-center text-center">
            <div>
              <p className="text-sm text-muted-foreground">No condition data available</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

ConditionDistributionChart.displayName = "ConditionDistributionChart";

