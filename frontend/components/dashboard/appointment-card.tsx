"use client"

import { Calendar, MapPin } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type AppointmentCardProps = {
  doctorName: string
  specialty: string
  dateTime: string
  location: string
  avatarUrl?: string
  status?: string
  actionLabel: string
  actionVariant?: "default" | "outline"
}

export function AppointmentCard({
  doctorName,
  specialty,
  dateTime,
  location,
  avatarUrl,
  status,
  actionLabel,
  actionVariant = "default",
}: AppointmentCardProps) {
  return (
    <div className="animate-fade-in-up card-hover">
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-3">
            <Avatar className="size-11 border border-border/80">
              <AvatarImage src={avatarUrl} alt={doctorName} />
              <AvatarFallback className="bg-muted text-foreground">{doctorName.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-foreground">{doctorName}</p>
              <p className="truncate text-sm text-muted-foreground">{specialty}</p>
            </div>
            {status ? (
              <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {status}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Date & Time</p>
              <div className="flex items-center gap-1.5 text-foreground">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{dateTime}</span>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Location</p>
              <div className="flex items-center gap-1.5 text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{location}</span>
              </div>
            </div>
          </div>

          <Button variant={actionVariant} className="w-full">
            {actionLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
