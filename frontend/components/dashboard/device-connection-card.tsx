"use client"

import { memo } from "react"
import { Watch } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type DeviceConnectionCardProps = {
  title: string
  lastSynced: string
  lastSyncedLabel: string
  manageDevicesLabel: string
}

export const DeviceConnectionCard = memo(function DeviceConnectionCard({
  title,
  lastSynced,
  lastSyncedLabel,
  manageDevicesLabel,
}: DeviceConnectionCardProps) {
  return (
    <div className="card-hover">
      <Card className="overflow-hidden border border-border/70 bg-background text-foreground shadow-md dark:bg-card dark:text-card-foreground">
        <CardContent className="relative pt-5">
          <div className="absolute -right-4 -bottom-6 opacity-20">
            <Watch className="h-20 w-20" />
          </div>

          <p className="text-lg font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground dark:text-muted-foreground">
            {lastSyncedLabel}: {lastSynced}
          </p>

          <Button
            variant="ghost"
            className="mt-4 h-9 min-h-9 rounded-md border border-border bg-card px-3 text-xs font-semibold tracking-wide text-foreground hover:bg-card/80 hover:text-foreground dark:border-border dark:bg-muted dark:text-foreground dark:hover:bg-muted/80"
          >
            {manageDevicesLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
})

