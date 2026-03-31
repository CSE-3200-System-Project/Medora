"use client";

import { Brain, CalendarClock, HeartPulse, RefreshCw, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientAppointment } from "@/components/appointments/types";

interface UpcomingAppointmentsListProps {
  appointments: PatientAppointment[];
  selectedDate: string | null;
  onViewHistory: () => void;
  onRequestReschedule?: (appointment: PatientAppointment) => void;
  onRequestCancel?: (appointment: PatientAppointment) => void;
}

function statusVariant(status: string): "success" | "warning" | "destructive" {
  const value = status.toUpperCase();
  if (value === "CONFIRMED") return "success";
  if (value === "COMPLETED") return "success";
  if (value === "PENDING") return "warning";
  if (value === "PENDING_ADMIN_REVIEW") return "warning";
  if (value === "PENDING_DOCTOR_CONFIRMATION") return "warning";
  if (value === "PENDING_PATIENT_CONFIRMATION") return "warning";
  if (value === "RESCHEDULE_REQUESTED") return "warning";
  if (value === "CANCEL_REQUESTED") return "destructive";
  if (value === "CANCELLED") return "destructive";
  if (value === "CANCELLED_BY_PATIENT") return "destructive";
  if (value === "CANCELLED_BY_DOCTOR") return "destructive";
  if (value === "NO_SHOW") return "destructive";
  return "destructive";
}

function canCancel(status: string) {
  const value = status.toUpperCase();
  return value === "CONFIRMED" || value === "PENDING" || value === "PENDING_ADMIN_REVIEW";
}

function specialtyIcon(specialty?: string | null) {
  const value = (specialty || "").toLowerCase();
  if (value.includes("cardio") || value.includes("heart")) return <HeartPulse className="h-4 w-4 text-orange-600" />;
  if (value.includes("neuro") || value.includes("brain")) return <Brain className="h-4 w-4 text-blue-600" />;
  if (value.includes("general") || value.includes("medicine")) return <Stethoscope className="h-4 w-4 text-emerald-600" />;
  return <CalendarClock className="h-4 w-4 text-primary" />;
}

function formatDateLabel(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(isoDate: string, slotTime?: string | null) {
  if (slotTime) return slotTime;
  return new Date(isoDate).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function appointmentTitle(appointment: PatientAppointment) {
  if (appointment.title && appointment.title.trim().length > 0) return appointment.title;
  if (appointment.reason && appointment.reason.trim().length > 0) return appointment.reason;
  const specialty = appointment.doctor_specialization || "General";
  return `${specialty} Consultation`;
}

export function UpcomingAppointmentsList({
  appointments,
  selectedDate,
  onViewHistory,
  onRequestReschedule,
  onRequestCancel,
}: UpcomingAppointmentsListProps) {
  return (
    <Card className="rounded-2xl border border-border bg-card shadow-sm p-4 md:p-6 h-full">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Upcoming Schedule</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedDate ? "Appointments for selected date" : "Your upcoming clinic visits"}
          </p>
        </div>

        <Button variant="link" className="px-0 h-auto" onClick={onViewHistory}>
          Appointment History
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            No upcoming appointments found for this view.
          </div>
        ) : (
          appointments.map((appointment) => (
            <div key={appointment.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  {specialtyIcon(appointment.doctor_specialization)}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{appointmentTitle(appointment)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Dr. {appointment.doctor_name || "Assigned Doctor"}
                    {appointment.doctor_specialization ? ` • ${appointment.doctor_specialization}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{formatDateLabel(appointment.appointment_date)}</p>
                  <p className="text-xs text-muted-foreground">{formatTimeLabel(appointment.appointment_date, appointment.slot_time)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(appointment.status)} className="uppercase tracking-wide">
                    {appointment.status}
                  </Badge>
                  {onRequestReschedule && appointment.status.toUpperCase() === "CONFIRMED" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                      onClick={() => onRequestReschedule(appointment)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Reschedule
                    </Button>
                  )}
                  {onRequestCancel && canCancel(appointment.status) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                      onClick={() => onRequestCancel(appointment)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
