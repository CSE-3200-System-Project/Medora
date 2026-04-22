"use client"

import dynamic from "next/dynamic"
import { ArrowRight, CheckCircle2, AlertCircle, Circle, Info } from "lucide-react"
import { useMemo, useState } from "react"
import type { EChartsOption } from "echarts"
import { useTheme } from "next-themes"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type {
  PatientDashboardBMI,
  PatientDashboardScoreBreakdown,
} from "@/lib/patient-dashboard-actions"

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
  breakdown?: PatientDashboardScoreBreakdown | null
  bmi?: PatientDashboardBMI | null
  chronicConditions?: string[]
  activeMedicationsCount?: number
}

const statusIcon = {
  good: CheckCircle2,
  warning: AlertCircle,
  missing: Circle,
} as const

const statusColor = {
  good: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  missing: "text-muted-foreground",
} as const

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
  breakdown,
  bmi,
  chronicConditions = [],
  activeMedicationsCount = 0,
}: HealthScoreCardProps) {
  const { resolvedTheme } = useTheme()
  const [open, setOpen] = useState(false)

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
              <p className="text-sm text-muted-foreground">{breakdown?.summary || improvementMessage}</p>

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
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setOpen(true)
                      }}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
                    >
                      {viewDetailsLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-themed">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Info className="h-5 w-5 text-primary" />
                        How your health score is calculated
                      </DialogTitle>
                      <DialogDescription>
                        Your score combines logged metrics, adherence, body composition, and chronic condition load.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="mt-2 space-y-4">
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-foreground">{score}</span>
                          <span className="text-sm text-muted-foreground">/ {maxScore}</span>
                        </div>
                        {breakdown?.summary ? (
                          <p className="mt-2 text-sm text-muted-foreground">{breakdown.summary}</p>
                        ) : null}
                      </div>

                      {(bmi?.value || chronicConditions.length > 0 || activeMedicationsCount > 0) && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-border bg-card p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BMI</p>
                            <p className="mt-1 text-lg font-semibold text-foreground">
                              {bmi?.value ? bmi.value.toFixed(1) : "—"}
                            </p>
                            <p className="text-xs text-muted-foreground">{bmi?.category || "Add height & weight"}</p>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Chronic conditions
                            </p>
                            <p className="mt-1 text-lg font-semibold text-foreground">{chronicConditions.length}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {chronicConditions.slice(0, 3).join(", ") || "None recorded"}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border bg-card p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              Active medications
                            </p>
                            <p className="mt-1 text-lg font-semibold text-foreground">{activeMedicationsCount}</p>
                            <p className="text-xs text-muted-foreground">On your profile</p>
                          </div>
                        </div>
                      )}

                      {breakdown?.factors && breakdown.factors.length > 0 && (
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-foreground">Score breakdown</h4>
                          <div className="space-y-2">
                            {breakdown.factors.map((factor) => {
                              const Icon = statusIcon[factor.status] ?? Circle
                              const percent = Math.round((factor.points / Math.max(1, factor.max_points)) * 100)
                              return (
                                <div
                                  key={factor.label}
                                  className="rounded-lg border border-border bg-card p-3"
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <Icon className={`h-4 w-4 ${statusColor[factor.status] ?? ""}`} />
                                      <span className="text-sm font-medium text-foreground">{factor.label}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {factor.points}/{factor.max_points}
                                    </span>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className="h-full rounded-full bg-primary transition-all"
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                  <p className="mt-2 text-xs text-muted-foreground">{factor.detail}</p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        This score is an informational estimate — not a medical diagnosis. Always consult your doctor
                        for medical advice.
                      </p>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
