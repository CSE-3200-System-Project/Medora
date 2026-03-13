"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

type HealthStatCardProps = {
  icon: LucideIcon
  value: string
  label: string
  trend: string
  trendType?: "up" | "down" | "neutral"
}

const trendClasses = {
  up: "text-success-muted",
  down: "text-destructive-muted",
  neutral: "text-muted-foreground",
}

export function HealthStatCard({
  icon: Icon,
  value,
  label,
  trend,
  trendType = "neutral",
}: HealthStatCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="rounded-lg bg-muted p-2 text-foreground">
              <Icon className="h-4 w-4" />
            </div>
            <span className={`text-xs font-semibold ${trendClasses[trendType]}`}>{trend}</span>
          </div>
          <div>
            <p className="text-3xl font-bold leading-none text-foreground">{value}</p>
            <p className="mt-2 text-sm text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
