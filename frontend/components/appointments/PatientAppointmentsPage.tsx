"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { fetchWithAuth } from "@/lib/auth-utils";
import {
  cancelAppointment,
  deletePendingAppointmentRequest,
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
import { RescheduleResponseDialog } from "@/components/appointment/reschedule-response-dialog";
import type { PatientAppointment, PatientSummary } from "@/components/appointments/types";
import { Button } from "@/components/ui/button";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { cn, localDateKey } from "@/lib/utils";
import { getRescheduleHistory, requestReschedule, respondToReschedule, withdrawRescheduleRequest } from "@/lib/availability-actions";
import { useAppI18n, useT } from "@/i18n/client";

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
  appointment: PatientAppointment;
  request: {
    id: string;
    proposed_date: string;
    proposed_time: string;
  } | null;
}

function toPatientId(raw?: string) {
  if (!raw) return "MED-0000";
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `MED-${compact.slice(0, 4).padEnd(4, "0")}`;
}

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

function formatSummaryDate(date: string | undefined, locale: string, notAvailableLabel: string) {
  if (!date) return notAvailableLabel;
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return notAvailableLabel;
  return value.toLocaleDateString(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUpcoming(appointment: PatientAppointment) {
  const status = appointment.status.toUpperCase();
  const holdExpiredCancellation =
    (status === "CANCELLED" || status === "CANCELLED_BY_PATIENT" || status === "CANCELLED_BY_DOCTOR") &&
    (appointment.cancellation_reason_key || "").toUpperCase() === "HOLD_EXPIRED";

  if (holdExpiredCancellation) {
    const appointmentTs = new Date(appointment.appointment_date).getTime();
    const recentWindowMs = 24 * 60 * 60 * 1000;
    return appointmentTs >= Date.now() - recentWindowMs;
  }

  if (UPCOMING_EXCLUDED_STATUSES.has(status)) return false;
  return new Date(appointment.appointment_date).getTime() >= Date.now();
}

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeAppointments(raw: unknown[]): PatientAppointment[] {
  return raw
    .map((item): PatientAppointment | null => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const id = asOptionalString(row.id);
      const appointmentDate = asOptionalString(row.appointment_date);
      if (!id || !appointmentDate) return null;

      return {
        id,
        title: asOptionalString(row.title),
        reason: asOptionalString(row.reason),
        doctor_id: asOptionalString(row.doctor_id),
        doctor_name: asOptionalString(row.doctor_name),
        doctor_title: asOptionalString(row.doctor_title),
        doctor_specialization: asOptionalString(row.doctor_specialization),
        doctor_photo_url: asOptionalString(row.doctor_photo_url),
        hospital_name: asOptionalString(row.hospital_name),
        appointment_date: appointmentDate,
        slot_time: asOptionalString(row.slot_time),
        status: asOptionalString(row.status) || "PENDING",
        hold_expires_at: asOptionalString(row.hold_expires_at),
        cancellation_reason_key: asOptionalString(row.cancellation_reason_key),
        cancellation_reason_note: asOptionalString(row.cancellation_reason_note),
        reschedule_request_id: asOptionalString(row.reschedule_request_id),
        reschedule_requested_by_role:
          asOptionalString(row.reschedule_requested_by_role) ||
          asOptionalString(row.requested_by),
        proposed_date: asOptionalString(row.proposed_date),
        proposed_time: asOptionalString(row.proposed_time),
        reschedule_admin_approval_status: asOptionalString(row.reschedule_admin_approval_status),
      };
    })
    .filter((item): item is PatientAppointment => item !== null);
}

function buildMonthlyStats(appointments: PatientAppointment[], monthLabels: string[]) {
  const now = new Date();
  const currentMonthIndex = now.getMonth();
  const currentYear = now.getFullYear();

  const stats = monthLabels.map((label, index) => {
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

function normalizeRole(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function normalizeRequestStatus(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function coerceIsoDate(value?: string | null) {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.includes("T") ? trimmed.slice(0, 10) : trimmed;
}

function hasInlineRescheduleData(appointment: PatientAppointment) {
  return Boolean(
    appointment.reschedule_request_id &&
      appointment.proposed_date &&
      appointment.proposed_time,
  );
}

export default function PatientAppointmentsPage() {
  const router = useRouter();
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const defaultPatientName = tCommon("patientAppointments.page.defaults.patientName");
  const rescheduleSentMessage = tCommon("patientAppointments.page.feedback.rescheduleSent");
  const waitingDoctorMessage = tCommon("patientAppointments.page.feedback.waitingDoctor");
  const waitingAdminRescheduleMessage = tCommon("patientAppointments.page.feedback.waitingAdminReschedule");
  const rescheduleRequestMissingMessage = tCommon("patientAppointments.page.feedback.rescheduleRequestMissing");
  const rescheduleLoadFailedMessage = tCommon("patientAppointments.page.feedback.rescheduleLoadFailed");
  const rescheduleAcceptedMessage = tCommon("patientAppointments.page.feedback.rescheduleAccepted");
  const rescheduleRejectedMessage = tCommon("patientAppointments.page.feedback.rescheduleRejected");
  const rescheduleWithdrawnMessage = tCommon("patientAppointments.page.feedback.rescheduleWithdrawn");
  const rescheduleWithdrawFailedMessage = tCommon("patientAppointments.page.feedback.rescheduleWithdrawFailed");
  const cancelSuccessMessage = tCommon("patientAppointments.page.feedback.cancelSuccess");
  const pendingDeletedMessage = tCommon("patientAppointments.page.feedback.pendingDeleted");
  const pendingDeleteFailedMessage = tCommon("patientAppointments.page.feedback.pendingDeleteFailed");
  const monthLabels = React.useMemo(
    () => [
      tCommon("patientAppointments.monthlyTrend.months.may"),
      tCommon("patientAppointments.monthlyTrend.months.jun"),
      tCommon("patientAppointments.monthlyTrend.months.jul"),
      tCommon("patientAppointments.monthlyTrend.months.aug"),
      tCommon("patientAppointments.monthlyTrend.months.sep"),
      tCommon("patientAppointments.monthlyTrend.months.oct"),
    ],
    [tCommon],
  );

  const [appointments, setAppointments] = React.useState<PatientAppointment[]>([]);
  const [patient, setPatient] = React.useState<PatientSummary>({
    fullName: defaultPatientName,
    patientId: "MED-0000",
    avatarUrl: null,
  });
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [range, setRange] = React.useState<RangeKey>("month");
  const [loading, setLoading] = React.useState(true);
  const [rescheduleTarget, setRescheduleTarget] = React.useState<PatientAppointment | null>(null);
  const [rescheduleResponseTarget, setRescheduleResponseTarget] = React.useState<RescheduleResponseState | null>(null);
  const [rescheduleResponseLoading, setRescheduleResponseLoading] = React.useState(false);
  const [rescheduleResponseError, setRescheduleResponseError] = React.useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<PatientAppointment | null>(null);
  const [cancelReasonOptions, setCancelReasonOptions] = React.useState<CancellationReasonOption[]>([]);
  const [cancelBufferMinutes, setCancelBufferMinutes] = React.useState<number>(60);
  const [actionFeedback, setActionFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  const [showAllAppointments, setShowAllAppointments] = React.useState(false);
  const [appointmentsHasMore, setAppointmentsHasMore] = React.useState(false);
  const [appointmentsTotal, setAppointmentsTotal] = React.useState(0);

  const reloadAppointments = React.useCallback(async (overrideShowAll?: boolean) => {
    const showAll = overrideShowAll ?? showAllAppointments;
    const response = await getPatientCalendarAppointments(showAll ? { showAll: true } : {});
    setAppointments(normalizeAppointments(response?.appointments || []));
    setAppointmentsHasMore(Boolean(response?.has_more));
    setAppointmentsTotal(Number(response?.total || 0));
  }, [showAllAppointments]);

  const handleRescheduleConfirm = async (appointmentId: string, newDate: string, slotTime: string, notes?: string) => {
    setActionFeedback(null);
    await requestReschedule({
      appointment_id: appointmentId,
      proposed_date: newDate,
      proposed_time: slotTime,
      reason: notes || tCommon("patientAppointments.upcoming.reschedule"),
    });
    await reloadAppointments();
    setActionFeedback({ type: "success", message: rescheduleSentMessage });
  };

  const resolveRescheduleRequest = React.useCallback(async (appointment: PatientAppointment) => {
    if (hasInlineRescheduleData(appointment)) {
      const requesterRole = normalizeRole(appointment.reschedule_requested_by_role || "");
      const inlineAdminStatus = normalizeRequestStatus(appointment.reschedule_admin_approval_status);
      if (!requesterRole || requesterRole === "doctor") {
        if (inlineAdminStatus && inlineAdminStatus !== "approved") {
          throw new Error(waitingAdminRescheduleMessage);
        }
        return {
          id: String(appointment.reschedule_request_id),
          proposed_date: coerceIsoDate(appointment.proposed_date),
          proposed_time: String(appointment.proposed_time),
        };
      }
      throw new Error(waitingDoctorMessage);
    }

    const history = (await getRescheduleHistory(appointment.id)) as RescheduleHistoryPayload | null;
    const requests = Array.isArray(history?.reschedule_requests) ? history!.reschedule_requests! : [];

    const pendingDoctorRequest = requests.find(
      (request) =>
        normalizeRequestStatus(request.status) === "pending" &&
        normalizeRole(request.requested_by_role) === "doctor",
    );

    if (pendingDoctorRequest && (pendingDoctorRequest.admin_approval_status || "PENDING").toUpperCase() !== "APPROVED") {
      throw new Error(waitingAdminRescheduleMessage);
    }

    if (!pendingDoctorRequest?.id || !pendingDoctorRequest.proposed_date || !pendingDoctorRequest.proposed_time) {
      const hasPendingRequest = requests.some((request) => normalizeRequestStatus(request.status) === "pending");
      if (hasPendingRequest) {
        throw new Error(waitingDoctorMessage);
      }
      throw new Error(rescheduleRequestMissingMessage);
    }

    return {
      id: String(pendingDoctorRequest.id),
      proposed_date: coerceIsoDate(pendingDoctorRequest.proposed_date),
      proposed_time: String(pendingDoctorRequest.proposed_time),
    };
  }, [rescheduleRequestMissingMessage, waitingDoctorMessage, waitingAdminRescheduleMessage]);

  const resolveOwnPendingRescheduleRequest = React.useCallback(async (appointment: PatientAppointment) => {
    if (
      appointment.reschedule_request_id &&
      normalizeRole(appointment.reschedule_requested_by_role) === "patient"
    ) {
      return { id: String(appointment.reschedule_request_id) };
    }

    const history = (await getRescheduleHistory(appointment.id)) as RescheduleHistoryPayload | null;
    const requests = Array.isArray(history?.reschedule_requests) ? history!.reschedule_requests! : [];
    const pendingOwnRequest = requests.find(
      (request) =>
        normalizeRequestStatus(request.status) === "pending" &&
        normalizeRole(request.requested_by_role) === "patient",
    );

    if (!pendingOwnRequest?.id) {
      throw new Error(rescheduleRequestMissingMessage);
    }

    return { id: String(pendingOwnRequest.id) };
  }, [rescheduleRequestMissingMessage]);

  const handleRescheduleAction = async (appointment: PatientAppointment) => {
    const status = appointment.status.toUpperCase();

    if (status === "CONFIRMED") {
      setRescheduleTarget(appointment);
      return;
    }

    if (status !== "RESCHEDULE_REQUESTED") {
      return;
    }

    setActionFeedback(null);
    setRescheduleResponseError(null);
    setRescheduleResponseLoading(true);
    setRescheduleResponseTarget({ appointment, request: null });

    try {
      const resolved = await resolveRescheduleRequest(appointment);
      setRescheduleResponseTarget({
        appointment,
        request: resolved,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : rescheduleLoadFailedMessage;
      setRescheduleResponseError(message);
      setRescheduleResponseTarget({ appointment, request: null });
      setActionFeedback({
        type: message === waitingDoctorMessage ? "success" : "error",
        message,
      });
    } finally {
      setRescheduleResponseLoading(false);
    }
  };

  const handleRescheduleResponse = async (requestId: string, accept: boolean) => {
    setActionFeedback(null);
    await respondToReschedule(
      requestId,
      accept,
      accept ? tCommon("patientAppointments.dialogs.rescheduleResponse.accept") : tCommon("patientAppointments.dialogs.rescheduleResponse.reject"),
    );
    await reloadAppointments();
    setRescheduleResponseTarget(null);
    setRescheduleResponseError(null);
    setRescheduleResponseLoading(false);
    setActionFeedback({
      type: "success",
      message: accept ? rescheduleAcceptedMessage : rescheduleRejectedMessage,
    });
  };

  const handleWithdrawReschedule = async (appointment: PatientAppointment) => {
    setActionFeedback(null);
    try {
      const resolved = await resolveOwnPendingRescheduleRequest(appointment);
      await withdrawRescheduleRequest(resolved.id, "Withdrawn by patient");
      await reloadAppointments();
      setActionFeedback({ type: "success", message: rescheduleWithdrawnMessage });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : rescheduleWithdrawFailedMessage;
      setActionFeedback({ type: "error", message });
    }
  };

  const handleCancelConfirm = async (
    appointmentId: string,
    reasonKey: string,
    cancellationReason?: string,
  ) => {
    setActionFeedback(null);
    await cancelAppointment(appointmentId, {
      reasonKey,
      reasonNote: cancellationReason,
    });

    await reloadAppointments();
    setActionFeedback({ type: "success", message: cancelSuccessMessage });
  };

  const handleDeletePending = async (appointmentId: string) => {
    try {
      setActionFeedback(null);
      await deletePendingAppointmentRequest(appointmentId);
      await reloadAppointments();
      setActionFeedback({ type: "success", message: pendingDeletedMessage });
    } catch (error) {
      console.error("Failed to delete pending appointment request:", error);
      setActionFeedback({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : pendingDeleteFailedMessage,
      });
    }
  };

  React.useEffect(() => {
    const load = async () => {
      try {
        // Critical render path: parallelize calendar + profile + cancellation reasons.
        // syncAppointmentStatus is fire-and-forget (auto-completes past appointments)
        // and runs in parallel rather than blocking initial paint.
        const syncPromise = syncAppointmentStatus().catch((error) => {
          console.warn("Background appointment status sync failed", error);
        });

        const [appointmentResponse, profileResponse, cancellationCatalog] = await Promise.all([
          getPatientCalendarAppointments(showAllAppointments ? { showAll: true } : {}),
          fetchWithAuth("/api/auth/me"),
          getCancellationReasons("patient").catch(() => ({ bufferMinutes: 60, reasons: [] })),
        ]);

        const normalizedAppointments = normalizeAppointments(appointmentResponse?.appointments || []);
        setAppointments(normalizedAppointments);
        setAppointmentsHasMore(Boolean(appointmentResponse?.has_more));
        setAppointmentsTotal(Number(appointmentResponse?.total || 0));
        setCancelReasonOptions(cancellationCatalog.reasons || []);
        setCancelBufferMinutes(cancellationCatalog.bufferMinutes || 60);

        if (profileResponse?.ok) {
          const profileData = (await profileResponse.json()) as ProfileResponse;
          const fullName = `${profileData.first_name || defaultPatientName} ${profileData.last_name || ""}`.trim();

          setPatient({
            fullName,
            patientId: toPatientId(profileData.patient_id || profileData.id),
            avatarUrl: profileData.profile_photo_url || null,
          });
        }

        // After first paint, await the sync; if it changed anything we silently refresh.
        const syncResult = await syncPromise;
        if (syncResult && typeof syncResult === "object" && "updated_count" in syncResult && (syncResult as { updated_count?: number }).updated_count) {
          await reloadAppointments();
        }
      } catch (error) {
        console.error("Failed to load appointments dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPatientName, showAllAppointments]);

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
  const summaryNotAvailableLabel = tCommon("patientAppointments.summary.notAvailable");

  const monthlyStats = React.useMemo(() => buildMonthlyStats(appointments, monthLabels), [appointments, monthLabels]);
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
            <h1 className="mt-1 text-3xl font-semibold text-foreground">{tCommon("patientAppointments.page.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tCommon("patientAppointments.page.subtitle")}
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
                {tCommon(`patientAppointments.page.range.${key}`)}
              </button>
            ))}
          </div>
        </div>

        {actionFeedback ? (
          <div
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              actionFeedback.type === "success"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
          >
            {actionFeedback.message}
          </div>
        ) : null}

        {loading ? (
          <PageLoadingShell label={tCommon("patientAppointments.page.loading")} cardCount={4} loaderSize="md" />
        ) : (
          <>
            <PatientAppointmentSummary
              patient={patient}
              nextAppointmentLabel={formatSummaryDate(nextAppointment?.appointment_date, locale, summaryNotAvailableLabel)}
              lastVisitLabel={formatSummaryDate(lastVisit?.appointment_date, locale, summaryNotAvailableLabel)}
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
                onRequestReschedule={handleRescheduleAction}
                onRespondReschedule={handleRescheduleAction}
                onWithdrawReschedule={handleWithdrawReschedule}
                onRequestCancel={setCancelTarget}
                onDeletePending={(appointment) => handleDeletePending(appointment.id)}
                onBookAgain={(appointment) => {
                  if (appointment.doctor_id) {
                    router.push(`/patient/doctor/${appointment.doctor_id}`);
                    return;
                  }
                  router.push("/patient/find-doctor");
                }}
                onConfirmPatient={async (appointment) => {
                  setActionFeedback(null);
                  try {
                    const { patientConfirmAppointment } = await import("@/lib/appointment-actions");
                    await patientConfirmAppointment(appointment.id);
                    await reloadAppointments();
                    setActionFeedback({ type: "success", message: "Appointment confirmed." });
                  } catch (error) {
                    const message = error instanceof Error ? error.message : "Could not confirm appointment.";
                    setActionFeedback({ type: "error", message });
                  }
                }}
              />
            </section>

            {!selectedDate && filteredUpcomingAppointments.length > 0 ? null : (
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedDate(null)}>
                  {tCommon("patientAppointments.page.showAllUpcoming")}
                </Button>
              </div>
            )}

            {!showAllAppointments && (appointmentsHasMore || appointmentsTotal === 0) ? (
              <div className="flex flex-col items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/60 px-4 py-3 text-sm text-muted-foreground sm:flex-row">
                <span>
                  Showing the last 6 months and next 6 months by default for faster loading.
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAllAppointments(true);
                    setLoading(true);
                  }}
                >
                  Show all appointments
                </Button>
              </div>
            ) : null}
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
                doctor_name: rescheduleResponseTarget.appointment.doctor_name || null,
                doctor_title: rescheduleResponseTarget.appointment.doctor_title || null,
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

