"use client"

import dynamic from "next/dynamic"
import { ArrowRight } from "lucide-react"
import { useMemo } from "react"
import type { EChartsOption } from "echarts"
import { useTheme } from "next-themes"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false })

type HealthScoreCardProps = {
  score: number
  maxScore?: number
  title: string
  improvementMessage: string
  activityTitle: string
  nutritionTitle: string
  viewDetailsLabel: string
  activityLabel: string
  nutritionLabel: string
  statusLabel: string
}

export function HealthScoreCard({
  score,
  maxScore = 100,
  title,
  improvementMessage,
  activityTitle,
  nutritionTitle,
  viewDetailsLabel,
  activityLabel,
  nutritionLabel,
  statusLabel,
}: HealthScoreCardProps) {
  const { resolvedTheme } = useTheme()

  const gaugeOption = useMemo<EChartsOption>(() => {
    const clampedValue = Math.max(0, Math.min(maxScore, score))
    const isDark = resolvedTheme === "dark"

    return {
      series: [
        {
          type: "gauge",
          radius: "92%",
          center: ["50%", "50%"],
          startAngle: 90,
          endAngle: -270,
          progress: {
            show: true,
            roundCap: true,
            itemStyle: {
              color: "#0360D9",
            },
            width: 13,
          },
          pointer: { show: false },
          axisLine: {
            lineStyle: {
              width: 13,
              color: [[1, isDark ? "#334155" : "#E5E7EB"]],
            },
          },
          splitLine: { show: false },
          axisTick: { show: false },
          axisLabel: { show: false },
          anchor: { show: false },
          detail: {
            valueAnimation: true,
            formatter: `{value}`,
            offsetCenter: ["0%", "-4%"],
            color: isDark ? "#F1F5F9" : "#111827",
            fontSize: 46,
            fontWeight: 700,
          },
          title: {
            show: true,
            offsetCenter: ["0%", "30%"],
            color: isDark ? "#94A3B8" : "#6B7280",
            fontSize: 13,
            fontWeight: 500,
            formatter: `/ ${maxScore}`,
          },
          data: [{ value: clampedValue }],
        },
      ],
      animationDuration: 700,
    }
  }, [maxScore, resolvedTheme, score])

  return (
    <div className="h-full animate-fade-in-up card-hover">
      <Card className="h-full border-border/70 bg-card/95 shadow-sm">
        <CardHeader className="pb-1">
          <CardTitle className="text-xl text-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-[190px_1fr]">
            <div className="mx-auto h-46 w-46 animate-scale-in">
              <ReactECharts option={gaugeOption} style={{ width: "100%", height: "100%" }} />
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{improvementMessage}</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{activityTitle}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{activityLabel}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{nutritionTitle}</p>
                  <p className="mt-1 text-base font-semibold text-foreground">{nutritionLabel}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Badge variant="success" className="rounded-full px-3 py-1 text-[11px]">
                  {statusLabel}
                </Badge>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                >
                  {viewDetailsLabel}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
