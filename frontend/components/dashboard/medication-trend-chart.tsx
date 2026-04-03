"use client"

import dynamic from "next/dynamic"
import { useMemo } from "react"
import type { EChartsOption } from "echarts"
import { useTheme } from "next-themes"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })

type MedicationTrendChartProps = {
  values: number[]
  labels: string[]
  adherenceRate: number
  deltaPercent: number
}

export function MedicationTrendChart({
  values,
  labels,
  adherenceRate,
  deltaPercent,
}: MedicationTrendChartProps) {
  const { resolvedTheme } = useTheme()

  const chartOption = useMemo<EChartsOption>(() => {
    const isDark = resolvedTheme === "dark"
    const highlightIndex = values.length - 1

    return {
      grid: {
        top: 16,
        right: 8,
        bottom: 26,
        left: 8,
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: labels,
        axisTick: { show: false },
        axisLine: { show: false },
        axisLabel: {
          color: isDark ? "#94A3B8" : "#9CA3AF",
          fontSize: 10,
          margin: 12,
        },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 100,
        splitNumber: 4,
        axisLabel: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          lineStyle: {
            color: isDark ? "#334155" : "#F3F4F6",
          },
        },
      },
      series: [
        {
          type: "bar",
          data: values.map((value, index) => ({
            value,
            itemStyle: {
              color: index === highlightIndex ? "#0360D9" : isDark ? "#64748B" : "#CBD5E1",
              borderRadius: [6, 6, 0, 0],
            },
          })),
          barWidth: "70%",
          animationDuration: 700,
        },
      ],
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "#0F172A" : "#111827",
        borderWidth: 0,
        textStyle: { color: "#F9FAFB" },
      },
    }
  }, [labels, resolvedTheme, values])

  const deltaLabel = deltaPercent > 0 ? `+${deltaPercent}%` : `${deltaPercent}%`

  return (
    <div className="h-full animate-fade-in-up card-hover">
      <Card className="h-full border-border/70 bg-card/95 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-foreground">Medication Trend</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Last 7 days adherence</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">{adherenceRate}%</p>
              <p className="text-sm font-medium text-success-muted">{deltaLabel}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-42.5 w-full animate-fade-in-up delay-3">
            <ReactECharts option={chartOption} style={{ width: "100%", height: "100%" }} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
