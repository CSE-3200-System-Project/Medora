"use client";

import React from "react";
import { Calendar, Check, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { useAppI18n, useT } from "@/i18n/client";

type RescheduleResponseMessages = {
  title: string;
  description: string;
  currentTimeLabel: string;
  proposedTimeLabel: string;
  loadingRequest: string;
  missingRequest: string;
  cancel: string;
  accept: string;
  reject: string;
  accepting: string;
  rejecting: string;
};

const DEFAULT_MESSAGES: RescheduleResponseMessages = {
  title: "Doctor proposed a new time",
  description: "Review the proposed schedule and choose to accept or reject.",
  currentTimeLabel: "Current appointment",
  proposedTimeLabel: "Proposed appointment",
  loadingRequest: "Loading reschedule request details...",
  missingRequest: "Reschedule request details are not available for this appointment.",
  cancel: "Close",
  accept: "Accept",
  reject: "Reject",
  accepting: "Accepting...",
  rejecting: "Rejecting...",
};

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

interface RescheduleResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    doctor_name?: string | null;
    doctor_title?: string | null;
    patient_name?: string | null;
    patient_title?: string | null;
    appointment_date: string;
    slot_time?: string | null;
  } | null;
  request:
    | {
        id: string;
        proposed_date: string;
        proposed_time: string;
      }
    | null;
  isResolving: boolean;
  resolveError?: string | null;
  onAccept: (requestId: string) => Promise<void>;
  onReject: (requestId: string) => Promise<void>;
  messages?: Partial<RescheduleResponseMessages>;
}

function formatDateLabel(value: string, locale: string, naLabel: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return naLabel;
  return date.toLocaleDateString(toIntlLocale(locale), {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(value: string | null | undefined, locale: string, naLabel: string) {
  if (!value) return naLabel;

  const twelveHour = /^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i.exec(value.trim());
  if (twelveHour) {
    const hours = Number(twelveHour[1]);
    const minutes = twelveHour[2];
    const suffix = twelveHour[3].toUpperCase();
    return `${hours}:${minutes} ${suffix}`;
  }

  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (twentyFourHour) {
    const date = new Date();
    date.setHours(Number(twentyFourHour[1]), Number(twentyFourHour[2]), Number(twentyFourHour[3] || "0"), 0);
    return date.toLocaleTimeString(toIntlLocale(locale), {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return value;
}

export function RescheduleResponseDialog({
  open,
  onOpenChange,
  appointment,
  request,
  isResolving,
  resolveError,
  onAccept,
  onReject,
  messages,
}: RescheduleResponseDialogProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const localizedDefaults = React.useMemo<RescheduleResponseMessages>(
    () => ({
      title: tCommon("patientAppointments.dialogs.rescheduleResponse.title"),
      description: tCommon("patientAppointments.dialogs.rescheduleResponse.description"),
      currentTimeLabel: tCommon("patientAppointments.dialogs.rescheduleResponse.currentTime"),
      proposedTimeLabel: tCommon("patientAppointments.dialogs.rescheduleResponse.proposedTime"),
      loadingRequest: tCommon("patientAppointments.dialogs.rescheduleResponse.loading"),
      missingRequest: tCommon("patientAppointments.dialogs.rescheduleResponse.missing"),
      cancel: tCommon("patientAppointments.dialogs.rescheduleResponse.close"),
      accept: tCommon("patientAppointments.dialogs.rescheduleResponse.accept"),
      reject: tCommon("patientAppointments.dialogs.rescheduleResponse.reject"),
      accepting: tCommon("patientAppointments.dialogs.rescheduleResponse.accepting"),
      rejecting: tCommon("patientAppointments.dialogs.rescheduleResponse.rejecting"),
    }),
    [tCommon],
  );
  const copy = React.useMemo(
    () => ({ ...DEFAULT_MESSAGES, ...localizedDefaults, ...(messages || {}) }),
    [localizedDefaults, messages],
  );
  const [submitting, setSubmitting] = React.useState<"accept" | "reject" | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setSubmitError(null);
      setSubmitting(null);
    }
  }, [open, request?.id]);

  const handleAccept = async () => {
    if (!request?.id) return;
    setSubmitting("accept");
    setSubmitError(null);
    try {
      await onAccept(request.id);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : tCommon("patientAppointments.dialogs.rescheduleResponse.failedAccept"),
      );
    } finally {
      setSubmitting(null);
    }
  };

  const handleReject = async () => {
    if (!request?.id) return;
    setSubmitting("reject");
    setSubmitError(null);
    try {
      await onReject(request.id);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : tCommon("patientAppointments.dialogs.rescheduleResponse.failedReject"),
      );
    } finally {
      setSubmitting(null);
    }
  };

  const oldDateLabel = appointment
    ? formatDateLabel(appointment.appointment_date, locale, tCommon("patientAppointments.dialogs.rescheduleResponse.na"))
    : tCommon("patientAppointments.dialogs.rescheduleResponse.na");
  const oldTimeLabel =
    appointment?.slot_time
      ? formatTimeLabel(appointment.slot_time, locale, tCommon("patientAppointments.dialogs.rescheduleResponse.na"))
      : formatTimeLabel(
          appointment?.appointment_date
            ? new Date(appointment.appointment_date).toTimeString().slice(0, 8)
            : null,
          locale,
          tCommon("patientAppointments.dialogs.rescheduleResponse.na"),
        );
  const counterpartyTitle = appointment?.doctor_title || appointment?.patient_title || "";
  const counterpartyName =
    appointment?.doctor_name ||
    appointment?.patient_name ||
    tCommon("patientAppointments.dialogs.rescheduleResponse.fallbackCounterparty");
  const proposedDateLabel = request?.proposed_date
    ? formatDateLabel(request.proposed_date, locale, tCommon("patientAppointments.dialogs.rescheduleResponse.na"))
    : tCommon("patientAppointments.dialogs.rescheduleResponse.na");
  const proposedTimeLabel = formatTimeLabel(
    request?.proposed_time,
    locale,
    tCommon("patientAppointments.dialogs.rescheduleResponse.na"),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <RefreshCw className="h-5 w-5" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-accent/40 p-3">
            <p className="text-sm font-medium text-foreground">
              {counterpartyTitle ? `${counterpartyTitle} ` : ""}{counterpartyName}
            </p>
          </div>

          {isResolving ? (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <ButtonLoader className="h-4 w-4" />
              {copy.loadingRequest}
            </div>
          ) : request ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.currentTimeLabel}</p>
                <p className="mt-1 text-sm text-foreground">
                  {oldDateLabel} {tCommon("patientAppointments.dialogs.rescheduleResponse.at")} {oldTimeLabel}
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{copy.proposedTimeLabel}</p>
                <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Calendar className="h-4 w-4 text-primary" />
                  {proposedDateLabel} {tCommon("patientAppointments.dialogs.rescheduleResponse.at")} {proposedTimeLabel}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {resolveError || copy.missingRequest}
            </div>
          )}

          {submitError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting !== null}>
            {copy.cancel}
          </Button>
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isResolving || !request || submitting !== null}
          >
            {submitting === "reject" ? (
              <>
                <ButtonLoader className="mr-2 h-4 w-4" />
                {copy.rejecting}
              </>
            ) : (
              <>
                <X className="mr-2 h-4 w-4" />
                {copy.reject}
              </>
            )}
          </Button>
          <Button
            onClick={handleAccept}
            disabled={isResolving || !request || submitting !== null}
          >
            {submitting === "accept" ? (
              <>
                <ButtonLoader className="mr-2 h-4 w-4" />
                {copy.accepting}
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                {copy.accept}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

