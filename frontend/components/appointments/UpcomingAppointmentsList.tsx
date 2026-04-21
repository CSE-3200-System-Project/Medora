"use client";

import React from "react";
import { Brain, CalendarClock, HeartPulse, RefreshCw, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { PatientAppointment } from "@/components/appointments/types";
import { useAppI18n, useT } from "@/i18n/client";

interface UpcomingAppointmentsListProps {
  appointments: PatientAppointment[];
  selectedDate: string | null;
  onViewHistory: () => void;
  onRequestReschedule?: (appointment: PatientAppointment) => void;
  onRespondReschedule?: (appointment: PatientAppointment) => void;
  onWithdrawReschedule?: (appointment: PatientAppointment) => void;
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
  withdrawReschedule: string;
  cancel: string;
};

const SOFT_HOLD_WARNING_MS = 3 * 60 * 1000;

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

function formatDateLabelForLocale(isoDate: string, localeTag: string) {
  return new Date(isoDate).toLocaleDateString(localeTag, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(isoDate: string, slotTime: string | null | undefined, localeTag: string) {
  const source = (slotTime || "").trim();

  const parseWithReference = (hour: number, minute: number) => {
    const reference = new Date(isoDate);
    if (Number.isNaN(reference.getTime())) {
      const now = new Date();
      now.setHours(hour, minute, 0, 0);
      return now;
    }
    reference.setHours(hour, minute, 0, 0);
    return reference;
  };

  if (source) {
    const twelveHour = /^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i.exec(source);
    if (twelveHour) {
      const rawHour = Number(twelveHour[1]);
      const minute = Number(twelveHour[2]);
      const suffix = twelveHour[3].toUpperCase();
      const hour24 = suffix === "PM" ? (rawHour % 12) + 12 : rawHour % 12;
      return parseWithReference(hour24, minute).toLocaleTimeString(localeTag, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(source);
    if (twentyFourHour) {
      const hour = Number(twentyFourHour[1]);
      const minute = Number(twentyFourHour[2]);
      return parseWithReference(hour, minute).toLocaleTimeString(localeTag, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }

    return source;
  }

  const value = new Date(isoDate);
  if (Number.isNaN(value.getTime())) return "";

  return value.toLocaleTimeString(localeTag, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function appointmentTitle(appointment: PatientAppointment, consultationSuffix: string) {
  if (appointment.title && appointment.title.trim().length > 0) return appointment.title;
  if (appointment.reason && appointment.reason.trim().length > 0) return appointment.reason;
  const specialty = appointment.doctor_specialization || "General";
  return `${specialty} ${consultationSuffix}`;
}

function statusKeyFromStatus(status: string) {
  const value = status.toUpperCase();
  if (value === "CONFIRMED") return "confirmed";
  if (value === "PENDING") return "pending";
  if (value === "COMPLETED") return "completed";
  if (value === "CANCELLED") return "cancelled";
  if (value === "CANCELLED_BY_PATIENT") return "cancelledByPatient";
  if (value === "CANCELLED_BY_DOCTOR") return "cancelledByDoctor";
  if (value === "PENDING_ADMIN_REVIEW") return "pendingAdminReview";
  if (value === "PENDING_DOCTOR_CONFIRMATION") return "pendingDoctorConfirmation";
  if (value === "PENDING_PATIENT_CONFIRMATION") return "pendingPatientConfirmation";
  if (value === "RESCHEDULE_REQUESTED") return "rescheduleRequested";
  if (value === "CANCEL_REQUESTED") return "cancelRequested";
  if (value === "NO_SHOW") return "noShow";
  return null;
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
  onWithdrawReschedule,
  onRequestCancel,
  onDeletePending,
  onBookAgain,
  messages,
}: UpcomingAppointmentsListProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const localeTag = locale === "bn" ? "bn-BD" : "en-US";
  const defaultHoldMessages = React.useMemo<SoftHoldMessages>(() => ({
    waiting: tCommon("patientAppointments.upcoming.waiting"),
    expiresIn: tCommon("patientAppointments.upcoming.expiresIn"),
    expiringSoon: tCommon("patientAppointments.upcoming.expiringSoon"),
    expired: tCommon("patientAppointments.upcoming.expired"),
    bookAgain: tCommon("patientAppointments.upcoming.bookAgain"),
    deleteRequest: tCommon("patientAppointments.upcoming.deleteRequest"),
    reschedule: tCommon("patientAppointments.upcoming.reschedule"),
    withdrawReschedule: tCommon("patientAppointments.upcoming.withdrawReschedule"),
    cancel: tCommon("patientAppointments.upcoming.cancel"),
  }), [tCommon]);
  const holdMessages = React.useMemo(() => ({ ...defaultHoldMessages, ...(messages || {}) }), [defaultHoldMessages, messages]);
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
          <h3 className="text-lg font-semibold text-foreground">{tCommon("patientAppointments.upcoming.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedDate
              ? tCommon("patientAppointments.upcoming.subtitleSelected")
              : tCommon("patientAppointments.upcoming.subtitleUpcoming")}
          </p>
        </div>

        <Button variant="link" className="px-0 h-auto" onClick={onViewHistory}>
          {tCommon("patientAppointments.page.appointmentHistory")}
        </Button>
      </div>

      <div className="mt-4 space-y-4">
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            {tCommon("patientAppointments.upcoming.empty")}
          </div>
        ) : (
          appointments.map((appointment) => {
            const softHoldState = deriveSoftHoldState(appointment, nowMs);
            const backendHoldExpired = isBackendHoldExpired(appointment);
            const showExpiredState = softHoldState.isExpired || backendHoldExpired;
            const canDeletePending = softHoldState.isPending && !showExpiredState;
            const isRescheduleRequested = appointment.status.toUpperCase() === "RESCHEDULE_REQUESTED";
            const requesterRole = (appointment.reschedule_requested_by_role || "").toUpperCase();
            const canWithdrawReschedule =
              Boolean(onWithdrawReschedule) &&
              isRescheduleRequested &&
              requesterRole === "PATIENT" &&
              Boolean(appointment.reschedule_request_id);
            const canRespondReschedule =
              Boolean(onRespondReschedule) &&
              isRescheduleRequested &&
              !canWithdrawReschedule;
            const statusKey = statusKeyFromStatus(appointment.status);
            const badgeLabel = showExpiredState
              ? tCommon("patientAppointments.upcoming.status.expired")
              : statusKey
              ? tCommon(`patientAppointments.upcoming.status.${statusKey}`)
              : appointment.status;
            const doctorPrefix = tCommon("patientAppointments.dialogs.cancel.fallbackDoctorPrefix");
            const assignedDoctor = tCommon("patientAppointments.page.defaults.assignedDoctor");
            const consultationSuffix = tCommon("patientAppointments.upcoming.consultationSuffix");

            return (
              <div key={appointment.id} className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {specialtyIcon(appointment.doctor_specialization)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{appointmentTitle(appointment, consultationSuffix)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {doctorPrefix} {appointment.doctor_name || assignedDoctor}
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
                    <p className="text-sm font-semibold text-foreground">{formatDateLabelForLocale(appointment.appointment_date, localeTag)}</p>
                    <p className="text-xs text-muted-foreground">{formatTimeLabel(appointment.appointment_date, appointment.slot_time, localeTag)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={showExpiredState ? "destructive" : statusVariant(appointment.status)} className="uppercase tracking-wide">
                      {badgeLabel}
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
                    {canRespondReschedule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                        onClick={() => onRespondReschedule?.(appointment)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {holdMessages.reschedule}
                      </Button>
                    )}
                    {canWithdrawReschedule && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => onWithdrawReschedule?.(appointment)}
                      >
                        {holdMessages.withdrawReschedule}
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
