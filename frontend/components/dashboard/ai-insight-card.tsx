"use client"

import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

type AIInsightCardProps = {
  icon: LucideIcon
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

export function AIInsightCard({ icon: Icon, title, description, tone = "info" }: AIInsightCardProps) {
  const style = toneStyles[tone]

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
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
    </motion.div>
  )
}
