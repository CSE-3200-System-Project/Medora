"use client";

import React, { useCallback, useState } from "react";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/medora-loader";
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
  CheckCircle2,
  XCircle,
  Inbox,
  RefreshCw,
  Ban,
  User,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  getPendingAppointments,
  adminApproveAppointment,
  adminRejectAppointment,
  getPendingRescheduleRequests,
  adminApproveReschedule,
  adminRejectReschedule,
  getPendingCancellationRequests,
  adminApproveCancellation,
  adminRejectCancellation,
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

type PendingAppointment = {
  id: string;
  appointment_date: string;
  slot_time?: string | null;
  duration_minutes?: number;
  reason?: string;
  notes?: string;
  status: string;
  doctor: { id?: string | null; name: string };
  patient: { id?: string | null; name: string };
  created_at?: string | null;
};

type RescheduleRequest = {
  id: string;
  appointment_id: string;
  requested_by_id: string;
  requested_by_role: string;
  requested_by_name: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  current_date: string;
  current_slot?: string | null;
  proposed_date: string;
  proposed_time: string;
  reason?: string | null;
  created_at?: string | null;
};

type CancellationRequest = {
  id: string;
  appointment_id: string;
  requested_by_id: string;
  requested_by_role: string;
  requested_by_name: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  appointment_date: string;
  slot_time?: string | null;
  reason_key?: string | null;
  reason_note?: string | null;
  created_at?: string | null;
};

type TabKey = "appointments" | "reschedules" | "cancellations";

