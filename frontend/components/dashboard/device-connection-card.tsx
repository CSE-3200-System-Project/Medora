"use client"

import { motion } from "framer-motion"
import { Watch } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type DeviceConnectionCardProps = {
  title: string
  lastSynced: string
}

export function DeviceConnectionCard({ title, lastSynced }: DeviceConnectionCardProps) {
  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
      <Card className="overflow-hidden border border-border/70 bg-slate-900 text-white shadow-md dark:bg-card dark:text-card-foreground">
        <CardContent className="relative pt-5">
          <div className="absolute -right-4 -bottom-6 opacity-20">
            <Watch className="h-20 w-20" />
          </div>

          <p className="text-lg font-semibold">{title}</p>
          <p className="mt-1 text-sm text-slate-300 dark:text-muted-foreground">Last synced: {lastSynced}</p>

          <Button
            variant="ghost"
            className="mt-4 h-9 min-h-9 rounded-md border border-slate-700 bg-slate-800 px-3 text-xs font-semibold tracking-wide text-white hover:bg-slate-700 hover:text-white dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
          >
            Manage Devices
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
