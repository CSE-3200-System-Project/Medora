import Link from "next/link";
import { cookies } from "next/headers";
import {
  Users,
  Activity,
  AlertCircle,
  EllipsisVertical,
} from "lucide-react";

import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { AppBackground } from "@/components/ui/app-background";
import { getDoctorAppointmentStats } from "@/lib/appointment-actions";
import { getDoctorProfile } from "@/lib/auth-actions";
import { getDoctorActionStats } from "@/lib/doctor-actions";
import {
  DoctorWorkloadStressChart,
  type WsiWeekPoint,
} from "@/components/doctor/doctor-workload-stress-chart";
import { DoctorRevenueBillingChart } from "@/components/doctor/doctor-revenue-billing-chart";

type DoctorProfile = {
  last_name?: string | null;
  bmdc_verified?: boolean;
  locations?: Array<{
    time_slots_needs_review?: boolean;
  }>;
};

type DoctorStats = {
  todays_appointments: number;
  total_patients: number;
  pending_reviews: number;
  completion_rate: number;
};

const DEFAULT_STATS: DoctorStats = {
  todays_appointments: 0,
  total_patients: 0,
  pending_reviews: 0,
  completion_rate: 0,
};

const DEMOGRAPHIC_DOT_BY_INDEX = ["bg-[#2A7CF7]", "bg-[#74AEFF]", "bg-[#91BFFF]", "bg-[#C1DAFF]"];
const DEMOGRAPHIC_COLOR_BY_INDEX = ["#2A7CF7", "#74AEFF", "#91BFFF", "#C1DAFF"];

function buildDemographicGradient(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return "conic-gradient(#DCEBFF 0deg 360deg)";
  }

  let currentDegree = 0;
  const slices = values.map((value, index) => {
    const startDegree = currentDegree;
    const sweep = (value / total) * 360;
    currentDegree += sweep;
    return `${DEMOGRAPHIC_COLOR_BY_INDEX[index] ?? "#74AEFF"} ${startDegree}deg ${currentDegree}deg`;
  });

  return `conic-gradient(${slices.join(", ")})`;
}

function getWsiLevelBadge(score: number) {
  if (score >= 72) {
    return {
      label: "High Load",
      className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200",
    };
  }
  if (score >= 50) {
    return {
      label: "Moderate Load",
      className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200",
    };
  }
  return {
    label: "Low Load",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
  };
}