type AdminRequestsClientProps = {
  initialAppointments: PendingAppointment[];
  initialReschedules: RescheduleRequest[];
  initialCancellations: CancellationRequest[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDateTime(iso?: string | null) {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString()} ${formatMeridiemTime(iso)}`;
  } catch {
    return iso;
  }
}

function reasonLabel(reason?: string | null) {
  if (!reason) return "N/A";
  const { consultationType, appointmentType } = parseCompositeReason(reason);
  const ct = humanizeConsultationType(consultationType);
  const at = humanizeAppointmentType(appointmentType);
  return `${ct || reason}${at ? ` – ${at}` : ""}`;
}

function roleBadge(role: string) {
  const r = role.toLowerCase();
  const cls =
    r === "patient"
      ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
      : r === "doctor"
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : "bg-muted/30 text-muted-foreground border-border/40";
  return <Badge className={cls}>{role}</Badge>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AdminRequestsClient({
  initialAppointments,
  initialReschedules,
  initialCancellations,
}: AdminRequestsClientProps) {
  const [tab, setTab] = useState<TabKey>("appointments");

  const [appointments, setAppointments] =
    useState<PendingAppointment[]>(initialAppointments);
  const [reschedules, setReschedules] =
    useState<RescheduleRequest[]>(initialReschedules);
  const [cancellations, setCancellations] =
    useState<CancellationRequest[]>(initialCancellations);

  const [actingId, setActingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---- fetchers ---- */

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [a, r, c] = await Promise.all([
        getPendingAppointments(50, 0).catch(() => ({ appointments: [], total: 0 })),
        getPendingRescheduleRequests(50, 0).catch(() => ({ requests: [], total: 0 })),
        getPendingCancellationRequests(50, 0).catch(() => ({ requests: [], total: 0 })),
      ]);
      setAppointments(a?.appointments ?? []);
      setReschedules(r?.requests ?? []);
      setCancellations(c?.requests ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /* ---- actions ---- */

  const runAction = async (id: string, fn: () => Promise<unknown>) => {
    setActingId(id);
    setError(null);
    try {
      await fn();
      await refreshAll();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Action failed";
      setError(message);
    } finally {
      setActingId(null);
    }
  };

  const counts = {
    appointments: appointments.length,
    reschedules: reschedules.length,
    cancellations: cancellations.length,
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <AdminNavbar />

      <main className="p-4 sm:p-6 max-w-400 mx-auto pt-(--nav-content-offset)">
        {/* ---- Header ---- */}
        <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-1">
              Requests
            </h1>
            <p className="text-muted-foreground text-sm">
              Approve or reject pending bookings, reschedules, and cancellations
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={refreshing}
            className="border-border text-muted-foreground hover:bg-card/60 shrink-0 h-10"
          >
            {refreshing ? (
              <ButtonLoader className="h-4 w-4 mr-1.5" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1.5" />
            )}
            Refresh
          </Button>
        </div>

        {/* ---- Error banner ---- */}
        {error && (
          <Card className="bg-destructive/10 border-destructive/40 mb-4">
            <CardContent className="p-3 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}

        {/* ---- Tabs ---- */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <TabButton
            active={tab === "appointments"}
            onClick={() => setTab("appointments")}
            icon={<Inbox className="h-4 w-4" />}
            label="Appointments"
            count={counts.appointments}
          />
          <TabButton
            active={tab === "reschedules"}
            onClick={() => setTab("reschedules")}
            icon={<RefreshCw className="h-4 w-4" />}
            label="Reschedules"
            count={counts.reschedules}
          />
          <TabButton
            active={tab === "cancellations"}
            onClick={() => setTab("cancellations")}
            icon={<Ban className="h-4 w-4" />}
            label="Cancellations"
            count={counts.cancellations}
          />
        </div>

        {/* ---- Content ---- */}
        {tab === "appointments" && (
          <AppointmentsPanel
            items={appointments}
            actingId={actingId}
            onApprove={(id) =>
              runAction(id, () => adminApproveAppointment(id))
            }
            onReject={(id) => runAction(id, () => adminRejectAppointment(id))}
          />
        )}

        {tab === "reschedules" && (
          <ReschedulesPanel
            items={reschedules}
            actingId={actingId}
            onApprove={(id) => runAction(id, () => adminApproveReschedule(id))}
            onReject={(id) => runAction(id, () => adminRejectReschedule(id))}
          />
        )}

        {tab === "cancellations" && (
          <CancellationsPanel
            items={cancellations}
            actingId={actingId}
            onApprove={(id) =>
              runAction(id, () => adminApproveCancellation(id))
            }
            onReject={(id) => runAction(id, () => adminRejectCancellation(id))}
          />
        )}
      </main>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={`h-9 px-3 gap-1.5 border-border ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "text-muted-foreground hover:bg-card/60"
      }`}
    >
      {icon}
      {label}
      <span
        className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${
          active
            ? "bg-primary-foreground/20 text-primary-foreground"
            : "bg-muted/30 text-muted-foreground"
        }`}
      >
        {count}
      </span>
    </Button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <Card className="bg-card/60 border-border/50">
      <CardContent className="p-12 text-center">
        <p className="text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function ActionButtons({
  id,
  actingId,
  onApprove,
  onReject,
}: {
  id: string;
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const busy = actingId === id;
  return (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        onClick={() => onApprove(id)}
        disabled={busy}
        className="h-8 px-2.5 bg-green-600 hover:bg-green-700 text-white"
      >
        {busy ? (
          <ButtonLoader className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        )}
        Approve
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => onReject(id)}
        disabled={busy}
        className="h-8 px-2.5 border-destructive/40 text-destructive hover:bg-destructive/10"
      >
        <XCircle className="h-3.5 w-3.5 mr-1" />
        Reject
      </Button>
    </div>
  );
}

/* ---- Appointments Panel ---- */

