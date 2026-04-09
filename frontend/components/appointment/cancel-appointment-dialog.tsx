"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle, Clock, User, Calendar } from "lucide-react";
import { useAppI18n, useT } from "@/i18n/client";

interface CancelAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    doctor_name?: string;
    doctor_title?: string;
    patient_name?: string;
    appointment_date: string;
    slot_time?: string | null;
    reason?: string;
  } | null;
  onConfirm: (appointmentId: string, reasonKey: string, cancellationReason?: string) => Promise<void>;
  userRole?: 'patient' | 'doctor';
  reasonOptions?: Array<{ key: string; label: string }>;
  bufferMinutes?: number;
}

const DEFAULT_PATIENT_REASON_OPTIONS = [
  { key: "SCHEDULE_CONFLICT", label: "Schedule conflict" },
  { key: "PERSONAL_EMERGENCY", label: "Personal emergency" },
  { key: "FEELING_BETTER", label: "Feeling better" },
  { key: "TRANSPORT_ISSUE", label: "Transport issue" },
  { key: "COST_CONCERN", label: "Cost concern" },
  { key: "OTHER", label: "Other" },
];

const DEFAULT_DOCTOR_REASON_OPTIONS = [
  { key: "DOCTOR_UNAVAILABLE", label: "Doctor unavailable" },
  { key: "CLINIC_DELAY", label: "Clinic delay" },
  { key: "DOUBLE_BOOKED", label: "Double booked" },
  { key: "PERSONAL_EMERGENCY", label: "Personal emergency" },
  { key: "OTHER", label: "Other" },
];

const REASON_TRANSLATION_KEYS: Record<string, string> = {
  SCHEDULE_CONFLICT: "scheduleConflict",
  PERSONAL_EMERGENCY: "personalEmergency",
  FEELING_BETTER: "feelingBetter",
  TRANSPORT_ISSUE: "transportIssue",
  COST_CONCERN: "costConcern",
  DOCTOR_UNAVAILABLE: "doctorUnavailable",
  CLINIC_DELAY: "clinicDelay",
  DOUBLE_BOOKED: "doubleBooked",
  OTHER: "other",
};

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

export function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  userRole = 'patient',
  reasonOptions,
  bufferMinutes = 60,
}: CancelAppointmentDialogProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const [cancellationReason, setCancellationReason] = React.useState("");
  const roleDefaultOptions = userRole === "doctor" ? DEFAULT_DOCTOR_REASON_OPTIONS : DEFAULT_PATIENT_REASON_OPTIONS;
  const options = reasonOptions && reasonOptions.length > 0 ? reasonOptions : roleDefaultOptions;
  const [selectedReasonKey, setSelectedReasonKey] = React.useState(options[0]?.key || "OTHER");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelectedReasonKey(options[0]?.key || "OTHER");
      setCancellationReason("");
    }
  }, [open, options]);

  const handleConfirm = async () => {
    if (!appointment) return;
    
    setLoading(true);
    try {
      await onConfirm(appointment.id, selectedReasonKey, cancellationReason || undefined);
      setCancellationReason("");
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString(toIntlLocale(locale), {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const resolveReasonLabel = (optionKey: string, fallbackLabel: string) => {
    const mappedKey = REASON_TRANSLATION_KEYS[optionKey];
    if (!mappedKey) {
      return fallbackLabel;
    }
    return tCommon(`patientAppointments.dialogs.cancel.reasons.${mappedKey}`);
  };

  const displayName = userRole === 'patient' 
    ? `${appointment?.doctor_title || tCommon("patientAppointments.dialogs.cancel.fallbackDoctorPrefix")} ${appointment?.doctor_name || tCommon("patientAppointments.dialogs.cancel.fallbackDoctorName")}`.trim()
    : appointment?.patient_name || tCommon("patientAppointments.dialogs.cancel.fallbackPatientName");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            {tCommon("patientAppointments.dialogs.cancel.title")}
          </DialogTitle>
          <DialogDescription>
            {tCommon("patientAppointments.dialogs.cancel.description", {
              minutes: String(bufferMinutes),
            })}
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="space-y-4">
            {/* Appointment Summary */}
            <div className="bg-accent/50 rounded-lg p-4">
              <p className="text-xs text-muted-foreground mb-1">{tCommon("patientAppointments.dialogs.cancel.currentAppointment")}</p>
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-primary" />
                <p className="font-semibold text-foreground">{displayName}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>{formatDate(appointment.appointment_date)}</span>
              </div>
              {appointment.slot_time && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Clock className="w-4 h-4" />
                  <span>{appointment.slot_time}</span>
                </div>
              )}
              {appointment.reason && (
                <div className="mt-2 border-t border-border/50 pt-2 text-sm text-muted-foreground">
                  <p className="text-xs font-medium mb-1">{tCommon("patientAppointments.dialogs.cancel.consultation")}</p>
                  {(() => {
                    const { consultationType, appointmentType } = parseCompositeReason(appointment.reason || "");
                    const ct = humanizeConsultationType(consultationType);
                    const at = humanizeAppointmentType(appointmentType);
                    return (
                      <p className="truncate">{ct || appointment.reason}{at ? ` • ${at}` : ''}</p>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">{tCommon("patientAppointments.dialogs.cancel.reasonTitle")}</Label>
              <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                  const isSelected = selectedReasonKey === option.key;
                  return (
                    <Button
                      key={option.key}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="h-8"
                      onClick={() => setSelectedReasonKey(option.key)}
                    >
                      {resolveReasonLabel(option.key, option.label)}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason" className="text-sm font-medium">
                {tCommon("patientAppointments.dialogs.cancel.additionalDetails")}
              </Label>
              <Textarea
                id="cancellation-reason"
                placeholder={tCommon("patientAppointments.dialogs.cancel.additionalPlaceholder")}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            {tCommon("patientAppointments.dialogs.cancel.keepAppointment")}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <ButtonLoader className="w-4 h-4 mr-2" />
                {tCommon("patientAppointments.dialogs.cancel.cancelling")}
              </>
            ) : (
              tCommon("patientAppointments.dialogs.cancel.cancelAppointment")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
