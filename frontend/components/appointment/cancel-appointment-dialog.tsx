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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle, Clock, User, Calendar, Loader2 } from "lucide-react";

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

export function CancelAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  userRole = 'patient',
  reasonOptions,
  bufferMinutes = 60,
}: CancelAppointmentDialogProps) {
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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const displayName = userRole === 'patient' 
    ? `${appointment?.doctor_title || 'Dr.'} ${appointment?.doctor_name || 'Doctor'}`
    : appointment?.patient_name || 'Patient';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            Cancel Appointment
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this appointment? Cancellation must happen at least {bufferMinutes} minutes before appointment time.
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="space-y-4">
            {/* Appointment Summary */}
            <div className="bg-accent/50 rounded-lg p-4">
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
                  <p className="text-xs font-medium mb-1">Consultation</p>
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
              <Label className="text-sm font-medium">Cancellation reason</Label>
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
                      {option.label}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Cancellation Reason */}
            <div className="space-y-2">
              <Label htmlFor="cancellation-reason" className="text-sm font-medium">
                Additional details (optional)
              </Label>
              <Textarea
                id="cancellation-reason"
                placeholder="Add optional context for the cancellation..."
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
            Keep Appointment
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Cancel Appointment"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
