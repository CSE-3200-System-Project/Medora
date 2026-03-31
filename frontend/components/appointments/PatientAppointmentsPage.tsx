"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { fetchWithAuth } from "@/lib/auth-utils";
import {
  cancelAppointment,
  getCancellationReasons,
  getPatientCalendarAppointments,
  syncAppointmentStatus,
  type CancellationReasonOption,
} from "@/lib/appointment-actions";
import { AppointmentCalendar } from "@/components/appointments/AppointmentCalendar";
import { AppointmentHeatmap } from "@/components/appointments/AppointmentHeatmap";
import { MonthlyAppointmentTrend } from "@/components/appointments/MonthlyAppointmentTrend";
import { PatientAppointmentSummary } from "@/components/appointments/PatientAppointmentSummary";
import { SpecialtyDistributionChart } from "@/components/appointments/SpecialtyDistributionChart";
import { UpcomingAppointmentsList } from "@/components/appointments/UpcomingAppointmentsList";
import { RescheduleAppointmentDialog } from "@/components/appointment/reschedule-appointment-dialog";
import { CancelAppointmentDialog } from "@/components/appointment/cancel-appointment-dialog";
import type { PatientAppointment, PatientSummary } from "@/components/appointments/types";
import { Button } from "@/components/ui/button";
import { cn, localDateKey } from "@/lib/utils";
import { requestReschedule } from "@/lib/availability-actions";

const MONTH_LABELS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const CANCELLED_STATUSES = new Set(["CANCELLED", "CANCELLED_BY_PATIENT", "CANCELLED_BY_DOCTOR"]);
const UPCOMING_EXCLUDED_STATUSES = new Set([
  ...CANCELLED_STATUSES,
  "COMPLETED",
  "NO_SHOW",
]);

type RangeKey = "month" | "quarter" | "year";

interface ProfileResponse {
  first_name?: string;
  last_name?: string;
  profile_photo_url?: string | null;
  patient_id?: string;
  id?: string;
}

function toPatientId(raw?: string) {
  if (!raw) return "MED-0000";
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `MED-${compact.slice(0, 4).padEnd(4, "0")}`;
}

