"use client";

import React from "react";
import { Download, CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";

import { AppointmentCalendar } from "@/components/doctor/doctor-appointments/AppointmentCalendar";
import { AppointmentDensityChart } from "@/components/doctor/doctor-appointments/AppointmentDensityChart";
import { AppointmentListPanel } from "@/components/doctor/doctor-appointments/AppointmentListPanel";
import { AppointmentModal } from "@/components/doctor/doctor-appointments/AppointmentModal";
import { DailyWorkloadChart } from "@/components/doctor/doctor-appointments/DailyWorkloadChart";
import { ScheduleMetrics } from "@/components/doctor/doctor-appointments/ScheduleMetrics";
import { DoctorAppointment, MetricCard } from "@/components/doctor/doctor-appointments/types";
import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { Navbar } from "@/components/ui/navbar";
import { getMyAppointments, syncAppointmentStatus, updateAppointment, requestRescheduleAppointment } from "@/lib/appointment-actions";
import { fetchWithAuth } from "@/lib/auth-utils";
import { localDateKey } from "@/lib/utils";

export default function DoctorAppointmentsPage() {
  const t = useTranslations("doctorAppointmentsPage");
  const [appointments, setAppointments] = React.useState<DoctorAppointment[]>([]);
  const [doctorName, setDoctorName] = React.useState(t("fallback.doctorName"));
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = React.useState<DoctorAppointment | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const init = async () => {
      await Promise.all([syncAppointmentStatus(), loadDoctorProfile()]);
      await loadAppointments();
    };

    init();
  }, []);

  const loadDoctorProfile = async () => {
    try {
      const response = await fetchWithAuth("/api/auth/me");
      if (!response?.ok) {
        return;
      }

      const data = await response.json();
      const fullName = `${data?.first_name || ""} ${data?.last_name || ""}`.trim();
      if (fullName) {
        setDoctorName(fullName);
      }
    } catch {
      // Keep fallback display name.
    }
  };

  const loadAppointments = async () => {
    try {
      setActionError(null);
      const data = await getMyAppointments();
      const normalized = (Array.isArray(data) ? data : []).map(normalizeAppointment).filter(Boolean) as DoctorAppointment[];
      setAppointments(uniqueById(normalized));
    } catch {
      setActionError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const panelAppointments = React.useMemo(() => {
    if (selectedDate) {
      return appointments
        .filter((item) => localDateKey(item.appointment_date) === selectedDate)
        .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());
    }

    const now = Date.now();
    const upcoming = appointments
      .filter((item) => new Date(item.appointment_date).getTime() >= now)
      .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

    return upcoming.slice(0, 8);
  }, [appointments, selectedDate]);

  const metrics = React.useMemo<MetricCard[]>(() => {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const currentMonthAppointments = appointments.filter((item) => new Date(item.appointment_date) >= currentMonthStart);
    const previousMonthAppointments = appointments.filter((item) => {
      const date = new Date(item.appointment_date);
      return date >= previousMonthStart && date < currentMonthStart;
    });

    const totalBookings = currentMonthAppointments.length;
    const previousBookings = previousMonthAppointments.length;
    const uniquePatients = new Set(
      currentMonthAppointments.map((item) => item.patient_ref || item.patient_id || item.patient_name)
    ).size;
    const previousUniquePatients = new Set(
      previousMonthAppointments.map((item) => item.patient_ref || item.patient_id || item.patient_name)
    ).size;
    const reschedules = currentMonthAppointments.filter((item) => (item.notes || "").toLowerCase().includes("rescheduled")).length;
    const previousReschedules = previousMonthAppointments.filter((item) => (item.notes || "").toLowerCase().includes("rescheduled")).length;
    const rescheduleRate = totalBookings > 0 ? (reschedules / totalBookings) * 100 : 0;
    const previousRescheduleRate = previousBookings > 0 ? (previousReschedules / previousBookings) * 100 : 0;

    const waitValues = currentMonthAppointments
      .map((item) => extractWaitMinutes(item.notes))
      .filter((value): value is number => value !== null);

    const previousWaitValues = previousMonthAppointments
      .map((item) => extractWaitMinutes(item.notes))
      .filter((value): value is number => value !== null);

    const avgWait = waitValues.length > 0 ? Math.round(waitValues.reduce((a, b) => a + b, 0) / waitValues.length) : null;
    const previousAvgWait = previousWaitValues.length > 0 ? Math.round(previousWaitValues.reduce((a, b) => a + b, 0) / previousWaitValues.length) : null;

    return [
      {
        title: t("metrics.totalBookings"),
        value: totalBookings.toLocaleString(),
        trend: formatPercentDelta(totalBookings, previousBookings),
        trendUp: totalBookings >= previousBookings,
        accentClass: "bg-primary/10 text-primary",
      },
      {
        title: t("metrics.newPatients"),
        value: uniquePatients.toLocaleString(),
        trend: formatPercentDelta(uniquePatients, previousUniquePatients),
        trendUp: uniquePatients >= previousUniquePatients,
        accentClass: "bg-primary-more-light text-primary",
      },
      {
        title: t("metrics.avgWaitTime"),
        value: avgWait === null ? t("fallback.notAvailable") : t("units.minutes", { value: avgWait }),
        trend: avgWait === null ? "0%" : formatPercentDelta(avgWait, previousAvgWait ?? avgWait),
        trendUp: avgWait !== null && previousAvgWait !== null ? avgWait <= previousAvgWait : true,
        accentClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      },
      {
        title: t("metrics.reschedules"),
        value: `${rescheduleRate.toFixed(1)}%`,
        trend: formatPercentDelta(rescheduleRate, previousRescheduleRate),
        trendUp: rescheduleRate <= previousRescheduleRate,
        accentClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      },
    ];
  }, [appointments]);

  const workloadData = React.useMemo(() => {
    const labels = [
      t("weekdays.mon"),
      t("weekdays.tue"),
      t("weekdays.wed"),
      t("weekdays.thu"),
      t("weekdays.fri"),
      t("weekdays.sat"),
      t("weekdays.sun"),
    ];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    appointments.forEach((item) => {
      if (item.status === "CANCELLED") {
        return;
      }
      const date = new Date(item.appointment_date);
      const day = date.getDay();
      const mondayBased = day === 0 ? 6 : day - 1;
      counts[mondayBased] += 1;
    });

    return labels.map((day, index) => ({ day, patients: counts[index] }));
  }, [appointments]);

  const workloadAverageLabel = React.useMemo(() => {
    const total = workloadData.reduce((sum, item) => sum + item.patients, 0);
    return t("labels.averagePerDay", { value: (total / 7).toFixed(1) });
  }, [workloadData]);

  const densityData = React.useMemo(() => {
    const bucketMeta = [
      { hour: 8, label: "08 AM" },
      { hour: 10, label: "10 AM" },
      { hour: 12, label: "12 PM" },
      { hour: 14, label: "02 PM" },
      { hour: 16, label: "04 PM" },
      { hour: 18, label: "06 PM" },
      { hour: 20, label: "08 PM" },
    ];

    const counts = bucketMeta.map(() => 0);

    appointments.forEach((item) => {
      if (item.status === "CANCELLED") {
        return;
      }

      const hour = new Date(item.appointment_date).getHours();
      const nearestIndex = bucketMeta.reduce((best, current, index) => {
        const bestDistance = Math.abs(bucketMeta[best].hour - hour);
        const currentDistance = Math.abs(current.hour - hour);
        return currentDistance < bestDistance ? index : best;
      }, 0);

      counts[nearestIndex] += 1;
    });

    return bucketMeta.map((bucket, index) => ({ time: bucket.label, density: counts[index] }));
  }, [appointments]);

  const densityDeltaLabel = React.useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const previousWeekStart = new Date(startOfWeek);
    previousWeekStart.setDate(startOfWeek.getDate() - 7);
    const previousWeekEnd = new Date(startOfWeek);

    const currentWeekCount = appointments.filter((item) => {
      const date = new Date(item.appointment_date);
      return date >= startOfWeek && date <= now;
    }).length;

    const previousWeekCount = appointments.filter((item) => {
      const date = new Date(item.appointment_date);
      return date >= previousWeekStart && date < previousWeekEnd;
    }).length;

    return t("labels.vsLastWeek", { value: formatPercentDelta(currentWeekCount, previousWeekCount) });
  }, [appointments]);

  const handleStatusUpdate = async (id: string, status: DoctorAppointment["status"]) => {
    const previous = appointments;
    setActionError(null);
    setAppointments((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));

    try {
      await updateAppointment(id, { status });
    } catch {
      setAppointments(previous);
      setActionError(t("errors.updateStatusFailed"));
    }
  };

  const handleReschedule = async (id: string, newTime: string) => {
    const target = appointments.find((item) => item.id === id);
    if (!target) {
      return;
    }

    const currentDate = new Date(target.appointment_date);
    const [hours, minutes] = newTime.split(":").map(Number);
    const rescheduledDate = new Date(currentDate);
    rescheduledDate.setHours(hours, minutes, 0, 0);

    const previous = appointments;
    setActionError(null);
    setAppointments((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              appointment_date: rescheduledDate.toISOString(),
              status: "PENDING",
              notes: `Rescheduled to ${newTime}`,
            }
          : item,
      ),
    );

    try {
      // Request reschedule - sends notification to patient
      await requestRescheduleAppointment(id, rescheduledDate.toISOString());
    } catch (error) {
      setAppointments(previous);
      const errorMessage = error instanceof Error ? error.message : t("errors.rescheduleFailed");
      setActionError(errorMessage);
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-(--nav-content-offset) sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-24">
            <MedoraLoader size="lg" label={t("loading")} />
          </div>
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-(--nav-content-offset) sm:px-6 lg:px-8">
        <div className="space-y-6">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{t("overviewLabel")}</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("title")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("subtitle", { doctorName })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-11">
                <CalendarDays className="h-4 w-4" />
                {t("actions.thisWeek")}
              </Button>
              <Button className="h-11">
                <Download className="h-4 w-4" />
                {t("actions.exportReport")}
              </Button>
            </div>
          </section>

          {actionError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          <ScheduleMetrics metrics={metrics} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DailyWorkloadChart data={workloadData} averageLabel={workloadAverageLabel} />
            <AppointmentDensityChart data={densityData} deltaLabel={densityDeltaLabel} />
          </section>

          <section className="grid grid-cols-1 items-stretch gap-6 xl:grid-cols-3">
            <div className="min-h-168 xl:col-span-2">
              <AppointmentCalendar
                appointments={appointments}
                selectedDate={selectedDate}
                onDateSelect={setSelectedDate}
              />
            </div>
            <div className="min-h-168 xl:col-span-1">
              <AppointmentListPanel
                appointments={panelAppointments}
                selectedDate={selectedDate}
                onSelectAppointment={(appointment) => {
                  setSelectedAppointment(appointment);
                  setIsModalOpen(true);
                }}
              />
            </div>
          </section>
        </div>
      </main>

      <AppointmentModal
        appointment={selectedAppointment}
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        onApprove={(id) => handleStatusUpdate(id, "CONFIRMED")}
        onCancel={(id) => handleStatusUpdate(id, "CANCELLED")}
        onReschedule={handleReschedule}
      />
    </AppBackground>
  );
}

