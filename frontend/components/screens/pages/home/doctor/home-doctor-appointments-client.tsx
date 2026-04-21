"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Download, CalendarDays } from "lucide-react";

import { AppointmentCalendar } from "@/components/doctor/doctor-appointments/AppointmentCalendar";
import { AppointmentListPanel } from "@/components/doctor/doctor-appointments/AppointmentListPanel";
import { AppointmentModal } from "@/components/doctor/doctor-appointments/AppointmentModal";
import { RescheduleAppointmentDialog } from "@/components/appointment/reschedule-appointment-dialog";
import { RescheduleResponseDialog } from "@/components/appointment/reschedule-response-dialog";
import { ScheduleMetrics } from "@/components/doctor/doctor-appointments/ScheduleMetrics";

const ChartSkeleton = () => (
  <div className="h-56 animate-pulse rounded-xl border border-border/60 bg-card/95 p-4" />
);

const DailyWorkloadChart = dynamic(
  () => import("@/components/doctor/doctor-appointments/DailyWorkloadChart").then((m) => m.DailyWorkloadChart),
  { ssr: false, loading: ChartSkeleton },
);

const AppointmentDensityChart = dynamic(
  () => import("@/components/doctor/doctor-appointments/AppointmentDensityChart").then((m) => m.AppointmentDensityChart),
  { ssr: false, loading: ChartSkeleton },
);
import { DoctorAppointment, MetricCard } from "@/components/doctor/doctor-appointments/types";
import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/ui/navbar";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import {
  cancelAppointment,
  getMyAppointments,
  syncAppointmentStatus,
  updateAppointment,
} from "@/lib/appointment-actions";
import { getRescheduleHistory, requestReschedule, respondToReschedule, withdrawRescheduleRequest } from "@/lib/availability-actions";
import { fetchWithAuth } from "@/lib/auth-utils";
import { localDateKey } from "@/lib/utils";

const CANCELLED_STATUSES = new Set(["CANCELLED", "CANCELLED_BY_PATIENT", "CANCELLED_BY_DOCTOR"]);

interface RescheduleHistoryItem {
  id?: string;
  requested_by_role?: string;
  proposed_date?: string;
  proposed_time?: string;
  status?: string;
  admin_approval_status?: string | null;
}

interface RescheduleHistoryPayload {
  reschedule_requests?: RescheduleHistoryItem[];
}

