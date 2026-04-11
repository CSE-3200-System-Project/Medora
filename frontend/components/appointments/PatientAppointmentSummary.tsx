"use client";

import { CalendarDays, Clock3, Plus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientSummary } from "@/components/appointments/types";
import { useT } from "@/i18n/client";

interface PatientAppointmentSummaryProps {
  patient: PatientSummary;
  nextAppointmentLabel: string;
  lastVisitLabel: string;
  onNewAppointment: () => void;
}

export function PatientAppointmentSummary({
  patient,
  nextAppointmentLabel,
  lastVisitLabel,
  onNewAppointment,
}: PatientAppointmentSummaryProps) {
  const tCommon = useT("common");
  const initials = patient.fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar className="h-14 w-14 md:h-16 md:w-16 ring-2 ring-primary/20">
            <AvatarImage src={patient.avatarUrl || undefined} alt={patient.fullName} />
            <AvatarFallback className="bg-primary/15 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl md:text-2xl font-semibold text-foreground truncate">{patient.fullName}</h2>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                {tCommon("patientAppointments.summary.patientId")}: {patient.patientId}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" />
                {tCommon("patientAppointments.summary.next")}: {nextAppointmentLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-primary" />
                {tCommon("patientAppointments.summary.lastVisit")}: {lastVisitLabel}
              </span>
            </div>
          </div>
        </div>

        <Button variant="medical" className="w-full md:w-auto" onClick={onNewAppointment}>
          <Plus className="h-4 w-4" />
          {tCommon("patientAppointments.summary.newAppointment")}
        </Button>
      </div>
    </Card>
  );
}