function uniqueById(appointments: DoctorAppointment[]) {
  return appointments.filter((item, index, all) => index === all.findIndex((entry) => entry.id === item.id));
}

function normalizeAppointment(raw: any): DoctorAppointment | null {
  const idValue = raw?.id;
  const dateValue = raw?.appointment_date;
  const patientName = raw?.patient_name;

  if (!idValue || !dateValue || !patientName) {
    return null;
  }

  const statusValue = String(raw?.status || "PENDING").toUpperCase();
  const status = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"].includes(statusValue)
    ? (statusValue as DoctorAppointment["status"])
    : "PENDING";

  return {
    id: String(idValue),
    appointment_date: String(dateValue),
    status,
    patient_name: String(patientName),
    patient_id: raw?.patient_id || null,
    patient_ref: raw?.patient_ref || null,
    patient_age: raw?.patient_age ?? null,
    patient_gender: raw?.patient_gender ?? null,
    patient_phone: raw?.patient_phone ?? null,
    reason: raw?.reason ?? null,
    notes: raw?.notes ?? null,
    blood_group: raw?.blood_group ?? null,
    chronic_conditions: Array.isArray(raw?.chronic_conditions) ? raw.chronic_conditions : [],
    location: raw?.location ?? null,
  };
}

function formatPercentDelta(current: number, previous: number) {
  if (!Number.isFinite(previous) || previous === 0) {
    return current === 0 ? "0%" : "+100%";
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(delta * 10) / 10;
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function extractWaitMinutes(notes: string | null | undefined) {
  if (!notes) {
    return null;
  }

  const match = notes.match(/wait\s*[:=-]?\s*(\d{1,3})\s*min/i);
  if (!match?.[1]) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
