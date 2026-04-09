"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PatientAppointment } from "@/components/appointments/types";
import { useAppI18n, useT } from "@/i18n/client";

interface AppointmentHeatmapProps {
  appointments: PatientAppointment[];
  monthDate: Date;
}

function getIntensityClass(count: number) {
  if (count >= 4) return "bg-primary";
  if (count === 3) return "bg-primary/80";
  if (count === 2) return "bg-primary/55";
  if (count === 1) return "bg-primary/30";
  return "bg-muted";
}

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

function formatMonthLabel(date: Date, locale: string) {
  return date.toLocaleDateString(toIntlLocale(locale), { month: "short" }).toUpperCase();
}

export function AppointmentHeatmap({ appointments, monthDate }: AppointmentHeatmapProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const countByDay = new Map<number, number>();

  appointments.forEach((appointment) => {
    const date = new Date(appointment.appointment_date);
    if (Number.isNaN(date.getTime())) return;
    if (date.getFullYear() !== year || date.getMonth() !== month) return;

    const day = date.getDate();
    countByDay.set(day, (countByDay.get(day) || 0) + 1);
  });

  const squares = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const count = countByDay.get(day) || 0;
    const dateLabel = new Date(year, month, day).toLocaleDateString(toIntlLocale(locale), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const tooltip = count === 1
      ? tCommon("patientAppointments.heatmap.tooltipSingle", { dateLabel, count })
      : tCommon("patientAppointments.heatmap.tooltipPlural", { dateLabel, count });

    return (
      <div
        key={day}
        title={tooltip}
        className={cn(
          "h-7 min-w-6 rounded-lg transition-transform hover:scale-105",
          getIntensityClass(count),
        )}
      />
    );
  });

  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">{tCommon("patientAppointments.heatmap.title")}</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{tCommon("patientAppointments.heatmap.less")}</span>
          <div className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/30" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/55" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary/80" />
            <span className="h-2.5 w-2.5 rounded-sm bg-primary" />
          </div>
          <span>{tCommon("patientAppointments.heatmap.more")}</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="flex min-w-max items-center gap-2">{squares}</div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] tracking-[0.08em] text-muted-foreground">
        <span>{tCommon("patientAppointments.heatmap.monthMarker", { month: formatMonthLabel(monthDate, locale), day: 1 })}</span>
        <span>{tCommon("patientAppointments.heatmap.monthMarker", { month: formatMonthLabel(monthDate, locale), day: 15 })}</span>
        <span>{tCommon("patientAppointments.heatmap.monthMarker", { month: formatMonthLabel(monthDate, locale), day: daysInMonth })}</span>
      </div>
    </Card>
  );
}
