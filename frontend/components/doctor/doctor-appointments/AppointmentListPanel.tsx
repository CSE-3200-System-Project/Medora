import { CalendarDays } from "lucide-react";

import { AppointmentCard } from "@/components/doctor/doctor-appointments/AppointmentCard";
import { DoctorAppointment } from "@/components/doctor/doctor-appointments/types";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePagination } from "@/lib/use-pagination";

type AppointmentListPanelProps = {
  appointments: DoctorAppointment[];
  selectedDate: string | null;
  onSelectAppointment: (appointment: DoctorAppointment) => void;
};

export function AppointmentListPanel({
  appointments,
  selectedDate,
  onSelectAppointment,
}: AppointmentListPanelProps) {
  const title = selectedDate ? `Appointments for ${formatPanelDate(selectedDate)}` : "Upcoming Appointments";
  const appointmentPagination = usePagination(appointments, 8);

  return (
    <Card className="flex h-full min-h-168 flex-col border-border/60 bg-card/95">
      <CardHeader className="border-b border-border/60 pb-4">
        <CardTitle className="flex items-center gap-2 text-xl">
          <CalendarDays className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {selectedDate ? `${appointments.length} appointments on this date` : `Next ${appointments.length} appointments`}
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col p-4">
        {appointments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 px-4 py-12 text-center text-sm text-muted-foreground">
            No appointments found for this selection.
          </div>
        ) : (
          <>
            <div className="scrollbar-themed flex-1 space-y-3 overflow-y-auto pr-1">
              {appointmentPagination.pageItems.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  onClick={() => onSelectAppointment(appointment)}
                />
              ))}
            </div>
            <PaginationControls
              currentPage={appointmentPagination.currentPage}
              totalPages={appointmentPagination.totalPages}
              totalItems={appointmentPagination.totalItems}
              startIndex={appointmentPagination.startIndex}
              endIndex={appointmentPagination.endIndex}
              itemLabel="appointments"
              onPrev={appointmentPagination.goToPrevPage}
              onNext={appointmentPagination.goToNextPage}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatPanelDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
