"use client";

import dynamic from "next/dynamic";
import type { PatientAppointment } from "@/components/appointments/types";
import { useT } from "@/i18n/client";

const AppointmentCalendarCore = dynamic(
  () => import("@/components/ui/appointment-calendar").then((mod) => mod.AppointmentCalendar),
  {
    ssr: false,
    loading: () => <div className="h-90 rounded-2xl border bg-card dark:bg-background" />,
  },
);

interface AppointmentCalendarProps {
  appointments: PatientAppointment[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
}

export function AppointmentCalendar({ appointments, selectedDate, onDateSelect }: AppointmentCalendarProps) {
  const tCommon = useT("common");

  return (
    <AppointmentCalendarCore
      appointments={appointments}
      selectedDate={selectedDate}
      onDateSelect={onDateSelect}
      title={tCommon("patientAppointments.calendar.title")}
      className="h-full"
    />
  );
}

