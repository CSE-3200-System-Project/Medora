import React from "react";
import Link from "next/link";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  UserCog,
  Users,
  XCircle,
} from "lucide-react";

import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ResponsiveContainer } from "@/components/ui/responsive-container";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { cn } from "@/lib/utils";

type Stats = {
  total_users: number;
  total_doctors: number;
  total_patients: number;
  verified_doctors: number;
  pending_doctors: number;
  rejected_doctors: number;
  patients_with_complete_profile: number;
  total_appointments: number;
  pending_appointments: number;
  confirmed_appointments: number;
  completed_appointments: number;
  cancelled_appointments: number;
  recent_registrations_7days: number;
};

type AdminDashboardClientProps = {
  initialStats: Stats | null;
};

const emptyStats: Stats = {
  total_users: 0,
  total_doctors: 0,
  total_patients: 0,
  verified_doctors: 0,
  pending_doctors: 0,
  rejected_doctors: 0,
  patients_with_complete_profile: 0,
  total_appointments: 0,
  pending_appointments: 0,
  confirmed_appointments: 0,
  completed_appointments: 0,
  cancelled_appointments: 0,
  recent_registrations_7days: 0,
};

const adminPrimaryActionClass =
  "inline-flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none";
const adminAccordionTriggerClass =
  "rounded-md px-2 py-3 transition-colors duration-200 hover:bg-muted/40 hover:no-underline motion-reduce:transition-none";

