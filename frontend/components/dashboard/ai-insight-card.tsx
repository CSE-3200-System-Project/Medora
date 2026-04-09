"use client"

import { memo } from "react"
import { Droplets, MoonStar, Pill, Activity } from "lucide-react"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

const ICON_MAP: Record<string, LucideIcon> = {
  Pill,
  MoonStar,
  Droplets,
  Activity,
}

type AIInsightCardProps = {
  iconName: string
  title: string
  description: string
  tone?: "info" | "warning" | "success"
}

const toneStyles = {
  info: {
    iconWrap: "bg-primary/10 text-primary",
    dot: "bg-primary",
  },
  warning: {
    iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500 dark:bg-amber-300",
  },
  success: {
    iconWrap: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    dot: "bg-emerald-500 dark:bg-emerald-300",
  },
}

export const AIInsightCard = memo(function AIInsightCard({ iconName, title, description, tone = "info" }: AIInsightCardProps) {
  const Icon = ICON_MAP[iconName] ?? Activity
  const style = toneStyles[tone]

  return (
    <div className="card-hover">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="flex items-start gap-3 pt-4">
          <div className={`rounded-xl p-2.5 ${style.iconWrap}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-foreground">{title}</p>
              <span className={`h-2 w-2 rounded-full ${style.dot}`} />
            </div>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