interface RescheduleResponseState {
  appointment: DoctorAppointment;
  request: {
    id: string;
    proposed_date: string;
    proposed_time: string;
  } | null;
}

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<DoctorAppointment[]>([]);
  const [doctorName, setDoctorName] = React.useState("Doctor");
  const [doctorId, setDoctorId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = React.useState<DoctorAppointment | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<DoctorAppointment | null>(null);
  const [rescheduleResponseTarget, setRescheduleResponseTarget] = React.useState<RescheduleResponseState | null>(null);
  const [rescheduleResponseLoading, setRescheduleResponseLoading] = React.useState(false);
  const [rescheduleResponseError, setRescheduleResponseError] = React.useState<string | null>(null);
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
      if (data?.id) {
        setDoctorId(String(data.id));
      }
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
      setActionError("Failed to load appointments. Please refresh and try again.");
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
      .filter((item) => !isTerminalAppointmentStatus(item.status))
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
        title: "Total Bookings",
        value: totalBookings.toLocaleString(),
        trend: formatPercentDelta(totalBookings, previousBookings),
        trendUp: totalBookings >= previousBookings,
        accentClass: "bg-primary/10 text-primary",
      },
      {
        title: "New Patients",
        value: uniquePatients.toLocaleString(),
        trend: formatPercentDelta(uniquePatients, previousUniquePatients),
        trendUp: uniquePatients >= previousUniquePatients,
        accentClass: "bg-primary-more-light text-primary",
      },
      {
        title: "Avg Wait Time",
        value: avgWait === null ? "N/A" : `${avgWait} min`,
        trend: avgWait === null ? "0%" : formatPercentDelta(avgWait, previousAvgWait ?? avgWait),
        trendUp: avgWait !== null && previousAvgWait !== null ? avgWait <= previousAvgWait : true,
        accentClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      },
      {
        title: "Reschedules",
        value: `${rescheduleRate.toFixed(1)}%`,
        trend: formatPercentDelta(rescheduleRate, previousRescheduleRate),
        trendUp: rescheduleRate <= previousRescheduleRate,
        accentClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
      },
    ];
  }, [appointments]);

  const workloadData = React.useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    appointments.forEach((item) => {
      if (isCancelledAppointmentStatus(item.status)) {
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
    return `Avg: ${(total / 7).toFixed(1)}/day`;
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
      if (isCancelledAppointmentStatus(item.status)) {
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

    return `${formatPercentDelta(currentWeekCount, previousWeekCount)} vs last week`;
  }, [appointments]);

  const handleStatusUpdate = async (id: string, status: DoctorAppointment["status"]) => {
    setActionError(null);
    const isCancellation = isCancelledAppointmentStatus(status);

    try {
      if (isCancellation) {
        await cancelAppointment(id, {
          reasonKey: "DOCTOR_UNAVAILABLE",
        });
      } else {
        await updateAppointment(id, { status });
      }
      await loadAppointments();
    } catch {
      setActionError("Could not update appointment status. Please try again.");
    }
  };

  const handleRescheduleConfirm = async (
    appointmentId: string,
    newDate: string,
    slotTime: string,
    notes?: string,
  ) => {
    setActionError(null);

    try {
      await requestReschedule({
        appointment_id: appointmentId,
        proposed_date: newDate,
        proposed_time: slotTime,
        reason: notes || "Doctor requested reschedule",
      });
      await loadAppointments();
      setRescheduleTarget(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Could not reschedule this appointment";
      setActionError(errorMessage);
      throw error;
    }
  };

  const resolveIncomingRescheduleRequest = React.useCallback(async (appointment: DoctorAppointment) => {
    if (appointment.reschedule_request_id && appointment.proposed_date && appointment.proposed_time) {
      const adminStatus = String(appointment.reschedule_admin_approval_status || "PENDING").toUpperCase();
      if (adminStatus !== "APPROVED") {
        throw new Error("This reschedule request is awaiting admin review.");
      }

      const requesterRole = String(appointment.reschedule_requested_by_role || "").toLowerCase();
      if (requesterRole === "doctor") {
        throw new Error("Waiting for patient response on your reschedule request.");
      }

      return {
        id: String(appointment.reschedule_request_id),
        proposed_date: String(appointment.proposed_date).slice(0, 10),
        proposed_time: String(appointment.proposed_time),
      };
    }

    const history = (await getRescheduleHistory(appointment.id)) as RescheduleHistoryPayload | null;
    const requests = Array.isArray(history?.reschedule_requests) ? history.reschedule_requests : [];

    const pendingPatientRequest = requests.find(
      (request) =>
        String(request.status || "").toLowerCase() === "pending" &&
        String(request.requested_by_role || "").toLowerCase() === "patient",
    );
    const pendingRequest =
      pendingPatientRequest ||
      requests.find((request) => String(request.status || "").toLowerCase() === "pending");

    if (!pendingRequest?.id || !pendingRequest.proposed_date || !pendingRequest.proposed_time) {
      throw new Error("No pending reschedule request is available for this appointment.");
    }

    const adminStatus = String(pendingRequest.admin_approval_status || "PENDING").toUpperCase();
    if (adminStatus !== "APPROVED") {
      throw new Error("This reschedule request is awaiting admin review.");
    }

    const requesterRole = String(pendingRequest.requested_by_role || "").toLowerCase();
    if (requesterRole === "doctor") {
      throw new Error("Waiting for patient response on your reschedule request.");
    }

    return {
      id: String(pendingRequest.id),
      proposed_date: String(pendingRequest.proposed_date).slice(0, 10),
      proposed_time: String(pendingRequest.proposed_time),
    };
  }, []);

  const resolveOwnPendingRescheduleRequest = React.useCallback(async (appointment: DoctorAppointment) => {
    if (
      appointment.reschedule_request_id &&
      String(appointment.reschedule_requested_by_role || "").toLowerCase() === "doctor"
    ) {
      return { id: String(appointment.reschedule_request_id) };
    }

    const history = (await getRescheduleHistory(appointment.id)) as RescheduleHistoryPayload | null;
    const requests = Array.isArray(history?.reschedule_requests) ? history.reschedule_requests : [];
    const pendingOwnRequest = requests.find(
      (request) =>
        String(request.status || "").toLowerCase() === "pending" &&
        String(request.requested_by_role || "").toLowerCase() === "doctor",
    );

    if (!pendingOwnRequest?.id) {
      throw new Error("No pending reschedule request is available to withdraw.");
    }

    return { id: String(pendingOwnRequest.id) };
  }, []);

  const handleRespondReschedule = async (appointment: DoctorAppointment) => {
    setActionError(null);
    setRescheduleResponseError(null);
    setRescheduleResponseLoading(true);
    setRescheduleResponseTarget({ appointment, request: null });

    try {
      const resolved = await resolveIncomingRescheduleRequest(appointment);
      setRescheduleResponseTarget({ appointment, request: resolved });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to load this reschedule request.";
      setActionError(errorMessage);
      setRescheduleResponseError(errorMessage);
      setRescheduleResponseTarget({ appointment, request: null });
    } finally {
      setRescheduleResponseLoading(false);
    }
  };

  const handleRescheduleResponse = async (requestId: string, accept: boolean) => {
    setActionError(null);
    await respondToReschedule(
      requestId,
      accept,
      accept ? "Accepted by doctor" : "Rejected by doctor",
    );
    await loadAppointments();
    setRescheduleResponseTarget(null);
    setRescheduleResponseError(null);
    setRescheduleResponseLoading(false);
  };

  const handleWithdrawReschedule = async (appointment: DoctorAppointment) => {
    setActionError(null);

    try {
      const resolved = await resolveOwnPendingRescheduleRequest(appointment);
      await withdrawRescheduleRequest(resolved.id, "Withdrawn by doctor");
      await loadAppointments();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to withdraw this reschedule request.";
      setActionError(errorMessage);
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 pb-10 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
          <PageLoadingShell label="Loading schedule dashboard..." cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
        <div className="space-y-6">
          <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Dashboard Overview</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Schedule Performance</h1>
              <p className="mt-2 text-sm text-muted-foreground">Good morning, Dr. {doctorName}. Here&apos;s your clinic activity for today.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="h-11">
                <CalendarDays className="h-4 w-4" />
                This Week
              </Button>
              <Button className="h-11">
                <Download className="h-4 w-4" />
                Export Report
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
        onRescheduleRequest={(appointment) => setRescheduleTarget(appointment)}
        onRespondReschedule={handleRespondReschedule}
        onWithdrawReschedule={handleWithdrawReschedule}
      />

      <RescheduleAppointmentDialog
        open={!!rescheduleTarget}
        onOpenChange={(open) => !open && setRescheduleTarget(null)}
        appointment={
          rescheduleTarget
            ? {
                id: rescheduleTarget.id,
                doctor_id: rescheduleTarget.doctor_id || doctorId || undefined,
                patient_name: rescheduleTarget.patient_name,
                appointment_date: rescheduleTarget.appointment_date,
                slot_time: rescheduleTarget.slot_time || null,
                reason: rescheduleTarget.reason || undefined,
              }
            : null
        }
        onConfirm={handleRescheduleConfirm}
        userRole="doctor"
      />

      <RescheduleResponseDialog
        open={!!rescheduleResponseTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRescheduleResponseTarget(null);
            setRescheduleResponseLoading(false);
            setRescheduleResponseError(null);
          }
        }}
        appointment={
          rescheduleResponseTarget
            ? {
                id: rescheduleResponseTarget.appointment.id,
                patient_name: rescheduleResponseTarget.appointment.patient_name,
                appointment_date: rescheduleResponseTarget.appointment.appointment_date,
                slot_time: rescheduleResponseTarget.appointment.slot_time || null,
              }
            : null
        }
        request={rescheduleResponseTarget?.request || null}
        isResolving={rescheduleResponseLoading}
        resolveError={rescheduleResponseError}
        onAccept={(requestId) => handleRescheduleResponse(requestId, true)}
        onReject={(requestId) => handleRescheduleResponse(requestId, false)}
        messages={{
          title: "Patient proposed a new time",
          description: "Review the proposed schedule and accept or reject this reschedule request.",
          currentTimeLabel: "Current appointment",
          proposedTimeLabel: "Patient proposal",
        }}
      />
    </AppBackground>
  );
}

function uniqueById(appointments: DoctorAppointment[]) {
  return appointments.filter((item, index, all) => index === all.findIndex((entry) => entry.id === item.id));
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeAppointment(raw: unknown): DoctorAppointment | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const idValue = toStringOrNull(row.id);
  const dateValue = toStringOrNull(row.appointment_date);
  const patientName = toStringOrNull(row.patient_name);

  if (!idValue || !dateValue || !patientName) {
    return null;
  }

  const statusValue = String(toStringOrNull(row.status) || "PENDING").toUpperCase();
  const status = [
    "PENDING",
    "CONFIRMED",
    "COMPLETED",
    "CANCELLED",
    "CANCELLED_BY_PATIENT",
    "CANCELLED_BY_DOCTOR",
    "PENDING_ADMIN_REVIEW",
    "PENDING_DOCTOR_CONFIRMATION",
    "PENDING_PATIENT_CONFIRMATION",
    "RESCHEDULE_REQUESTED",
    "CANCEL_REQUESTED",
    "NO_SHOW",
  ].includes(statusValue)
    ? (statusValue as DoctorAppointment["status"])
    : "PENDING";

  return {
    id: String(idValue),
    doctor_id: toStringOrNull(row.doctor_id),
    appointment_date: String(dateValue),
    slot_time: toStringOrNull(row.slot_time),
    status,
    patient_name: String(patientName),
    patient_id: toStringOrNull(row.patient_id),
    patient_ref: toStringOrNull(row.patient_ref),
    patient_age: typeof row.patient_age === "number" ? row.patient_age : null,
    patient_gender: toStringOrNull(row.patient_gender),
    patient_phone: toStringOrNull(row.patient_phone),
    reason: toStringOrNull(row.reason),
    notes: toStringOrNull(row.notes),
    cancellation_reason_key: toStringOrNull(row.cancellation_reason_key),
    cancellation_reason_note: toStringOrNull(row.cancellation_reason_note),
    cancelled_at: toStringOrNull(row.cancelled_at),
    reschedule_request_id: toStringOrNull(row.reschedule_request_id),
    reschedule_requested_by_role: toStringOrNull(row.reschedule_requested_by_role),
    proposed_date: toStringOrNull(row.proposed_date),
    proposed_time: toStringOrNull(row.proposed_time),
    reschedule_admin_approval_status: toStringOrNull(row.reschedule_admin_approval_status),
    blood_group: toStringOrNull(row.blood_group),
    chronic_conditions: Array.isArray(row.chronic_conditions)
      ? row.chronic_conditions.filter((value): value is string => typeof value === "string")
      : [],
    location: toStringOrNull(row.location),
  };
}

function isCancelledAppointmentStatus(status: string) {
  return CANCELLED_STATUSES.has(status.toUpperCase());
}

function isTerminalAppointmentStatus(status: string) {
  const value = status.toUpperCase();
  return isCancelledAppointmentStatus(value) || value === "COMPLETED" || value === "NO_SHOW";
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
