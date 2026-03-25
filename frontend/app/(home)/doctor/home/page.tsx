import Link from "next/link";
import { cookies } from "next/headers";
import {
  Users,
  Activity,
  AlertCircle,
  DollarSign,
  EllipsisVertical,
} from "lucide-react";

import { Navbar } from "@/components/ui/navbar";
import { ChoruiLauncher } from "@/components/ai/chorui-launcher";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { AppBackground } from "@/components/ui/app-background";
import { getDoctorAppointmentStats } from "@/lib/appointment-actions";
import { getDoctorProfile } from "@/lib/auth-actions";
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

const DEMOGRAPHIC_BREAKDOWN = [
  { range: "0-18 Years", value: 40, dot: "bg-[#2A7CF7]" },
  { range: "19-45 Years", value: 25, dot: "bg-[#74AEFF]" },
  { range: "46-64 Years", value: 20, dot: "bg-[#91BFFF]" },
  { range: "65+ Years", value: 15, dot: "bg-[#C1DAFF]" },
];

const WSI_WEEKLY_DATA: WsiWeekPoint[] = [
  { week: "Week 01", appointments: 36, noShows: 5, pendingTasks: 18, overdueTasks: 2, wsi: 58 },
  { week: "Week 02", appointments: 38, noShows: 4, pendingTasks: 20, overdueTasks: 2, wsi: 62 },
  { week: "Week 03", appointments: 34, noShows: 3, pendingTasks: 17, overdueTasks: 2, wsi: 55 },
  { week: "Week 04", appointments: 42, noShows: 4, pendingTasks: 21, overdueTasks: 3, wsi: 68 },
];

const REVENUE_WEEKS = ["Week 01", "Week 02", "Week 03", "Week 04"];
const REVENUE_BILLING_TREND = [32, 40, 70, 58];
const REVENUE_CLAIMS_TREND = [26, 34, 40, 44];

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

  const [doctorData, statsData] = await Promise.all([
    getDoctorProfile().catch(() => null),
    getDoctorAppointmentStats().catch(() => null),
  ]);

  const doctor = doctorData as DoctorProfile | null;
  const stats: DoctorStats = { ...DEFAULT_STATS, ...(statsData ?? {}) };

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

  const wsiAverage =
    WSI_WEEKLY_DATA.reduce((sum, item) => sum + item.wsi, 0) / WSI_WEEKLY_DATA.length;
  const wsiBadge = getWsiLevelBadge(wsiAverage);

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
          <div className="lg:min-w-72">
            <ChoruiLauncher role="doctor" placement="inline" />
          </div>
        </div>

        <div className="rounded-2xl  p-4 sm:p-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 dark:bg-card dark:hover:border-primary/30">
              <div className="mb-5 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-[#0360D9] dark:bg-blue-900/30 dark:text-blue-300">
                  <Users className="h-5 w-5" />
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  +12%
                </span>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Total Patient Population
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {stats.total_patients.toLocaleString()}
              </p>
            </article>

            <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 dark:bg-card dark:hover:border-primary/30">
              <div className="mb-5 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-[#0360D9] dark:bg-blue-900/30 dark:text-blue-300">
                  <Activity className="h-5 w-5" />
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  +4.5%
                </span>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Active Clinical Cases
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">
                {stats.todays_appointments.toLocaleString()}
              </p>
            </article>

            <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 dark:bg-card dark:hover:border-primary/30">
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
                {stats.pending_reviews.toLocaleString()}
              </p>
            </article>

            <article className="rounded-xl border border-transparent bg-white p-6 shadow-sm transition-all hover:border-primary/10 dark:bg-card dark:hover:border-primary/30">
              <div className="mb-5 flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/35 dark:text-amber-300">
                  <DollarSign className="h-5 w-5" />
                </span>
                <span className="rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                  +8.2%
                </span>
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Monthly Revenue
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">$42,500</p>
            </article>
          </section>

          <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-5">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Demographic Distribution</h2>
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
                      background:
                        "conic-gradient(#2A7CF7 0deg 144deg, #74AEFF 144deg 234deg, #91BFFF 234deg 306deg, #C1DAFF 306deg 360deg)",
                    }}
                  />
                  <div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-white dark:bg-[#123a5a]">
                    <p className="text-3xl font-bold text-foreground">1.4k</p>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                      Total
                    </p>
                  </div>
                </div>

                <ul className="w-full space-y-3 sm:max-w-[180px]">
                  {DEMOGRAPHIC_BREAKDOWN.map((item) => (
                    <li key={item.range} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
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
                    <h2 className="text-xl font-semibold text-foreground">Doctor Workload Stress Index</h2>
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

              <DoctorWorkloadStressChart data={WSI_WEEKLY_DATA} />
            </article>
          </section>

          <section className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-4">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Pending Action Items</h2>

              <div className="space-y-3">
                <div className="rounded-xl border border-red-100 bg-red-50/65 p-4 dark:border-red-900/30 dark:bg-red-900/15">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-red-600 dark:text-red-300">
                      Urgent
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">10:30 AM</span>
                  </div>
                  <p className="font-semibold text-foreground">Review Lab Results - Patient #9821</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Abnormal electrolyte panel detected.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/65 p-4 dark:border-amber-900/30 dark:bg-amber-900/15">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-600 dark:text-amber-300">
                      Pending
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">12:15 PM</span>
                  </div>
                  <p className="font-semibold text-foreground">Prescription Renewal Request - Sarah J.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Lisinopril 10mg, 30-day supply.</p>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/65 p-4 dark:border-blue-900/30 dark:bg-blue-900/15">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-blue-600 dark:text-blue-300">
                      New
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">04:45 PM</span>
                  </div>
                  <p className="font-semibold text-foreground">Patient Message - Follow-up concern</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Query regarding post-op recovery timeline.
                  </p>
                </div>
              </div>
            </article>

            <article className="rounded-xl bg-white p-6 shadow-sm dark:bg-card lg:col-span-8">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Revenue &amp; Billing Overview</h2>
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
                    412 <span className="ml-1 text-base text-emerald-600 dark:text-emerald-300">+14%</span>
                  </p>
                </div>
              </div>

              <DoctorRevenueBillingChart
                labels={REVENUE_WEEKS}
                billingTrend={REVENUE_BILLING_TREND}
                claimsTrend={REVENUE_CLAIMS_TREND}
              />
            </article>
          </section>
        </div>

      </main>
    </AppBackground>
  );
}