function formatSummaryDate(date?: string) {
  if (!date) return "Not available";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "Not available";
  return value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(appointment: PatientAppointment) {
  const status = appointment.status.toUpperCase();
  if (UPCOMING_EXCLUDED_STATUSES.has(status)) return false;
  return new Date(appointment.appointment_date).getTime() >= Date.now();
}

function normalizeAppointments(raw: any[]): PatientAppointment[] {
  return raw
    .filter((item) => item?.id && item?.appointment_date)
    .map((item) => ({
      id: String(item.id),
      title: item.title || null,
      reason: item.reason || null,
      doctor_id: item.doctor_id || null,
      doctor_name: item.doctor_name || null,
      doctor_title: item.doctor_title || null,
      doctor_specialization: item.doctor_specialization || null,
      doctor_photo_url: item.doctor_photo_url || null,
      hospital_name: item.hospital_name || null,
      appointment_date: item.appointment_date,
      slot_time: item.slot_time || null,
      status: item.status || "PENDING",
    }));
}

function buildMonthlyStats(appointments: PatientAppointment[]) {
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();

  const stats = MONTH_LABELS.map((label, index) => {
    const monthIndex = 4 + index;
    const value = appointments.filter((appointment) => {
      const date = new Date(appointment.appointment_date);
      return date.getMonth() === monthIndex && date.getFullYear() === currentYear;
    }).length;

    return {
      month: label,
      value,
      isCurrent: monthIndex === currentMonthIndex,
    };
  });

  if (!stats.some((entry) => entry.isCurrent) && stats.length > 0) {
    stats[stats.length - 1].isCurrent = true;
  }

  return stats;
}

function buildSpecialtyStats(appointments: PatientAppointment[]) {
  const counts = new Map<string, number>();

  appointments.forEach((appointment) => {
    const specialty = appointment.doctor_specialization || "General Practice";
    counts.set(specialty, (counts.get(specialty) || 0) + 1);
  });

  const base = ["Cardiology", "General Practice", "Dermatology", "Neurology"];
  const normalized = base.map((name) => ({ name, value: counts.get(name) || 0 }));

  if (normalized.every((entry) => entry.value === 0)) {
    return [
      { name: "Cardiology", value: 14 },
      { name: "General Practice", value: 28 },
      { name: "Dermatology", value: 8 },
      { name: "Neurology", value: 5 },
    ];
  }

  return normalized;
}

function sortByDateAsc(items: PatientAppointment[]) {
  return [...items].sort(
    (a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime(),
  );
}

export default function PatientAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = React.useState<PatientAppointment[]>([]);
  const [patient, setPatient] = React.useState<PatientSummary>({
    fullName: "Patient",
    patientId: "MED-0000",
    avatarUrl: null,
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [range, setRange] = React.useState<RangeKey>("month");
  const [loading, setLoading] = React.useState(true);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<PatientAppointment | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<PatientAppointment | null>(null);
  const [cancelReasonOptions, setCancelReasonOptions] = React.useState<CancellationReasonOption[]>([]);
  const [cancelBufferMinutes, setCancelBufferMinutes] = React.useState<number>(60);

  const handleRescheduleConfirm = async (appointmentId: string, newDate: string, slotTime: string, notes?: string) => {
    await requestReschedule({
      appointment_id: appointmentId,
      proposed_date: newDate,
      proposed_time: slotTime,
      reason: notes || "Patient requested reschedule",
    });
    // Reload appointments
    try {
      const response = await getPatientCalendarAppointments();
      setAppointments(normalizeAppointments(response?.appointments || []));
    } catch (error) {
      console.error("Failed to reload appointments:", error);
    }
  };

  const handleCancelConfirm = async (
    appointmentId: string,
    reasonKey: string,
    cancellationReason?: string,
  ) => {
    await cancelAppointment(appointmentId, {
      reasonKey,
      reasonNote: cancellationReason,
    });

    const response = await getPatientCalendarAppointments();
    setAppointments(normalizeAppointments(response?.appointments || []));
  };

  React.useEffect(() => {
    const load = async () => {
      try {
        await syncAppointmentStatus();

        const [appointmentResponse, profileResponse, cancellationCatalog] = await Promise.all([
          getPatientCalendarAppointments(),
          fetchWithAuth("/api/auth/me"),
          getCancellationReasons("patient").catch(() => ({ bufferMinutes: 60, reasons: [] })),
        ]);

        const normalizedAppointments = normalizeAppointments(appointmentResponse?.appointments || []);
        setAppointments(normalizedAppointments);
        setCancelReasonOptions(cancellationCatalog.reasons || []);
        setCancelBufferMinutes(cancellationCatalog.bufferMinutes || 60);

        if (profileResponse?.ok) {
          const profileData = (await profileResponse.json()) as ProfileResponse;
          const fullName = `${profileData.first_name || "Patient"} ${profileData.last_name || ""}`.trim();

          setPatient({
            fullName,
            patientId: toPatientId(profileData.patient_id || profileData.id),
            avatarUrl: profileData.profile_photo_url || null,
          });
        }
      } catch (error) {
        console.error("Failed to load appointments dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const sortedAppointments = React.useMemo(() => sortByDateAsc(appointments), [appointments]);

  const upcomingAppointments = React.useMemo(
    () => sortedAppointments.filter((appointment) => isUpcoming(appointment)),
    [sortedAppointments],
  );

  const filteredUpcomingAppointments = React.useMemo(() => {
    if (!selectedDate) return upcomingAppointments;

    return sortedAppointments.filter(
      (appointment) => localDateKey(appointment.appointment_date) === selectedDate,
    );
  }, [selectedDate, upcomingAppointments, sortedAppointments]);

  const nextAppointment = upcomingAppointments[0];
  const lastVisit = [...appointments]
    .filter((appointment) => new Date(appointment.appointment_date).getTime() < Date.now())
    .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())[0];

  const monthlyStats = React.useMemo(() => buildMonthlyStats(appointments), [appointments]);
  const specialtyStats = React.useMemo(() => buildSpecialtyStats(appointments), [appointments]);

  const monthDate = React.useMemo(() => {
    const now = new Date();
    if (range === "month") return now;
    if (range === "quarter") return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return new Date(now.getFullYear(), 0, 1);
  }, [range]);

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="mx-auto max-w-6xl py-8 pt-[var(--nav-content-offset)] space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>          
            <h1 className="mt-1 text-3xl font-semibold text-foreground">My Appointments</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Comprehensive overview of your clinic visits and appointment history.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-border bg-card p-1 shadow-sm">
            {(["month", "quarter", "year"] as RangeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm capitalize transition-colors",
                  range === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4">
            <div className="h-28 rounded-2xl border border-border bg-card" />
            <div className="h-36 rounded-2xl border border-border bg-card" />
            <div className="h-80 rounded-2xl border border-border bg-card" />
          </div>
        ) : (
          <>
            <PatientAppointmentSummary
              patient={patient}
              nextAppointmentLabel={formatSummaryDate(nextAppointment?.appointment_date)}
              lastVisitLabel={formatSummaryDate(lastVisit?.appointment_date)}
              onNewAppointment={() => router.push("/patient/find-doctor")}
            />

            <AppointmentHeatmap appointments={appointments} monthDate={monthDate} />

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <MonthlyAppointmentTrend stats={monthlyStats} />
              <SpecialtyDistributionChart stats={specialtyStats} />
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <AppointmentCalendar
                appointments={appointments}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />

              <UpcomingAppointmentsList
                appointments={filteredUpcomingAppointments}
                selectedDate={selectedDate}
                onViewHistory={() => router.push("/patient/medical-history?tab=visits")}
                onRequestReschedule={setRescheduleTarget}
                onRequestCancel={setCancelTarget}
              />
            </section>

            {!selectedDate && filteredUpcomingAppointments.length > 0 ? null : (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedDate(null)}>
                  Show All Upcoming
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <RescheduleAppointmentDialog
        open={!!rescheduleTarget}
        onOpenChange={(open) => !open && setRescheduleTarget(null)}
        appointment={rescheduleTarget ? {
          id: rescheduleTarget.id,
          doctor_id: rescheduleTarget.doctor_id || undefined,
          doctor_name: rescheduleTarget.doctor_name || undefined,
          doctor_title: rescheduleTarget.doctor_title || undefined,
          appointment_date: rescheduleTarget.appointment_date,
          slot_time: rescheduleTarget.slot_time,
        } : null}
        onConfirm={handleRescheduleConfirm}
        userRole="patient"
      />

      <CancelAppointmentDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        appointment={cancelTarget ? {
          id: cancelTarget.id,
          doctor_name: cancelTarget.doctor_name || undefined,
          doctor_title: cancelTarget.doctor_title || undefined,
          appointment_date: cancelTarget.appointment_date,
          slot_time: cancelTarget.slot_time,
          reason: cancelTarget.reason || undefined,
        } : null}
        onConfirm={handleCancelConfirm}
        userRole="patient"
        reasonOptions={cancelReasonOptions}
        bufferMinutes={cancelBufferMinutes}
      />
    </AppBackground>
  );
}

