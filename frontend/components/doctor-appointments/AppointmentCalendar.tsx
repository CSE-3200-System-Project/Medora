import dynamic from "next/dynamic";

import { DoctorAppointment } from "@/components/doctor-appointments/types";

const AppointmentCalendarBase = dynamic(
  () => import("@/components/ui/appointment-calendar").then((module) => module.AppointmentCalendar),
  { loading: () => <div className="skeleton h-[360px] w-full rounded-2xl" /> },
);

type AppointmentCalendarProps = {
  appointments: DoctorAppointment[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
};

export function AppointmentCalendar({ appointments, selectedDate, onDateSelect }: AppointmentCalendarProps) {
  return (
    <AppointmentCalendarBase
      appointments={appointments}
      selectedDate={selectedDate}
      onDateSelect={onDateSelect}
      title="Appointment Calendar"
    />
  );
}
