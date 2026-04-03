import { Clock3, MapPin, Phone, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DoctorAppointment } from "@/components/doctor/doctor-appointments/types";
import { cn, formatAppointmentTime, humanizeAppointmentType, humanizeConsultationType, parseCompositeReason } from "@/lib/utils";

type AppointmentCardProps = {
  appointment: DoctorAppointment;
  onClick: () => void;
};

export function AppointmentCard({ appointment, onClick }: AppointmentCardProps) {
  const time = formatAppointmentTime(appointment.appointment_date, appointment.slot_time);
  const { consultationType, appointmentType } = parseCompositeReason(appointment.reason || "");
  const reasonLabel = `${humanizeConsultationType(consultationType)}${appointmentType ? ` | ${humanizeAppointmentType(appointmentType)}` : ""}`;

  return (
    <Card
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-border/70 bg-card/95 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      title="Open appointment details"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight text-foreground">{appointment.patient_name}</p>
            <p className="text-xs text-muted-foreground">
              {appointment.patient_age ?? "--"} yrs | {(appointment.patient_gender || "N/A").toLowerCase()}
            </p>
          </div>
        </div>
        {getStatusBadge(appointment.status)}
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p className="inline-flex w-full items-center gap-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-foreground">
          <Clock3 className="h-4 w-4 text-primary" />
          {time}
        </p>
        <p className="truncate text-muted-foreground">{reasonLabel}</p>
        <p className="inline-flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-4 w-4" />
          {extractLocation(appointment)}
        </p>
        <p className="inline-flex items-center gap-2 text-muted-foreground">
          <Phone className="h-4 w-4" />
          {appointment.patient_phone || "Not provided"}
        </p>
        {appointment.chronic_conditions && appointment.chronic_conditions.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {appointment.chronic_conditions.slice(0, 2).map((condition) => (
              <Badge key={condition} variant="outline" className="text-[10px]">
                {condition}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function getStatusBadge(status: DoctorAppointment["status"]) {
  const base = "text-xs font-semibold";
  const value = status.toUpperCase();

  if (value === "CONFIRMED") {
    return <Badge className={cn(base, "bg-primary text-primary-foreground")}>Confirmed</Badge>;
  }

  if (value === "PENDING" || value === "PENDING_ADMIN_REVIEW" || value === "PENDING_DOCTOR_CONFIRMATION" || value === "PENDING_PATIENT_CONFIRMATION") {
    return <Badge className={cn(base, "bg-amber-500 text-white")}>Pending</Badge>;
  }

  if (value === "COMPLETED") {
    return <Badge className={cn(base, "bg-emerald-600 text-white")}>Completed</Badge>;
  }

  if (value === "RESCHEDULE_REQUESTED") {
    return <Badge className={cn(base, "bg-indigo-600 text-white")}>Reschedule Requested</Badge>;
  }

  if (value === "NO_SHOW") {
    return <Badge className={cn(base, "bg-muted text-foreground")}>No Show</Badge>;
  }

  return <Badge className={cn(base, "bg-destructive text-white")}>Cancelled</Badge>;
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
