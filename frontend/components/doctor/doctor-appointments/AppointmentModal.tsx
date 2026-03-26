import * as React from "react";
import { CalendarDays, Clock3, MapPin, Phone } from "lucide-react";

import { DoctorAppointment } from "@/components/doctor/doctor-appointments/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { humanizeAppointmentType, humanizeConsultationType, parseCompositeReason } from "@/lib/utils";

type AppointmentModalProps = {
  appointment: DoctorAppointment | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (id: string) => void;
  onCancel: (id: string) => void;
  onReschedule: (id: string, newTime: string) => void;
};

export function AppointmentModal({
  appointment,
  isOpen,
  onOpenChange,
  onApprove,
  onCancel,
  onReschedule,
}: AppointmentModalProps) {
  const [showReschedule, setShowReschedule] = React.useState(false);
  const [newTime, setNewTime] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) {
      setShowReschedule(false);
      setNewTime("");
    }
  }, [isOpen]);

  if (!appointment) {
    return null;
  }

  const date = new Date(appointment.appointment_date);
  const { consultationType, appointmentType } = parseCompositeReason(appointment.reason || "");

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-2xl border-border/70">
        <DialogHeader>
          <DialogTitle className="truncate text-2xl">{appointment.patient_name}</DialogTitle>
          <DialogDescription>
            {appointment.patient_age ?? "--"} years | {(appointment.patient_gender || "N/A").toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Status:</span>
          <Badge variant={getStatusVariant(appointment.status)}>
            {appointment.status}
          </Badge>
        </div>

        <div className="space-y-3 text-sm">
          <DetailRow label="Appointment Time" value={date.toLocaleString("en-US")} icon={<Clock3 className="h-4 w-4 text-primary" />} />
          <DetailRow
            label="Reason"
            value={`${humanizeConsultationType(consultationType)}${appointmentType ? ` | ${humanizeAppointmentType(appointmentType)}` : ""}`}
            icon={<CalendarDays className="h-4 w-4 text-primary" />}
          />
          <DetailRow label="Location / Slot" value={extractLocation(appointment)} icon={<MapPin className="h-4 w-4 text-primary" />} />
          <DetailRow label="Phone" value={appointment.patient_phone || "Not provided"} icon={<Phone className="h-4 w-4 text-primary" />} />
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Chronic Conditions</p>
            <div className="flex flex-wrap gap-1.5">
              {appointment.chronic_conditions && appointment.chronic_conditions.length > 0 ? (
                appointment.chronic_conditions.map((condition) => (
                  <Badge key={condition} variant="outline">
                    {condition}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">None reported</span>
              )}
            </div>
          </div>
        </div>

        {showReschedule ? (
          <div className="rounded-xl border border-border/70 bg-surface/40 p-3">
            <p className="mb-2 text-sm font-semibold">Select a new time</p>
            <input
              type="time"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
        ) : null}

        <DialogFooter className="flex flex-wrap gap-2 sm:justify-start">
          {/* Approve button - only for PENDING appointments */}
          {appointment.status === "PENDING" && (
            <Button
              onClick={() => {
                onApprove(appointment.id);
                onOpenChange(false);
              }}
              className="flex-1 sm:flex-none"
            >
              Approve Appointment
            </Button>
          )}

          {/* Cancel button - for PENDING and CONFIRMED appointments */}
          {(appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
            <Button
              variant="destructive"
              onClick={() => {
                onCancel(appointment.id);
                onOpenChange(false);
              }}
              className="flex-1 sm:flex-none"
            >
              Cancel Appointment
            </Button>
          )}

          {/* Reschedule button - for PENDING, CONFIRMED, and COMPLETED appointments */}
          {(appointment.status === "PENDING" || appointment.status === "CONFIRMED" || appointment.status === "COMPLETED") && (
            <>
              {!showReschedule ? (
                <Button
                  variant="outline"
                  onClick={() => setShowReschedule(true)}
                  className="flex-1 sm:flex-none"
                >
                  Reschedule Appointment
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!newTime) {
                      return;
                    }
                    onReschedule(appointment.id, newTime);
                    onOpenChange(false);
                  }}
                  disabled={!newTime}
                  className="flex-1 sm:flex-none"
                >
                  Confirm New Time
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-surface/30 px-3 py-2">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="inline-flex items-start gap-2 text-foreground">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <span className="overflow-wrap-break">{value}</span>
      </p>
    </div>
  );
}

function getStatusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "PENDING":
      return "secondary";
    case "CONFIRMED":
      return "default";
    case "COMPLETED":
      return "outline";
    case "CANCELLED":
      return "destructive";
    default:
      return "outline";
  }
}

function extractLocation(appointment: DoctorAppointment) {
  if (appointment.location) {
    return appointment.location;
  }

  const slotMatch = appointment.notes?.match(/Slot:\s*([^,\n]+)/i);
  if (slotMatch?.[1]) {
    return `Slot ${slotMatch[1].trim()}`;
  }

  return "Clinic desk";
}
