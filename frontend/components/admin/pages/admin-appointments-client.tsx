"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { Select } from "@/components/ui/select-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScrollContainer,
} from "@/components/ui/table";
import {
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Search,
  CalendarDays,
  RotateCcw,
} from "lucide-react";
import {
  getAllAppointments,
  overrideAppointmentStatus,
  getAppointmentSummary,
} from "@/lib/admin-actions";
import {
  formatMeridiemTime,
  parseCompositeReason,
  humanizeConsultationType,
  humanizeAppointmentType,
} from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Appointment = {
  id: string;
  appointment_date: string;
  status: string;
  reason?: string;
  notes?: string;
  duration_minutes?: number;
  doctor: { id?: string; name: string };
  patient: { id?: string; name: string };
};

type Summary = {
  total: number;
  needs_attention: number;
  today: number;
  this_week: number;
  confirmed: number;
  pending: number;
  completed: number;
  cancelled: number;
  no_show: number;
};

type Filters = {
  status: string;
  search: string;
  date_from: string;
  date_to: string;
  sort: "asc" | "desc";
};

type AdminAppointmentsClientProps = {
  initialAppointments: Appointment[];
  initialTotal: number;
  initialPage?: number;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUSES = [
  { key: "all", label: "All" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "pending_admin_review", label: "Admin Review" },
  { key: "reschedule_requested", label: "Reschedule Req" },
  { key: "cancel_requested", label: "Cancel Req" },
  { key: "no_show", label: "No Show" },
] as const;

/** "needs_attention" maps to these server-side statuses */
const ATTENTION_STATUSES =
  "pending_admin_review,reschedule_requested,cancel_requested";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusBadge(status: string) {
  const s = status.toLowerCase();
  const map: Record<string, { cls: string; label: string }> = {
    confirmed: {
      cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      label: "Confirmed",
    },
    completed: {
      cls: "bg-green-500/20 text-green-400 border-green-500/30",
      label: "Completed",
    },
    cancelled: {
      cls: "bg-red-500/20 text-red-400 border-red-500/30",
      label: "Cancelled",
    },
    pending: {
      cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      label: "Pending",
    },
    pending_admin_review: {
      cls: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      label: "Admin Review",
    },
    pending_doctor_confirmation: {
      cls: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      label: "Doctor Confirm",
    },
    pending_patient_confirmation: {
      cls: "bg-amber-500/20 text-amber-400 border-amber-500/30",
      label: "Patient Confirm",
    },
    reschedule_requested: {
      cls: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      label: "Reschedule",
    },
    cancel_requested: {
      cls: "bg-rose-500/20 text-rose-400 border-rose-500/30",
      label: "Cancel Req",
    },
    no_show: {
      cls: "bg-muted/30 text-muted-foreground border-border/40",
      label: "No Show",
    },
  };
  const entry = map[s] ?? {
    cls: "bg-muted/30 text-muted-foreground border-border/30",
    label: status,
  };
  return <Badge className={entry.cls}>{entry.label}</Badge>;
}

function reasonLabel(reason?: string) {
  if (!reason) return "N/A";
  const { consultationType, appointmentType } = parseCompositeReason(reason);
  const ct = humanizeConsultationType(consultationType);
  const at = humanizeAppointmentType(appointmentType);
  return `${ct || reason}${at ? ` - ${at}` : ""}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AdminAppointmentsClient({
  initialAppointments,
  initialTotal,
  initialPage = 0,
}: AdminAppointmentsClientProps) {
  const [appointments, setAppointments] =
    useState<Appointment[]>(initialAppointments);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(initialTotal);
  const [overridingId, setOverridingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const hasMounted = useRef(false);
  const limit = 15;

  const [filters, setFilters] = useState<Filters>({
    status: "all",
    search: "",
    date_from: "",
    date_to: "",
    sort: "desc",
  });

  /* ---- data fetchers ---- */

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const serverStatus =
        filters.status === "needs_attention"
          ? ATTENTION_STATUSES
          : filters.status;

      const data = await getAllAppointments(limit, page * limit, {
        status: serverStatus,
        search: filters.search || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        sort: filters.sort,
      });
      setAppointments(data.appointments || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    } finally {
      setLoading(false);
    }
  }, [limit, page, filters]);

  const fetchSummary = useCallback(async () => {
    const data = await getAppointmentSummary();
    if (data) setSummary(data);
  }, []);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      void fetchSummary();
      return;
    }
    void fetchAppointments();
  }, [fetchAppointments, fetchSummary]);

  /* ---- actions ---- */

  const handleOverrideStatus = async (
    appointmentId: string,
    newStatus: string,
    currentStatus?: string
  ) => {
    setOverridingId(appointmentId);
    try {
      const isRescheduleApproval =
        (currentStatus || "").toLowerCase() === "reschedule_requested" &&
        newStatus === "CONFIRMED";
      await overrideAppointmentStatus(
        appointmentId,
        newStatus,
        isRescheduleApproval
          ? "Admin approved reschedule request"
          : "Admin override"
      );
      await Promise.all([fetchAppointments(), fetchSummary()]);
    } catch (error) {
      console.error("Failed to override status:", error);
    } finally {
      setOverridingId(null);
    }
  };

  const setFilter = (key: keyof Filters, value: string) => {
    setPage(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setPage(0);
    setFilters({
      status: "all",
      search: "",
      date_from: "",
      date_to: "",
      sort: "desc",
    });
  };

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.search !== "" ||
    filters.date_from !== "" ||
    filters.date_to !== "";

  const totalPages = Math.ceil(total / limit);
  const isTerminal = (s: string) =>
    ["completed", "cancelled", "no_show"].includes(s.toLowerCase());

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <AdminNavbar />

      <main className="p-4 sm:p-6 max-w-400 mx-auto pt-(--nav-content-offset)">
        {/* ---- Header ---- */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">
            Appointment Management
          </h1>
          <p className="text-muted-foreground text-sm">
            Monitor, filter, and manage all platform appointments
          </p>
        </div>

        {/* ---- Summary Cards ---- */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
            <SummaryCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Needs Attention"
              value={summary.needs_attention}
              accent="text-orange-400"
              bgAccent="bg-orange-500/15"
              onClick={() => setFilter("status", "needs_attention")}
              highlight={summary.needs_attention > 0}
            />
            <SummaryCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Today"
              value={summary.today}
              accent="text-blue-400"
              bgAccent="bg-blue-500/15"
            />
            <SummaryCard
              icon={<Clock className="h-5 w-5" />}
              label="This Week"
              value={summary.this_week}
              accent="text-cyan-400"
              bgAccent="bg-cyan-500/15"
            />
            <SummaryCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Confirmed"
              value={summary.confirmed}
              accent="text-green-400"
              bgAccent="bg-green-500/15"
              onClick={() => setFilter("status", "confirmed")}
            />
            <SummaryCard
              icon={<XCircle className="h-5 w-5" />}
              label="Cancelled"
              value={summary.cancelled}
              accent="text-red-400"
              bgAccent="bg-red-500/15"
              onClick={() => setFilter("status", "cancelled")}
            />
          </div>
        )}

        {/* ---- Filters ---- */}
        <Card className="bg-card/60 border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              {/* Row 1: Search + Date range */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search doctor or patient..."
                    value={filters.search}
                    onChange={(e) => setFilter("search", e.target.value)}
                    className="pl-9 bg-background/60 border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    type="date"
                    value={filters.date_from}
                    onChange={(e) => setFilter("date_from", e.target.value)}
                    className="bg-background/60 border-border text-foreground w-36"
                    aria-label="From date"
                  />
                  <span className="text-muted-foreground text-xs">to</span>
                  <Input
                    type="date"
                    value={filters.date_to}
                    onChange={(e) => setFilter("date_to", e.target.value)}
                    className="bg-background/60 border-border text-foreground w-36"
                    aria-label="To date"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFilter(
                      "sort",
                      filters.sort === "desc" ? "asc" : "desc"
                    )
                  }
                  className="border-border text-muted-foreground hover:bg-card/60 shrink-0 h-10"
                >
                  <ArrowUpDown className="h-4 w-4 mr-1.5" />
                  {filters.sort === "desc" ? "Newest" : "Oldest"}
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                    className="text-muted-foreground hover:text-foreground shrink-0 h-10"
                  >
                    <RotateCcw className="h-4 w-4 mr-1.5" />
                    Reset
                  </Button>
                )}
              </div>

              {/* Row 2: Status pills (desktop) / dropdown (mobile) */}
              <div className="lg:hidden">
                <Select
                  value={filters.status}
                  onChange={(e) => setFilter("status", e.target.value)}
                  className="h-10 bg-background/60 border-border text-foreground"
                  aria-label="Filter by status"
                >
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="hidden lg:flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <Button
                    key={s.key}
                    variant="outline"
                    size="sm"
                    onClick={() => setFilter("status", s.key)}
                    className={`text-xs px-3 h-8 border-border ${
                      filters.status === s.key
                        ? "bg-primary text-primary-foreground border-primary"
                        : "text-muted-foreground hover:bg-card/60"
                    }`}
                  >
                    {s.label}
                    {s.key === "needs_attention" && summary?.needs_attention
                      ? ` (${summary.needs_attention})`
                      : ""}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---- Results info ---- */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-sm text-muted-foreground">
            {loading
              ? (
                <span className="inline-flex items-center gap-2">
                  <ButtonLoader className="h-4 w-4" />
                  Loading appointments...
                </span>
              )
              : `${total} appointment${total !== 1 ? "s" : ""} found`}
          </p>
        </div>

        {/* ---- Content ---- */}
        {loading ? (
          <Card className="bg-card/60 border-border/50">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-center py-2">
                <MedoraLoader size="md" label="Loading appointments..." />
              </div>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </CardContent>
          </Card>
        ) : appointments.length === 0 ? (
          <Card className="bg-card/60 border-border/50">
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">No appointments found</p>
              {hasActiveFilters && (
                <Button
                  variant="link"
                  onClick={resetFilters}
                  className="mt-2 text-primary"
                >
                  Clear all filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ---- Mobile cards ---- */}
            <div className="space-y-3 mb-6 lg:hidden">
              {appointments.map((apt) => (
                <Card
                  key={apt.id}
                  className="bg-card/60 border-border/50 hover:border-primary/50 transition-colors"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Date + status */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
                            <Calendar className="h-5 w-5 text-orange-400" />
                          </div>
                          <div>
                            <p className="text-foreground font-semibold text-sm">
                              {new Date(
                                apt.appointment_date
                              ).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatMeridiemTime(apt.appointment_date)}
                              {apt.duration_minutes
                                ? ` (${apt.duration_minutes}m)`
                                : ""}
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(apt.status)}
                      </div>

                      {/* Doctor + Patient */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">
                              Doctor
                            </p>
                            <p className="text-xs text-foreground font-medium truncate">
                              {apt.doctor.name}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground">
                              Patient
                            </p>
                            <p className="text-xs text-foreground font-medium truncate">
                              {apt.patient.name}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      {apt.reason && (
                        <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                          <span className="font-medium">Reason:</span>{" "}
                          {reasonLabel(apt.reason)}
                        </p>
                      )}

                      {/* Override */}
                      {!isTerminal(apt.status) && (
                        <div className="border-t border-border/50 pt-2">
                          <div className="flex items-center gap-2">
                            <Shield className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-xs text-muted-foreground font-medium">
                              Override:
                            </span>
                            <Select
                              value=""
                              onChange={(e) => {
                                if (e.target.value)
                                  handleOverrideStatus(
                                    apt.id,
                                    e.target.value,
                                    apt.status
                                  );
                              }}
                              disabled={overridingId === apt.id}
                              className="h-7 text-xs bg-card/60 border-border text-muted-foreground flex-1"
                              aria-label="Override status"
                            >
                              <option value="">
                                {overridingId === apt.id
                                  ? "Updating..."
                                  : "Select..."}
                              </option>
                              <option value="CONFIRMED">
                                {apt.status.toLowerCase() ===
                                "reschedule_requested"
                                  ? "Approve Reschedule"
                                  : "Confirm"}
                              </option>
                              <option value="CANCELLED">Cancel</option>
                              <option value="COMPLETED">Complete</option>
                              <option value="NO_SHOW">No Show</option>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ---- Desktop table ---- */}
            <div className="hidden lg:block mb-6">
              <TableScrollContainer className="border-border/50 bg-card/40">
                <Table>
                  <TableHeader className="bg-card/60 border-border/50">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">
                        Date & Time
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Patient
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Doctor
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Reason
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {appointments.map((apt) => {
                      const terminal = isTerminal(apt.status);
                      const needsAttention = [
                        "pending_admin_review",
                        "reschedule_requested",
                        "cancel_requested",
                      ].includes(apt.status.toLowerCase());

                      return (
                        <TableRow
                          key={apt.id}
                          className={`border-border/30 hover:bg-card/40 ${
                            needsAttention
                              ? "bg-orange-500/5 border-l-2 border-l-orange-400/60"
                              : ""
                          }`}
                        >
                          <TableCell>
                            <p className="text-foreground font-medium">
                              {new Date(
                                apt.appointment_date
                              ).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatMeridiemTime(apt.appointment_date)}
                              {apt.duration_minutes
                                ? ` (${apt.duration_minutes}m)`
                                : ""}
                            </p>
                          </TableCell>
                          <TableCell className="text-foreground">
                            {apt.patient.name}
                          </TableCell>
                          <TableCell className="text-foreground">
                            {apt.doctor.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-45 truncate">
                            {reasonLabel(apt.reason)}
                          </TableCell>
                          <TableCell>{getStatusBadge(apt.status)}</TableCell>
                          <TableCell>
                            {terminal ? (
                              <span className="text-xs text-muted-foreground">
                                --
                              </span>
                            ) : (
                              <Select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value)
                                    handleOverrideStatus(
                                      apt.id,
                                      e.target.value,
                                      apt.status
                                    );
                                }}
                                disabled={overridingId === apt.id}
                                className="h-8 text-xs bg-card/60 border-border text-muted-foreground w-36"
                                aria-label="Override status"
                              >
                                <option value="">
                                  {overridingId === apt.id
                                    ? "Updating..."
                                    : "Override..."}
                                </option>
                                <option value="CONFIRMED">
                                  {apt.status.toLowerCase() ===
                                  "reschedule_requested"
                                    ? "Approve Reschedule"
                                    : "Confirm"}
                                </option>
                                <option value="CANCELLED">Cancel</option>
                                <option value="COMPLETED">Complete</option>
                                <option value="NO_SHOW">No Show</option>
                              </Select>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableScrollContainer>
            </div>

            {/* ---- Pagination ---- */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="border-border text-muted-foreground hover:bg-card"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="text-muted-foreground text-sm px-2">
                  Page {page + 1} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="border-border text-muted-foreground hover:bg-card"
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Card sub-component                                         */
/* ------------------------------------------------------------------ */

function SummaryCard({
  icon,
  label,
  value,
  accent,
  bgAccent,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  bgAccent: string;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`bg-card/60 border-border/50 transition-colors ${
        highlight ? "border-orange-400/60 shadow-orange-500/10 shadow-sm" : ""
      } ${onClick ? "cursor-pointer hover:border-primary/50" : ""}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 mb-1">
          <div
            className={`h-8 w-8 rounded-lg ${bgAccent} flex items-center justify-center ${accent}`}
          >
            {icon}
          </div>
        </div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
