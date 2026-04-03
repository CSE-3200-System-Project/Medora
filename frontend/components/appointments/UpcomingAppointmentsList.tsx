"use client";

import React from "react";
import { Brain, CalendarClock, HeartPulse, RefreshCw, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientAppointment } from "@/components/appointments/types";
import { formatAppointmentTime } from "@/lib/utils";

interface UpcomingAppointmentsListProps {
  appointments: PatientAppointment[];
  selectedDate: string | null;
  onViewHistory: () => void;
  onRequestReschedule?: (appointment: PatientAppointment) => void;
  onRespondReschedule?: (appointment: PatientAppointment) => void;
  onRequestCancel?: (appointment: PatientAppointment) => void;
  onDeletePending?: (appointment: PatientAppointment) => void;
  onBookAgain?: (appointment: PatientAppointment) => void;
  messages?: Partial<SoftHoldMessages>;
}

type SoftHoldState = {
  isPending: boolean;
  isExpired: boolean;
  isWarning: boolean;
  showWaiting: boolean;
  remainingMs: number | null;
};

type SoftHoldMessages = {
  waiting: string;
  expiresIn: string;
  expiringSoon: string;
  expired: string;
  bookAgain: string;
  deleteRequest: string;
  reschedule: string;
  cancel: string;
};

const SOFT_HOLD_WARNING_MS = 3 * 60 * 1000;

const HOLD_MESSAGES: SoftHoldMessages = {
  waiting: "Waiting for doctor confirmation",
  expiresIn: "Expires in",
  expiringSoon: "Doctor hasn't responded yet. This request will expire soon.",
  expired: "This request expired because the doctor didn't confirm in time.",
  bookAgain: "Book Again",
  deleteRequest: "Delete Request",
  reschedule: "Reschedule",
  cancel: "Cancel",
};

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
  return value === "CONFIRMED" || value === "RESCHEDULE_REQUESTED" || value === "CANCEL_REQUESTED";
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
  return formatAppointmentTime(isoDate, slotTime);
}

function appointmentTitle(appointment: PatientAppointment) {
  if (appointment.title && appointment.title.trim().length > 0) return appointment.title;
  if (appointment.reason && appointment.reason.trim().length > 0) return appointment.reason;
  const specialty = appointment.doctor_specialization || "General";
  return `${specialty} Consultation`;
}

function formatRemaining(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function deriveSoftHoldState(appointment: PatientAppointment, nowMs: number): SoftHoldState {
  const status = (appointment.status || "").toUpperCase();
  const isPending = status === "PENDING";
  if (!isPending) {
    return {
      isPending: false,
      isExpired: false,
      isWarning: false,
      showWaiting: false,
      remainingMs: null,
    };
  }

  const holdExpiresAtMs = appointment.hold_expires_at ? Date.parse(appointment.hold_expires_at) : Number.NaN;
  const hasValidExpiry = Number.isFinite(holdExpiresAtMs);
  const remainingMs = hasValidExpiry ? holdExpiresAtMs - nowMs : null;
  const isExpired = remainingMs !== null && remainingMs <= 0;
  const isWarning = remainingMs !== null && remainingMs > 0 && remainingMs <= SOFT_HOLD_WARNING_MS;

  return {
    isPending: true,
    isExpired,
    isWarning,
    showWaiting: !isExpired,
    remainingMs,
  };
}

function isBackendHoldExpired(appointment: PatientAppointment) {
  const status = (appointment.status || "").toUpperCase();
  const reasonKey = (appointment.cancellation_reason_key || "").toUpperCase();
  return (status === "CANCELLED" || status === "CANCELLED_BY_PATIENT" || status === "CANCELLED_BY_DOCTOR") && reasonKey === "HOLD_EXPIRED";
}

export function UpcomingAppointmentsList({
  appointments,
  selectedDate,
  onViewHistory,
  onRequestReschedule,
  onRespondReschedule,
  onRequestCancel,
  onDeletePending,
  onBookAgain,
  messages,
}: UpcomingAppointmentsListProps) {
  const holdMessages = React.useMemo(() => ({ ...HOLD_MESSAGES, ...(messages || {}) }), [messages]);
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  React.useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

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
          appointments.map((appointment) => {
            const softHoldState = deriveSoftHoldState(appointment, nowMs);
            const backendHoldExpired = isBackendHoldExpired(appointment);
            const showExpiredState = softHoldState.isExpired || backendHoldExpired;
            const canDeletePending = softHoldState.isPending && !showExpiredState;

            return (
              <div key={appointment.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {specialtyIcon(appointment.doctor_specialization)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{appointmentTitle(appointment)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Dr. {appointment.doctor_name || "Assigned Doctor"}
                      {appointment.doctor_specialization ? ` | ${appointment.doctor_specialization}` : ""}
                    </p>

                    {softHoldState.showWaiting && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">{holdMessages.waiting}</p>
                        {softHoldState.remainingMs !== null && softHoldState.remainingMs > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {holdMessages.expiresIn} {formatRemaining(softHoldState.remainingMs)}
                          </p>
                        ) : null}
                        {softHoldState.isWarning ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            {holdMessages.expiringSoon}
                          </p>
                        ) : null}
                      </div>
                    )}

                    {showExpiredState ? (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-destructive">{holdMessages.expired}</p>
                        {onBookAgain ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onBookAgain(appointment)}
                          >
                            {holdMessages.bookAgain}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatDateLabel(appointment.appointment_date)}</p>
                    <p className="text-xs text-muted-foreground">{formatTimeLabel(appointment.appointment_date, appointment.slot_time)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={showExpiredState ? "destructive" : statusVariant(appointment.status)} className="uppercase tracking-wide">
                      {showExpiredState ? "EXPIRED" : appointment.status}
                    </Badge>
                    {onRequestReschedule && appointment.status.toUpperCase() === "CONFIRMED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => onRequestReschedule(appointment)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {holdMessages.reschedule}
                      </Button>
                    )}
                    {onRespondReschedule && appointment.status.toUpperCase() === "RESCHEDULE_REQUESTED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => onRespondReschedule(appointment)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {holdMessages.reschedule}
                      </Button>
                    )}
                    {onDeletePending && canDeletePending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => onDeletePending(appointment)}
                      >
                        {holdMessages.deleteRequest}
                      </Button>
                    )}
                    {onRequestCancel && canCancel(appointment.status) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => onRequestCancel(appointment)}
                      >
                        {holdMessages.cancel}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