function AppointmentsPanel({
  items,
  actingId,
  onApprove,
  onReject,
}: {
  items: PendingAppointment[];
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (items.length === 0)
    return <EmptyState label="No appointment requests awaiting review" />;

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 mb-6 lg:hidden">
        {items.map((apt) => (
          <Card
            key={apt.id}
            className="bg-card/60 border-border/50 border-l-2 border-l-orange-400/60"
          >
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-foreground font-semibold text-sm">
                      {new Date(apt.appointment_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMeridiemTime(apt.appointment_date)}
                      {apt.duration_minutes ? ` (${apt.duration_minutes}m)` : ""}
                    </p>
                  </div>
                </div>
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
                  Pending Review
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border/50 pt-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Patient</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {apt.patient.name}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Doctor</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {apt.doctor.name}
                  </p>
                </div>
              </div>

              {apt.reason && (
                <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                  <span className="font-medium">Reason:</span>{" "}
                  {reasonLabel(apt.reason)}
                </p>
              )}

              <div className="border-t border-border/50 pt-2">
                <ActionButtons
                  id={apt.id}
                  actingId={actingId}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block mb-6">
        <TableScrollContainer className="border-border/50 bg-card/40">
          <Table>
            <TableHeader className="bg-card/60 border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date & Time</TableHead>
                <TableHead className="text-muted-foreground">Patient</TableHead>
                <TableHead className="text-muted-foreground">Doctor</TableHead>
                <TableHead className="text-muted-foreground">Reason</TableHead>
                <TableHead className="text-muted-foreground">Requested</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((apt) => (
                <TableRow
                  key={apt.id}
                  className="border-border/30 hover:bg-card/40 bg-orange-500/5 border-l-2 border-l-orange-400/60"
                >
                  <TableCell>
                    <p className="text-foreground font-medium">
                      {new Date(apt.appointment_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMeridiemTime(apt.appointment_date)}
                      {apt.duration_minutes ? ` (${apt.duration_minutes}m)` : ""}
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
                  <TableCell className="text-xs text-muted-foreground">
                    {apt.created_at
                      ? new Date(apt.created_at).toLocaleString()
                      : "--"}
                  </TableCell>
                  <TableCell>
                    <ActionButtons
                      id={apt.id}
                      actingId={actingId}
                      onApprove={onApprove}
                      onReject={onReject}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </>
  );
}

/* ---- Reschedules Panel ---- */

function ReschedulesPanel({
  items,
  actingId,
  onApprove,
  onReject,
}: {
  items: RescheduleRequest[];
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (items.length === 0)
    return <EmptyState label="No reschedule requests awaiting review" />;

  const proposedLabel = (r: RescheduleRequest) => {
    try {
      const d = new Date(r.proposed_date).toLocaleDateString();
      const t = new Date(
        `1970-01-01T${r.proposed_time.split("T").pop() || r.proposed_time}`
      );
      const time = isNaN(t.getTime())
        ? r.proposed_time
        : formatMeridiemTime(t.toISOString());
      return `${d} ${time}`;
    } catch {
      return `${r.proposed_date} ${r.proposed_time}`;
    }
  };

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 mb-6 lg:hidden">
        {items.map((r) => (
          <Card
            key={r.id}
            className="bg-card/60 border-border/50 border-l-2 border-l-purple-400/60"
          >
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <RefreshCw className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Requested by</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-foreground font-medium truncate">
                        {r.requested_by_name}
                      </p>
                      {roleBadge(r.requested_by_role)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-2 grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Patient</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {r.patient_name}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Doctor</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {r.doctor_name}
                  </p>
                </div>
              </div>

              <div className="border-t border-border/50 pt-2 flex items-center gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">Current</p>
                  <p className="text-foreground font-medium truncate">
                    {formatDateTime(r.current_date)}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">Proposed</p>
                  <p className="text-foreground font-medium truncate">
                    {proposedLabel(r)}
                  </p>
                </div>
              </div>

              {r.reason && (
                <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                  <span className="font-medium">Reason:</span> {r.reason}
                </p>
              )}

              <div className="border-t border-border/50 pt-2">
                <ActionButtons
                  id={r.id}
                  actingId={actingId}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block mb-6">
        <TableScrollContainer className="border-border/50 bg-card/40">
          <Table>
            <TableHeader className="bg-card/60 border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Requested By</TableHead>
                <TableHead className="text-muted-foreground">Patient</TableHead>
                <TableHead className="text-muted-foreground">Doctor</TableHead>
                <TableHead className="text-muted-foreground">Current</TableHead>
                <TableHead className="text-muted-foreground">Proposed</TableHead>
                <TableHead className="text-muted-foreground">Reason</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-border/30 hover:bg-card/40 bg-purple-500/5 border-l-2 border-l-purple-400/60"
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground font-medium">
                        {r.requested_by_name}
                      </span>
                      {roleBadge(r.requested_by_role)}
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {r.patient_name}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {r.doctor_name}
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground font-medium">
                      {new Date(r.current_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMeridiemTime(r.current_date)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-primary">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="font-medium">{proposedLabel(r)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-45 truncate">
                    {r.reason || "--"}
                  </TableCell>
                  <TableCell>
                    <ActionButtons
                      id={r.id}
                      actingId={actingId}
                      onApprove={onApprove}
                      onReject={onReject}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </>
  );
}

/* ---- Cancellations Panel ---- */

function CancellationsPanel({
  items,
  actingId,
  onApprove,
  onReject,
}: {
  items: CancellationRequest[];
  actingId: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (items.length === 0)
    return <EmptyState label="No cancellation requests awaiting review" />;

  const reasonText = (r: CancellationRequest) => {
    if (r.reason_note) return r.reason_note;
    if (r.reason_key) return r.reason_key.replace(/_/g, " ");
    return "--";
  };

  return (
    <>
      {/* Mobile cards */}
      <div className="space-y-3 mb-6 lg:hidden">
        {items.map((r) => (
          <Card
            key={r.id}
            className="bg-card/60 border-border/50 border-l-2 border-l-rose-400/60"
          >
            <CardContent className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                    <Ban className="h-5 w-5 text-rose-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Requested by</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm text-foreground font-medium truncate">
                        {r.requested_by_name}
                      </p>
                      {roleBadge(r.requested_by_role)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50 pt-2 grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Patient</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {r.patient_name}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">Doctor</p>
                  <p className="text-xs text-foreground font-medium truncate">
                    {r.doctor_name}
                  </p>
                </div>
              </div>

              <div className="border-t border-border/50 pt-2">
                <p className="text-[10px] text-muted-foreground">Appointment</p>
                <p className="text-xs text-foreground font-medium">
                  {formatDateTime(r.appointment_date)}
                </p>
              </div>

              <p className="text-xs text-muted-foreground border-t border-border/50 pt-2">
                <span className="font-medium">Reason:</span> {reasonText(r)}
              </p>

              <div className="border-t border-border/50 pt-2">
                <ActionButtons
                  id={r.id}
                  actingId={actingId}
                  onApprove={onApprove}
                  onReject={onReject}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block mb-6">
        <TableScrollContainer className="border-border/50 bg-card/40">
          <Table>
            <TableHeader className="bg-card/60 border-border/50">
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="text-muted-foreground">Requested By</TableHead>
                <TableHead className="text-muted-foreground">Patient</TableHead>
                <TableHead className="text-muted-foreground">Doctor</TableHead>
                <TableHead className="text-muted-foreground">Appointment</TableHead>
                <TableHead className="text-muted-foreground">Reason</TableHead>
                <TableHead className="text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-border/30 hover:bg-card/40 bg-rose-500/5 border-l-2 border-l-rose-400/60"
                >
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground font-medium">
                        {r.requested_by_name}
                      </span>
                      {roleBadge(r.requested_by_role)}
                    </div>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {r.patient_name}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {r.doctor_name}
                  </TableCell>
                  <TableCell>
                    <p className="text-foreground font-medium">
                      {new Date(r.appointment_date).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatMeridiemTime(r.appointment_date)}
                    </p>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-60 truncate">
                    {reasonText(r)}
                  </TableCell>
                  <TableCell>
                    <ActionButtons
                      id={r.id}
                      actingId={actingId}
                      onApprove={onApprove}
                      onReject={onReject}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScrollContainer>
      </div>
    </>
  );
}