export function AdminDashboardClient({ initialStats }: AdminDashboardClientProps) {
  const stats: Stats = { ...emptyStats, ...(initialStats ?? {}) };
  const pendingLoad = stats.pending_doctors + stats.pending_appointments;
  const pendingDenominator = Math.max(1, stats.total_doctors + stats.total_appointments);
  const pendingShare = Math.round((pendingLoad / pendingDenominator) * 100);
  const queueSeverity = pendingShare >= 25 ? "High attention" : pendingShare >= 12 ? "Moderate attention" : "Stable";

  return (
    <>
      <AdminNavbar />

      <main>
        <ResponsiveContainer className="space-y-6 py-4 pt-[var(--nav-content-offset)] sm:space-y-8 sm:py-6">
          <header className="space-y-2">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl md:text-3xl">Admin Analytics</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Decision-focused platform operations with trend context and expandable detail.
            </p>
          </header>

          <section className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-sm sm:p-6">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="space-y-5">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-primary">Primary decision panel</p>
                  <h2 className="text-2xl font-semibold text-foreground">Operational Queue Health</h2>
                  <p className="text-sm text-muted-foreground">
                    Pending doctor verifications and unresolved appointments are the immediate admin workload.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <PrimaryMetricChip
                    label="Pending doctor reviews"
                    value={stats.pending_doctors}
                    tone="warning"
                    icon={<UserCog className="h-4 w-4" />}
                  />
                  <PrimaryMetricChip
                    label="Pending appointments"
                    value={stats.pending_appointments}
                    tone="warning"
                    icon={<Clock className="h-4 w-4" />}
                  />
                  <PrimaryMetricChip
                    label="New users this week"
                    value={stats.recent_registrations_7days}
                    tone="neutral"
                    icon={<Users className="h-4 w-4" />}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/admin/doctors?tab=pending"
                    className={cn(
                      adminPrimaryActionClass,
                      "bg-primary text-primary-foreground hover:bg-primary-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    Review Pending Doctors
                  </Link>
                  <Link
                    href="/admin/appointments"
                    className={cn(
                      adminPrimaryActionClass,
                      "border border-border text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    Resolve Appointments
                  </Link>
                </div>
              </div>

              <aside className="rounded-xl border border-border/60 bg-background/70 p-4 sm:p-5">
                <div className="mb-4 space-y-1">
                  <p className="text-sm font-semibold text-primary">Decision summary</p>
                  <p className="text-xl font-semibold text-foreground">{queueSeverity}</p>
                  <p className="text-sm text-muted-foreground">
                    {pendingLoad.toLocaleString()} unresolved queue items across verification and scheduling.
                  </p>
                </div>

                <div className="space-y-3">
                  <StatusMeterRow
                    label="Queue pressure"
                    value={pendingLoad}
                    share={pendingShare}
                    accentClass="bg-destructive/80"
                  />
                  <StatusMeterRow
                    label="Doctor verification progress"
                    value={stats.verified_doctors}
                    share={Math.round((stats.verified_doctors / Math.max(1, stats.total_doctors)) * 100)}
                    accentClass="bg-emerald-500"
                  />
                  <StatusMeterRow
                    label="Confirmed appointments"
                    value={stats.confirmed_appointments}
                    share={Math.round((stats.confirmed_appointments / Math.max(1, stats.total_appointments)) * 100)}
                    accentClass="bg-primary"
                  />
                </div>
              </aside>
            </div>
          </section>

          <section className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">Secondary trend context</p>
              <p className="text-sm text-muted-foreground">Status distribution for verification and appointment flow.</p>
            </div>

            <ResponsiveGrid pattern="half" gap="lg">
              <TrendPanel title="Doctor Verification" icon={<UserCog className="h-4 w-4 text-primary" />}>
                <StatusTrendRow
                  label="Verified"
                  value={stats.verified_doctors}
                  total={stats.total_doctors}
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                />
                <StatusTrendRow
                  label="Pending"
                  value={stats.pending_doctors}
                  total={stats.total_doctors}
                  icon={<Clock className="h-4 w-4 text-amber-500" />}
                  href="/admin/doctors?tab=pending"
                />
                <StatusTrendRow
                  label="Rejected"
                  value={stats.rejected_doctors}
                  total={stats.total_doctors}
                  icon={<XCircle className="h-4 w-4 text-destructive" />}
                />
              </TrendPanel>

              <TrendPanel title="Appointment Throughput" icon={<Calendar className="h-4 w-4 text-primary" />}>
                <StatusTrendRow
                  label="Pending"
                  value={stats.pending_appointments}
                  total={stats.total_appointments}
                  icon={<Clock className="h-4 w-4 text-amber-500" />}
                />
                <StatusTrendRow
                  label="Confirmed"
                  value={stats.confirmed_appointments}
                  total={stats.total_appointments}
                  icon={<CheckCircle2 className="h-4 w-4 text-primary" />}
                />
                <StatusTrendRow
                  label="Completed"
                  value={stats.completed_appointments}
                  total={stats.total_appointments}
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                />
                <StatusTrendRow
                  label="Cancelled"
                  value={stats.cancelled_appointments}
                  total={stats.total_appointments}
                  icon={<XCircle className="h-4 w-4 text-destructive" />}
                />
              </TrendPanel>
            </ResponsiveGrid>
          </section>

          <section className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">Tertiary expandable details</p>
              <p className="text-sm text-muted-foreground">Quick navigation and complete raw counts for audits.</p>
            </div>

            <Accordion type="single" collapsible className="rounded-2xl border border-border/60 bg-card/70 px-4">
              <AccordionItem value="quick-actions" className="border-border/60">
                <AccordionTrigger className={adminAccordionTriggerClass}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-base font-semibold text-foreground">Quick Actions</p>
                    <p className="text-sm text-muted-foreground">Navigate to high-frequency admin tasks.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ResponsiveGrid pattern="quarters" gap="sm">
                    <QuickActionButton
                      label="Review Pending Doctors"
                      count={stats.pending_doctors}
                      href="/admin/doctors?tab=pending"
                    />
                    <QuickActionButton label="View All Doctors" count={stats.total_doctors} href="/admin/doctors" />
                    <QuickActionButton label="View All Patients" count={stats.total_patients} href="/admin/patients" />
                    <QuickActionButton
                      label="View Appointments"
                      count={stats.total_appointments}
                      href="/admin/appointments"
                    />
                  </ResponsiveGrid>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="platform-breakdown" className="border-border/60">
                <AccordionTrigger className={adminAccordionTriggerClass}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-base font-semibold text-foreground">Platform Breakdown</p>
                    <p className="text-sm text-muted-foreground">Full totals used for operational reconciliation.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <RawMetricRow label="Total users" value={stats.total_users} icon={<Users className="h-4 w-4" />} />
                    <RawMetricRow label="Total doctors" value={stats.total_doctors} icon={<UserCog className="h-4 w-4" />} />
                    <RawMetricRow
                      label="Patients with complete profile"
                      value={stats.patients_with_complete_profile}
                      icon={<Activity className="h-4 w-4" />}
                    />
                    <RawMetricRow
                      label="Total appointments"
                      value={stats.total_appointments}
                      icon={<Calendar className="h-4 w-4" />}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </ResponsiveContainer>
      </main>
    </>
  );
}

function PrimaryMetricChip({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: "warning" | "neutral";
}) {
  return (
    <article
      className={cn(
        "rounded-lg border p-3",
        tone === "warning" ? "border-amber-300/50 bg-amber-100/30" : "border-border/60 bg-muted/30",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className="text-3xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</p>
    </article>
  );
}

function StatusMeterRow({
  label,
  value,
  share,
  accentClass,
}: {
  label: string;
  value: number;
  share: number;
  accentClass: string;
}) {
  const boundedShare = Math.max(0, Math.min(100, share));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-base font-semibold tabular-nums text-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all duration-300 ease-out motion-reduce:transition-none", accentClass)}
          style={{ width: `${boundedShare}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{boundedShare}% of tracked total</p>
    </div>
  );
}

function TrendPanel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border/60 bg-card/70 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </article>
  );
}

function StatusTrendRow({
  label,
  value,
  total,
  icon,
  href,
}: {
  label: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  href?: string;
}) {
  const ratio = Math.round((value / Math.max(1, total)) * 100);
  const content = (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-background/70 p-3",
        href
          ? "cursor-pointer transition-[background-color,border-color,transform] duration-200 hover:border-primary/30 hover:bg-muted/40 motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none"
          : "",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        <span className="text-base font-semibold tabular-nums text-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{ratio}% share</span>
        <span>{total.toLocaleString()} total</span>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function RawMetricRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/70 p-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <span className="text-lg font-bold tabular-nums text-foreground">{value.toLocaleString()}</span>
    </div>
  );
}

function QuickActionButton({
  label,
  count,
  href,
}: {
  label: string;
  count: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block min-h-11 rounded-lg border border-border/60 bg-background/70 p-3 text-left transition-[background-color,border-color,transform] duration-200 hover:border-primary/50 hover:bg-muted/40 motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <p className="mb-1.5 text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{count.toLocaleString()}</p>
    </Link>
  );
}

