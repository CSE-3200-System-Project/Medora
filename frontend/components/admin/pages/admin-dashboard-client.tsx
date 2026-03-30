import React from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer } from "@/components/ui/responsive-container";
import { ResponsiveGrid } from "@/components/ui/responsive-grid";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";
import {
  Users,
  UserCog,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  Activity,
} from "lucide-react";

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

export function AdminDashboardClient({ initialStats }: AdminDashboardClientProps) {
  const t = useTranslations("admin.dashboardPage");
  const locale = useLocale() as AppLocale;
  const localeHref = React.useCallback((path: string) => withLocale(path, locale), [locale]);
  const stats = initialStats;

  return (
    <>
      <AdminNavbar />

      <main>
        <ResponsiveContainer className="py-4 sm:py-6 pt-(--nav-content-offset)">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
            <p className="text-muted-foreground">{t("subtitle")}</p>
          </div>

          <ResponsiveGrid pattern="custom" gap="md" className="mb-6 sm:mb-8 grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title={t("stats.totalUsers")}
            value={stats?.total_users || 0}
            icon={<Users className="h-5 w-5" />}
            trend={t("stats.totalUsersTrend", { count: stats?.recent_registrations_7days || 0 })}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
          />
          <StatCard
            title={t("stats.totalDoctors")}
            value={stats?.total_doctors || 0}
            icon={<UserCog className="h-5 w-5" />}
            trend={t("stats.totalDoctorsTrend", { count: stats?.verified_doctors || 0 })}
            color="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
          <StatCard
            title={t("stats.totalPatients")}
            value={stats?.total_patients || 0}
            icon={<Users className="h-5 w-5" />}
            trend={t("stats.totalPatientsTrend", { count: stats?.patients_with_complete_profile || 0 })}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
          />
          <StatCard
            title={t("stats.totalAppointments")}
            value={stats?.total_appointments || 0}
            icon={<Calendar className="h-5 w-5" />}
            trend={t("stats.totalAppointmentsTrend", { count: stats?.confirmed_appointments || 0 })}
            color="bg-gradient-to-br from-orange-500 to-orange-600"
          />
          </ResponsiveGrid>

          <ResponsiveGrid pattern="half" gap="lg" className="mb-6 sm:mb-8">
          <Card className="bg-card/60 border-border/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <UserCog className="h-5 w-5 text-primary-light" />
                {t("sections.doctorVerification")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusRow
                label={t("doctorStatus.verified")}
                value={stats?.verified_doctors || 0}
                icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
                color="text-green-400"
              />
              <StatusRow
                label={t("doctorStatus.pending")}
                value={stats?.pending_doctors || 0}
                icon={<Clock className="h-5 w-5 text-yellow-400" />}
                color="text-yellow-400"
                href={localeHref("/admin/doctors?tab=pending")}
              />
              <StatusRow
                label={t("doctorStatus.rejected")}
                value={stats?.rejected_doctors || 0}
                icon={<XCircle className="h-5 w-5 text-red-400" />}
                color="text-red-400"
              />
            </CardContent>
          </Card>

          <Card className="bg-card/60 border-border/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary-light" />
                {t("sections.appointmentStatus")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusRow
                label={t("appointmentStatus.pending")}
                value={stats?.pending_appointments || 0}
                icon={<Clock className="h-5 w-5 text-yellow-400" />}
                color="text-yellow-400"
              />
              <StatusRow
                label={t("appointmentStatus.confirmed")}
                value={stats?.confirmed_appointments || 0}
                icon={<CheckCircle2 className="h-5 w-5 text-blue-400" />}
                color="text-blue-400"
              />
              <StatusRow
                label={t("appointmentStatus.completed")}
                value={stats?.completed_appointments || 0}
                icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
                color="text-green-400"
              />
              <StatusRow
                label={t("appointmentStatus.cancelled")}
                value={stats?.cancelled_appointments || 0}
                icon={<XCircle className="h-5 w-5 text-red-400" />}
                color="text-red-400"
              />
            </CardContent>
          </Card>
          </ResponsiveGrid>

          <Card className="bg-card/50 border-border/50 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary-light" />
                {t("sections.quickActions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveGrid pattern="quarters" gap="sm">
                <QuickActionButton
                label={t("quickActions.reviewPendingDoctors")}
                count={stats?.pending_doctors || 0}
                href={localeHref("/admin/doctors?tab=pending")}
              />
              <QuickActionButton
                label={t("quickActions.viewAllDoctors")}
                count={stats?.total_doctors || 0}
                href={localeHref("/admin/doctors")}
              />
              <QuickActionButton
                label={t("quickActions.viewAllPatients")}
                count={stats?.total_patients || 0}
                href={localeHref("/admin/patients")}
              />
              <QuickActionButton
                label={t("quickActions.viewAppointments")}
                count={stats?.total_appointments || 0}
                href={localeHref("/admin/appointments")}
              />
              </ResponsiveGrid>
            </CardContent>
          </Card>
        </ResponsiveContainer>
      </main>
    </>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  trend: string;
  color: string;
}) {
  return (
    <Card className={`${color} border-0 text-primary-foreground shadow-lg`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="p-1.5 sm:p-2 bg-card/20 rounded-lg backdrop-blur">{icon}</div>
          <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground/70" />
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-xs sm:text-sm font-medium text-primary-foreground/85">{title}</p>
          <p className="text-2xl sm:text-3xl font-bold">{value.toLocaleString()}</p>
          <p className="text-xs text-primary-foreground/75">{trend}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  icon,
  color,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  href?: string;
}) {
  const rowContent = (
    <div
      className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg bg-background/50 border border-border/50 ${href ? "cursor-pointer hover:bg-background/80 transition-colors" : ""}`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="shrink-0">{icon}</div>
        <span className="text-sm sm:text-base text-muted-foreground font-medium truncate">{label}</span>
      </div>
      <span className={`text-xl sm:text-2xl font-bold ${color} shrink-0`}>{value}</span>
    </div>
  );

  if (href) {
    return <Link href={href}>{rowContent}</Link>;
  }

  return (
    rowContent
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
      className="block min-h-11 p-3 sm:p-4 rounded-lg bg-background/50 border border-border/50 hover:bg-background/80 hover:border-primary/50 transition-all text-left group touch-target"
    >
      <p className="text-muted-foreground text-xs sm:text-sm mb-1.5 sm:mb-2 group-hover:text-primary-light transition-colors whitespace-normal wrap-break-word">{label}</p>
      <p className="text-foreground text-xl sm:text-2xl font-bold">{count}</p>
    </Link>
  );
}