export default async function DoctorHomePage() {
  const cookieStore = await cookies();
  const showOnboardingBanner = cookieStore.get("onboarding_completed")?.value !== "true";

  const [doctorData, statsData, actionStatsData] = await Promise.all([
    getDoctorProfile().catch(() => null),
    getDoctorAppointmentStats().catch(() => null),
    getDoctorActionStats().catch(() => null),
  ]);

  const doctor = doctorData as DoctorProfile | null;
  const stats: DoctorStats = { ...DEFAULT_STATS, ...(statsData ?? {}) };
  const actionStats = actionStatsData ?? {
    monthly_revenue: 0,
    weekly_wsi: [],
    pending_actions_count: 0,
    pending_actions: [],
    completion_rate: 0,
    revenue_trend: [],
    demographic_breakdown: [],
  };

  if (!doctor) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
          <div className="text-center text-destructive">
            <p className="text-lg mb-4">Unable to load profile data</p>
            <Button asChild variant="medical" className="touch-target">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </main>
      </AppBackground>
    );
  }

  const doctorProfileNeedsScheduleReview = Boolean(
    doctor.locations?.some((location) => Boolean(location?.time_slots_needs_review)),
  );

  const wsiWeeklyData: WsiWeekPoint[] = actionStats.weekly_wsi.map((item) => ({
    week: item.week,
    appointments: item.appointments,
    noShows: item.no_shows,
    pendingTasks: item.pending_tasks,
    overdueTasks: item.overdue_tasks,
    wsi: item.wsi,
  }));

  const wsiAverage =
    wsiWeeklyData.length > 0
      ? wsiWeeklyData.reduce((sum, item) => sum + item.wsi, 0) / wsiWeeklyData.length
      : 0;
  const wsiBadge = getWsiLevelBadge(wsiAverage);
  const revenueWeeks = actionStats.revenue_trend.map((item) => item.week);
  const revenueBillingTrend = actionStats.revenue_trend.map((item) => item.revenue);
  const revenueClaimsTrend = actionStats.weekly_wsi.map((item) => Math.max(0, item.appointments - item.no_shows));
  const revenueChangePercent = (() => {
    if (actionStats.revenue_trend.length < 2) {
      return 0;
    }
    const previousWeek = actionStats.revenue_trend[actionStats.revenue_trend.length - 2]?.revenue ?? 0;
    const currentWeek = actionStats.revenue_trend[actionStats.revenue_trend.length - 1]?.revenue ?? 0;
    if (previousWeek <= 0) {
      return currentWeek > 0 ? 100 : 0;
    }
    return Number((((currentWeek - previousWeek) / previousWeek) * 100).toFixed(1));
  })();

  const demographicRanges = ["0-18 Years", "19-45 Years", "46-64 Years", "65+ Years"];
  const demographicByRange = new Map(actionStats.demographic_breakdown.map((item) => [item.range, item.value]));
  const demographics = demographicRanges.map((range) => ({
    range,
    value: Number((demographicByRange.get(range) ?? 0).toFixed(2)),
  }));
  const demographicGradient = buildDemographicGradient(demographics.map((item) => item.value));
  const revenueChangeLabel = `${revenueChangePercent >= 0 ? "+" : ""}${revenueChangePercent.toFixed(1)}%`;

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
        {showOnboardingBanner ? <OnboardingBanner role="doctor" /> : null}

        {doctorProfileNeedsScheduleReview ? (
          <div className="mb-6">
            <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10 p-4">
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-destructive">Action Required: Schedule Format Review</p>
                    <p className="text-sm text-muted-foreground">
                      We detected an ambiguous schedule format on your profile. Please review and
                      update your weekly schedule to ensure appointment slots work correctly.
                    </p>
                  </div>
                  <div>
                    <Link href="/doctor/schedule">
                      <Button variant="medical" className="touch-target">
                        Fix Schedule
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
              Welcome back, Dr. {doctor.last_name ?? "Doctor"}!
            </h1>
            <p className="text-muted-foreground text-lg">
              Here&apos;s what&apos;s happening with your practice today
            </p>
          </div>
        </div>

        <div className="rounded-2xl  p-4 sm:p-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/doctor/analytics" className="block">
              <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 hover:scale-[1.02] dark:bg-card dark:hover:border-primary/30">
                <div className="mb-5 flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-[#0360D9] dark:bg-blue-900/30 dark:text-blue-300">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    {stats.todays_appointments} today
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Total Patient Population
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {stats.total_patients.toLocaleString()}
                </p>
              </article>
            </Link>

            <Link href="/doctor/analytics" className="block">
              <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 hover:scale-[1.02] dark:bg-card dark:hover:border-primary/30">
                <div className="mb-5 flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-[#0360D9] dark:bg-blue-900/30 dark:text-blue-300">
                    <Activity className="h-5 w-5" />
                  </span>
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                    {actionStats.completion_rate.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Active Clinical Cases
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {stats.todays_appointments.toLocaleString()}
                </p>
              </article>
            </Link>

            <Link href="/doctor/analytics" className="block">
              <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 hover:scale-[1.02] dark:bg-card dark:hover:border-primary/30">
                <div className="mb-5 flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/35 dark:text-red-300">
                    <AlertCircle className="h-5 w-5" />
                  </span>
                  <span className="rounded-md bg-red-100 px-2 py-1 text-[11px] font-semibold uppercase text-red-700 dark:bg-red-900/35 dark:text-red-200">
                    High Priority
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Actionable Tasks
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  {actionStats.pending_actions_count.toLocaleString()}
                </p>
              </article>
            </Link>

            <Link href="/doctor/analytics" className="block">
              <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 hover:scale-[1.02] dark:bg-card dark:hover:border-primary/30">
                <div className="mb-5 flex items-start justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300">
                    <span className="text-lg font-bold">৳</span>
                  </span>
                  <span
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                      revenueChangePercent >= 0
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200"
                    }`}
                  >
                    {revenueChangeLabel}
                  </span>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Monthly Revenue
                </p>
                <p className="mt-2 text-3xl font-bold text-foreground">
                  ৳{Math.round(actionStats.monthly_revenue).toLocaleString()}
                </p>
              </article>
            </Link>
          </section>

          <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-5">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <Link href="/doctor/analytics" className="text-lg font-semibold text-foreground hover:text-primary transition-colors">Demographic Distribution</Link>
                  <p className="text-sm text-muted-foreground">Patient age segments</p>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                  aria-label="Demographic settings"
                >
                  <EllipsisVertical className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="relative h-44 w-44">
                  <div
                    className="h-full w-full rounded-full"
                    style={{
                      background: demographicGradient,
                    }}
                  />
                  <div className="absolute inset-4.5 flex flex-col items-center justify-center rounded-full bg-white dark:bg-[#123a5a]">
                    <p className="text-3xl font-bold text-foreground">{stats.total_patients.toLocaleString()}</p>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Total
                    </p>
                  </div>
                </div>

                <ul className="w-full space-y-3 sm:max-w-45">
                  {demographics.map((item, index) => (
                    <li key={item.range} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${DEMOGRAPHIC_DOT_BY_INDEX[index] ?? "bg-[#74AEFF]"}`} />
                        {item.range}
                      </span>
                      <span className="font-semibold text-muted-foreground">{item.value}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-7">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href="/doctor/analytics" className="text-xl font-semibold text-foreground hover:text-primary transition-colors">Doctor Workload Stress Index</Link>
                    <span
                      className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.04em] ${wsiBadge.className}`}
                    >
                      {wsiBadge.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Real-time workload pressure tracking</p>
                </div>
                <div className="inline-flex rounded-md border border-border bg-[#f5f9ff] p-1 dark:bg-[#153b5a]">
                  <button
                    type="button"
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#0360D9] shadow-sm dark:bg-[#1b4669] dark:text-blue-200"
                  >
                    6 Months
                  </button>
                  <button
                    type="button"
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    1 Year
                  </button>
                </div>
              </div>

              <DoctorWorkloadStressChart data={wsiWeeklyData} />
            </article>
          </section>

          <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-4">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Pending Action Items</h2>

              <div className="space-y-3">
                {(actionStats.pending_actions.length > 0
                  ? actionStats.pending_actions
                  : [
                      {
                        id: "none",
                        title: "No pending actions",
                        priority: "low",
                        status: "completed",
                        due_date: null,
                        related_patient_id: null,
                      },
                    ]).map((item) => {
                  const isUrgent = item.priority === "urgent" || item.priority === "high";
                  const boxClass = isUrgent
                    ? "rounded-xl border border-red-100 bg-red-50/65 p-4 dark:border-red-900/30 dark:bg-red-900/15"
                    : "rounded-xl border border-blue-100 bg-blue-50/65 p-4 dark:border-blue-900/30 dark:bg-blue-900/15";
                  const badgeClass = isUrgent
                    ? "text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600 dark:text-red-300"
                    : "text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300";
                  const dueLabel = item.due_date
                    ? new Date(item.due_date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                    : "No due date";

                  return (
                    <div key={item.id} className={boxClass}>
                      <div className="mb-2 flex items-center justify-between">
                        <span className={badgeClass}>{item.priority}</span>
                        <span className="text-xs font-medium text-muted-foreground">{dueLabel}</span>
                      </div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Status: {item.status.replace("_", " ")}
                        {item.related_patient_id ? ` â€¢ Patient ${item.related_patient_id.slice(0, 8)}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-8">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <Link href="/doctor/analytics" className="text-xl font-semibold text-foreground hover:text-primary transition-colors">Revenue &amp; Billing Overview</Link>
                  <div className="mt-2 flex items-center gap-4 text-xs font-semibold text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#0360D9]" />
                      Billing Trends
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      Claims Processed
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Total Claims
                  </p>
                  <p className="text-2xl font-bold text-foreground">
                    {actionStats.revenue_trend.length > 0
                      ? actionStats.revenue_trend.reduce((sum, item) => sum + Math.round(item.revenue), 0)
                      : 0}{" "}
                    <span className="ml-1 text-base text-emerald-600 dark:text-emerald-300">
                      +{actionStats.completion_rate.toFixed(1)}%
                    </span>
                  </p>
                </div>
              </div>

              <DoctorRevenueBillingChart
                labels={revenueWeeks}
                billingTrend={revenueBillingTrend}
                claimsTrend={revenueClaimsTrend}
              />
            </article>
          </section>
        </div>

      </main>
    </AppBackground>
  );
}

