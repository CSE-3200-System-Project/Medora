"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Activity, AlertCircle, BellRing, Eye, EyeOff, FlaskConical, Footprints, Heart, MoonStar, ShieldCheck, TrendingDown, TrendingUp, UserCheck, Waves, Minus } from "lucide-react";

import { AdherenceHeatmap, HeatmapDay } from "@/components/patient/analytics/AdherenceHeatmap";
import { AdherenceStats } from "@/components/patient/analytics/AdherenceStats";
import { MedicationItem, MedicationStatus } from "@/components/patient/analytics/MedicationTimelineItem";
import type { MissedDosePoint } from "@/components/patient/analytics/MissedDoseChart";
import { SmartInsight } from "@/components/patient/analytics/SmartInsight";

const MissedDoseChart = dynamic(
  () => import("@/components/patient/analytics/MissedDoseChart").then((m) => m.MissedDoseChart),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl border border-border/60 bg-card p-4" /> },
);
import { TodaySchedule } from "@/components/patient/analytics/TodaySchedule";
import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { Navbar } from "@/components/ui/navbar";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { usePagination } from "@/lib/use-pagination";
import { getMetricTrends, getTodayMetrics, logHealthMetric, type HealthMetricTrendPoint } from "@/lib/health-metrics-actions";
import { listMyConsents, revokeHealthDataConsent, updateHealthDataConsent, type HealthDataConsent } from "@/lib/health-data-consent-actions";
import { getReminders } from "@/lib/reminder-actions";
import { formatMeridiemTime } from "@/lib/utils";
import { useAppI18n, useT } from "@/i18n/client";

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const REMINDER_POLL_VISIBLE_MS = 10 * 60_000;
const REMINDER_POLL_HIDDEN_MS = 60 * 60_000;

type DateRangeOption = { labelKey: string; days: number; key: string };
const DATE_RANGE_OPTIONS: DateRangeOption[] = [
  { labelKey: "analytics.dateRanges.sevenDays", days: 7, key: "7d" },
  { labelKey: "analytics.dateRanges.fourteenDays", days: 14, key: "14d" },
  { labelKey: "analytics.dateRanges.oneMonth", days: 30, key: "30d" },
  { labelKey: "analytics.dateRanges.threeMonths", days: 90, key: "90d" },
  { labelKey: "analytics.dateRanges.sixMonths", days: 180, key: "6mo" },
  { labelKey: "analytics.dateRanges.oneYear", days: 365, key: "1yr" },
  { labelKey: "analytics.dateRanges.twoYears", days: 730, key: "2yr" },
];

type DailyDoseSummary = {
  date: Date;
  taken: number;
  total: number;
};

type MetricCardConfig = {
  key: "steps" | "sleep_hours" | "heart_rate" | "blood_pressure_systolic";
  labelKey: string;
  unitKey: string;
  unit: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  inputPlaceholderKey: string;
  normalRange?: { min: number; max: number };
};

const METRIC_CARDS: MetricCardConfig[] = [
  {
    key: "steps",
    labelKey: "analytics.metricCards.steps.label",
    unitKey: "analytics.metricCards.steps.unit",
    unit: "steps",
    inputPlaceholderKey: "analytics.metricCards.steps.placeholder",
    icon: Footprints,
    color: "text-emerald-500",
    normalRange: { min: 5000, max: 15000 },
  },
  {
    key: "sleep_hours",
    labelKey: "analytics.metricCards.sleep.label",
    unitKey: "analytics.metricCards.sleep.unit",
    unit: "hrs",
    inputPlaceholderKey: "analytics.metricCards.sleep.placeholder",
    icon: MoonStar,
    color: "text-indigo-400",
    normalRange: { min: 7, max: 9 },
  },
  {
    key: "heart_rate",
    labelKey: "analytics.metricCards.heartRate.label",
    unitKey: "analytics.metricCards.heartRate.unit",
    unit: "bpm",
    inputPlaceholderKey: "analytics.metricCards.heartRate.placeholder",
    icon: Heart,
    color: "text-rose-400",
    normalRange: { min: 60, max: 100 },
  },
  {
    key: "blood_pressure_systolic",
    labelKey: "analytics.metricCards.bloodPressure.label",
    unitKey: "analytics.metricCards.bloodPressure.unit",
    unit: "mmHg",
    inputPlaceholderKey: "analytics.metricCards.bloodPressure.placeholder",
    icon: Waves,
    color: "text-sky-400",
    normalRange: { min: 90, max: 130 },
  },
];

export type AnalyticsReminder = {
  id: string;
  item_name: string;
  reminder_times: string[];
  days_of_week: number[];
  notes?: string;
};

type AnalyticsDashboardProps = {
  initialReminders?: AnalyticsReminder[];
  initialLoadError?: string | null;
};

type TranslateFn = ReturnType<typeof useT>;

/* ---- Mini sparkline SVG ---- */
function Sparkline({ points, color }: { points: HealthMetricTrendPoint[]; color: string }) {
  if (points.length < 2) return null;

  const values = points.map((p) => p.average_value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 120;
  const h = 32;
  const pad = 2;

  const pathPoints = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const d = `M${pathPoints.join(" L")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-8 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sparkGrad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${w - pad},${h} L${pad},${h} Z`}
        fill={`url(#sparkGrad-${color})`}
        className={color}
      />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={color} />
    </svg>
  );
}

function getTrendDirection(points: HealthMetricTrendPoint[]): "up" | "down" | "flat" {
  if (points.length < 2) return "flat";
  const first = points[0].average_value;
  const last = points[points.length - 1].average_value;
  const diff = ((last - first) / (first || 1)) * 100;
  if (diff > 3) return "up";
  if (diff < -3) return "down";
  return "flat";
}

function TrendBadge({ direction, tCommon }: { direction: "up" | "down" | "flat"; tCommon: TranslateFn }) {
  if (direction === "up") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-emerald-500">
        <TrendingUp className="h-3 w-3" /> {tCommon("analytics.trend.up")}
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[0.65rem] font-semibold text-rose-500">
        <TrendingDown className="h-3 w-3" /> {tCommon("analytics.trend.down")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" /> {tCommon("analytics.trend.stable")}
    </span>
  );
}

export default function AnalyticsDashboard({
  initialReminders = [],
  initialLoadError = null,
}: AnalyticsDashboardProps) {
  const tCommon = useT("common");
  const { locale } = useAppI18n();
  const [reminders, setReminders] = React.useState<AnalyticsReminder[]>(initialReminders);
  const [loadError, setLoadError] = React.useState<string | null>(initialLoadError);
  const [statusOverrides, setStatusOverrides] = React.useState<Record<string, MedicationStatus>>({});
  const [clock, setClock] = React.useState(() => new Date());
  const [hideDueAlert, setHideDueAlert] = React.useState(false);
  const [metricValues, setMetricValues] = React.useState<Record<string, string>>({
    steps: "",
    sleep_hours: "",
    heart_rate: "",
    blood_pressure_systolic: "",
    blood_pressure_diastolic: "",
  });
  const [metricsLoading, setMetricsLoading] = React.useState(false);
  const [todayMetricSummary, setTodayMetricSummary] = React.useState<Record<string, { value: string; raw: number }>>({});
  const [trendSummary, setTrendSummary] = React.useState<Record<string, string>>({});
  const [trendData, setTrendData] = React.useState<Record<string, HealthMetricTrendPoint[]>>({});
  const [consents, setConsents] = React.useState<HealthDataConsent[]>([]);
  const [consentsLoading, setConsentsLoading] = React.useState(false);
  const [selectedRange, setSelectedRange] = React.useState<DateRangeOption>(DATE_RANGE_OPTIONS[0]);
  const consentsPagination = usePagination(consents, 8);

  // Track whether the server already pre-loaded reminders; if so we skip
  // the redundant first poll so the page doesn't re-fetch on hydration.
  const hasInitialRemindersRef = React.useRef(initialReminders.length > 0);

  React.useEffect(() => {
    let isDisposed = false;
    let reminderTimeoutId: number | null = null;

    const syncReminders = async () => {
      try {
        const data = await getReminders({ type_filter: "medication", active_only: true });
        if (isDisposed) return;

        const nextReminders: AnalyticsReminder[] = data.reminders.map((reminder) => ({
          id: reminder.id,
          item_name: reminder.item_name,
          reminder_times: reminder.reminder_times ?? [],
          days_of_week: reminder.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
          notes: reminder.notes,
        }));

        setReminders(nextReminders);
        setLoadError(null);
      } catch {
        if (!isDisposed) setLoadError(tCommon("analytics.errors.refreshRemindersFailed"));
      }
    };

    const pollReminders = async (skipFirstFetch = false) => {
      if (isDisposed) return;
      if (!skipFirstFetch && document.visibilityState === "visible") await syncReminders();
      const nextInterval = document.visibilityState === "visible" ? REMINDER_POLL_VISIBLE_MS : REMINDER_POLL_HIDDEN_MS;
      reminderTimeoutId = window.setTimeout(() => pollReminders(false), nextInterval);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void syncReminders();
    };

    // Skip the first network fetch if SSR already supplied reminders.
    void pollReminders(hasInitialRemindersRef.current);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const clockInterval = window.setInterval(() => setClock(new Date()), 30_000);

    return () => {
      isDisposed = true;
      if (reminderTimeoutId !== null) window.clearTimeout(reminderTimeoutId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(clockInterval);
    };
  }, [tCommon]);

  const loadMetricData = React.useCallback(async () => {
    setMetricsLoading(true);
    try {
      const [today, trends] = await Promise.all([getTodayMetrics(), getMetricTrends({ days: selectedRange.days })]);

      const summaryMap: Record<string, { value: string; raw: number }> = {};
      today.summary.forEach((item) => {
        summaryMap[item.metric_type] = { value: `${item.value} ${item.unit}`, raw: item.value };
      });

      const trendMap: Record<string, string> = {};
      const trendDataMap: Record<string, HealthMetricTrendPoint[]> = {};
      trends.trends.forEach((series) => {
        trendDataMap[series.metric_type] = series.points;
        const latest = series.points[series.points.length - 1];
        if (latest) trendMap[series.metric_type] = `${latest.average_value} ${series.unit}`;
      });

      setTodayMetricSummary(summaryMap);
      setTrendSummary(trendMap);
      setTrendData(trendDataMap);
    } catch {
      setTodayMetricSummary({});
      setTrendSummary({});
      setTrendData({});
    } finally {
      setMetricsLoading(false);
    }
  }, [selectedRange]);

  React.useEffect(() => {
    void loadMetricData();
  }, [loadMetricData]);

  React.useEffect(() => {
    let cancelled = false;
    const loadConsents = async () => {
      setConsentsLoading(true);
      try {
        const data = await listMyConsents();
        if (!cancelled) setConsents(data.consents);
      } catch {
        // Consent load is best-effort
      } finally {
        if (!cancelled) setConsentsLoading(false);
      }
    };
    void loadConsents();
    return () => { cancelled = true; };
  }, []);

  const handleRevokeConsent = async (consentId: string) => {
    try {
      await revokeHealthDataConsent(consentId);
      setConsents((prev) => prev.map((c) => (c.id === consentId ? { ...c, is_active: false, revoked_at: new Date().toISOString() } : c)));
    } catch {
      setLoadError(tCommon("analytics.errors.revokeConsentFailed"));
    }
  };

  const handleToggleShareTests = async (consentId: string, next: boolean) => {
    setConsents((prev) =>
      prev.map((c) => (c.id === consentId ? { ...c, share_medical_tests: next } : c)),
    );
    try {
      await updateHealthDataConsent(consentId, next);
    } catch {
      setConsents((prev) =>
        prev.map((c) => (c.id === consentId ? { ...c, share_medical_tests: !next } : c)),
      );
      setLoadError("Failed to update test sharing.");
    }
  };
  const selectedRangeLabel = tCommon(selectedRange.labelKey);

  const medications = React.useMemo(() => {
    const currentDate = new Date(clock);
    const activeDayIndex = getMondayBasedDayIndex(currentDate);
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();
    const schedule: Array<{ item: MedicationItem; timeMinutes: number }> = [];

    for (const reminder of reminders) {
      const days = reminder.days_of_week.length > 0 ? reminder.days_of_week : [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(activeDayIndex)) continue;

      reminder.reminder_times.forEach((rawTime, index) => {
        const parsedMinutes = parseHHMMToMinutes(rawTime);
        if (parsedMinutes === null) return;

        const doseId = `${reminder.id}-${rawTime}-${index}`;
        const computedStatus = getComputedStatus(parsedMinutes, currentMinutes);

        schedule.push({
          item: {
            id: doseId,
            name: reminder.item_name,
            dose: reminder.notes,
            time: formatTimeFromHHMM(rawTime),
            status: statusOverrides[doseId] ?? computedStatus,
          },
          timeMinutes: parsedMinutes,
        });
      });
    }

    return schedule.sort((left, right) => left.timeMinutes - right.timeMinutes).map((entry) => entry.item);
  }, [clock, reminders, statusOverrides]);

  const dueMedication = React.useMemo(
    () => medications.find((item) => item.status === "due" || item.status === "snoozed") ?? null,
    [medications],
  );

  const dailySummaries = React.useMemo<DailyDoseSummary[]>(() => {
    const now = new Date(clock);
    const baseline = Array.from({ length: 30 }, (_, index) => {
      const dayOffset = 29 - index;
      const date = addDays(now, -dayOffset);
      return { date, taken: 0, total: 0 };
    });

    baseline[baseline.length - 1] = {
      date: now,
      taken: medications.filter((item) => item.status === "taken").length,
      total: medications.length,
    };

    return baseline;
  }, [clock, medications]);

  const adherenceScore = React.useMemo(() => {
    const totals = dailySummaries.reduce(
      (acc, item) => {
        acc.taken += item.taken;
        acc.total += item.total;
        return acc;
      },
      { taken: 0, total: 0 },
    );
    if (totals.total === 0) return 0;
    return Math.round((totals.taken / totals.total) * 100);
  }, [dailySummaries]);

  const perfectDays = React.useMemo(
    () => dailySummaries.filter((item) => item.total > 0 && item.taken === item.total).length,
    [dailySummaries],
  );

  const currentStreak = React.useMemo(() => {
    let streak = 0;
    for (let index = dailySummaries.length - 1; index >= 0; index -= 1) {
      const day = dailySummaries[index];
      if (day.total > 0 && day.taken === day.total) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  }, [dailySummaries]);

  const heatmapDays = React.useMemo<HeatmapDay[]>(() => {
    const recentDays = dailySummaries.slice(-13).map((item) => ({
      id: formatDateId(item.date),
      dayNumber: item.date.getDate(),
      weekday: tCommon(`analytics.weekdays.${WEEKDAY_KEYS[item.date.getDay()]}`),
      displayDate: formatDisplayDate(item.date, locale),
      level: getHeatLevel(item),
    }));

    const futureDate = addDays(new Date(), 1);
    recentDays.push({
      id: `${formatDateId(futureDate)}-future`,
      dayNumber: futureDate.getDate(),
      weekday: tCommon(`analytics.weekdays.${WEEKDAY_KEYS[futureDate.getDay()]}`),
      displayDate: formatDisplayDate(futureDate, locale),
      level: "future",
    });

    return recentDays;
  }, [dailySummaries, locale, tCommon]);

  const missedDoseData = React.useMemo<MissedDosePoint[]>(() => {
    return dailySummaries.map((item) => ({
      label: `${item.date.getDate()} ${tCommon(`analytics.weekdays.${WEEKDAY_KEYS[item.date.getDay()]}`)}`,
      missed: Math.max(0, item.total - item.taken),
    }));
  }, [dailySummaries, tCommon]);

  const takeMedication = (id: string) => setStatusOverrides((c) => ({ ...c, [id]: "taken" }));
  const skipMedication = (id: string) => setStatusOverrides((c) => ({ ...c, [id]: "skipped" }));
  const remindMedication = (id: string) => { setStatusOverrides((c) => ({ ...c, [id]: "due" })); setHideDueAlert(false); };
  const snoozeMedication = (id: string) => { setStatusOverrides((c) => ({ ...c, [id]: "snoozed" })); setHideDueAlert(true); };

  React.useEffect(() => {
    if (!dueMedication) setHideDueAlert(false);
  }, [dueMedication]);

  const setMetricField = (key: string, value: string) => setMetricValues((c) => ({ ...c, [key]: value }));

  const submitMetric = async (metricType: string, unit: string, valueKey: string) => {
    const value = Number(metricValues[valueKey]);
    if (!Number.isFinite(value) || value <= 0) return;
    try {
      await logHealthMetric({
        metric_type: metricType as "steps" | "sleep_hours" | "heart_rate" | "blood_pressure_systolic" | "blood_pressure_diastolic" | "weight" | "blood_sugar" | "sleep_minutes",
        value,
        unit,
        source: "manual",
      });
      setMetricField(valueKey, "");
      await loadMetricData();
    } catch {
      setLoadError(tCommon("analytics.errors.saveMetricFailed"));
    }
  };

  const submitBloodPressure = async () => {
    const systolic = Number(metricValues.blood_pressure_systolic);
    const diastolic = Number(metricValues.blood_pressure_diastolic);
    if (!Number.isFinite(systolic) || systolic <= 0 || !Number.isFinite(diastolic) || diastolic <= 0) return;
    try {
      await Promise.all([
        logHealthMetric({ metric_type: "blood_pressure_systolic", value: systolic, unit: "mmHg", source: "manual" }),
        logHealthMetric({ metric_type: "blood_pressure_diastolic", value: diastolic, unit: "mmHg", source: "manual" }),
      ]);
      setMetricField("blood_pressure_systolic", "");
      setMetricField("blood_pressure_diastolic", "");
      await loadMetricData();
    } catch {
      setLoadError(tCommon("analytics.errors.saveBloodPressureFailed"));
    }
  };

  return (
    <AppBackground>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
        <div className="space-y-5">
          {/* Header */}
          <section className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{tCommon("analytics.header.breadcrumb")}</p>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {tCommon("analytics.header.title")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {tCommon("analytics.header.subtitle")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedRange(opt)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selectedRange.key === opt.key
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 bg-card/80 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {tCommon(opt.labelKey)}
                </button>
              ))}
            </div>
          </section>

          {loadError ? (
            <Card className="border-destructive/30">
              <CardContent className="flex items-start gap-3 pt-3 pb-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{loadError}</p>
              </CardContent>
            </Card>
          ) : null}

          {/* Health Metrics Grid - Compact with sparklines */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {METRIC_CARDS.map((card) => {
              const Icon = card.icon;
              const label = tCommon(card.labelKey);
              const unit = tCommon(card.unitKey);
              const todayData = todayMetricSummary[card.key];
              const points = trendData[card.key] ?? [];
              const trend = getTrendDirection(points);
              const periodAverage = trendSummary[card.key] ?? tCommon("analytics.shared.notAvailable");
              const isInRange =
                todayData && card.normalRange
                  ? todayData.raw >= card.normalRange.min && todayData.raw <= card.normalRange.max
                  : null;

              return (
                <Card key={card.key} className="border-border/60 bg-card/95 shadow-sm">
                  <CardContent className="space-y-2 p-4">
                    {/* Top row: icon + label + trend */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted/70 ${card.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                      </div>
                      <TrendBadge direction={trend} tCommon={tCommon} />
                    </div>

                    {/* Value */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold tabular-nums text-foreground">
                        {todayData?.value?.split(" ")[0] ?? "--"}
                      </span>
                      <span className="text-xs text-muted-foreground">{unit}</span>
                      {isInRange !== null && (
                        <span className={`ml-auto text-[0.65rem] font-medium ${isInRange ? "text-emerald-500" : "text-amber-500"}`}>
                          {isInRange ? tCommon("analytics.metricCards.normal") : tCommon("analytics.metricCards.check")}
                        </span>
                      )}
                    </div>

                    {/* Sparkline */}
                    <div className="h-8">
                      {points.length >= 2 ? (
                        <Sparkline points={points} color={card.color} />
                      ) : (
                        <div className="flex h-full items-center text-xs text-muted-foreground/60">{tCommon("analytics.metricCards.noTrendData")}</div>
                      )}
                    </div>

                    {/* Period average */}
                    <p className="text-[0.7rem] text-muted-foreground">
                      {tCommon("analytics.metricCards.periodAverage", { range: selectedRangeLabel, value: periodAverage })}
                    </p>

                    {/* Input */}
                    {card.key === "blood_pressure_systolic" ? (
                      <div className="space-y-1.5 border-t border-border/40 pt-2">
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                            inputMode="numeric"
                            placeholder={tCommon("analytics.metricCards.bloodPressure.sys")}
                            value={metricValues.blood_pressure_systolic}
                            onChange={(e) => setMetricField("blood_pressure_systolic", e.target.value)}
                          />
                          <input
                            className="h-9 rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                            inputMode="numeric"
                            placeholder={tCommon("analytics.metricCards.bloodPressure.dia")}
                            value={metricValues.blood_pressure_diastolic}
                            onChange={(e) => setMetricField("blood_pressure_diastolic", e.target.value)}
                          />
                        </div>
                        <Button size="sm" className="h-8 w-full text-xs" onClick={() => void submitBloodPressure()} disabled={metricsLoading}>
                          {tCommon("analytics.metricCards.logBloodPressure")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 border-t border-border/40 pt-2">
                        <input
                          className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                          inputMode="numeric"
                          placeholder={tCommon(card.inputPlaceholderKey)}
                          value={metricValues[card.key] ?? ""}
                          onChange={(e) => setMetricField(card.key, e.target.value)}
                        />
                        <Button size="sm" className="h-9 px-4 text-xs" onClick={() => void submitMetric(card.key, card.unit, card.key)} disabled={metricsLoading}>
                          {tCommon("analytics.shared.log")}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </section>

          {/* Adherence Stats */}
          <AdherenceStats
            adherenceScore={adherenceScore}
            perfectDays={perfectDays}
            activeMedications={medications.length}
            currentStreak={currentStreak}
          />

          <AdherenceHeatmap days={heatmapDays} />

          {/* Schedule + Missed doses grid */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <MissedDoseChart data={missedDoseData} />
            <TodaySchedule
              medications={medications}
              onTake={takeMedication}
              onSkip={skipMedication}
              onRemind={remindMedication}
            />
          </section>

          <SmartInsight
            message={buildInsightMessage({
              total: medications.length,
              due: medications.filter((item) => item.status === "due" || item.status === "snoozed").length,
              skipped: medications.filter((item) => item.status === "skipped").length,
            }, tCommon)}
          />

          {/* Detailed Health Metrics Breakdown */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{tCommon("analytics.details.title")}</h2>
              <span className="ml-auto text-xs text-muted-foreground">{tCommon("analytics.details.overview", { range: selectedRangeLabel })}</span>
            </div>

            <div className="scrollbar-themed max-h-180 space-y-3 overflow-y-auto pr-1">
            {METRIC_CARDS.map((card) => {
              const points = trendData[card.key] ?? [];
              if (points.length === 0) return null;

              const Icon = card.icon;
              const values = points.map((p) => p.average_value);
              const min = Math.min(...values);
              const max = Math.max(...values);
              const avg = values.reduce((s, v) => s + v, 0) / values.length;
              const latest = values[values.length - 1];
              const totalEntries = points.reduce((s, p) => s + p.entries, 0);
              const trend = getTrendDirection(points);
              const label = tCommon(card.labelKey);
              const unit = tCommon(card.unitKey);

              return (
                <Card key={card.key} className="border-border/60 bg-card/95 shadow-sm">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted/70 ${card.color}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                          <TrendBadge direction={trend} tCommon={tCommon} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tCommon("analytics.details.entriesOverRange", { count: totalEntries, range: selectedRangeLabel })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold tabular-nums text-foreground">{latest?.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">{unit}</span></p>
                        <p className="text-[0.65rem] text-muted-foreground">{tCommon("analytics.details.latest")}</p>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{tCommon("analytics.details.min")}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground">{min.toFixed(1)} {unit}</p>
                      </div>
                      <div className="text-center border-x border-border/40">
                        <p className="text-xs text-muted-foreground">{tCommon("analytics.details.avg")}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground">{avg.toFixed(1)} {unit}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">{tCommon("analytics.details.max")}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground">{max.toFixed(1)} {unit}</p>
                      </div>
                    </div>

                    {/* Expanded sparkline */}
                    <div className="mt-3 h-16">
                      <Sparkline points={points} color={card.color} />
                    </div>

                    {/* Normal range indicator */}
                    {card.normalRange && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground">{tCommon("analytics.details.normalRange")}</span>
                        <span className="font-medium text-foreground/80">{card.normalRange.min} - {card.normalRange.max} {unit}</span>
                        {avg >= card.normalRange.min && avg <= card.normalRange.max ? (
                          <span className="ml-auto rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-500">{tCommon("analytics.details.withinRange")}</span>
                        ) : (
                          <span className="ml-auto rounded-full bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-500">{tCommon("analytics.details.outsideRange")}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {Object.keys(trendData).length === 0 && !metricsLoading && (
              <Card className="border-border/60 bg-card/95">
                <CardContent className="py-8 text-center">
                  <Activity className="mx-auto h-8 w-8 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">{tCommon("analytics.details.noMetricData")}</p>
                </CardContent>
              </Card>
            )}
            </div>
          </section>

          {/* Health Data Sharing */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">{tCommon("analytics.dataSharing.title")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {tCommon("analytics.dataSharing.subtitle")}
            </p>

            {consentsLoading ? (
              <div className="space-y-3 rounded-xl border border-border/60 bg-card/80 p-4">
                <div className="flex justify-center py-1">
                  <MedoraLoader size="md" label={tCommon("analytics.dataSharing.loading") } />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <CardSkeleton />
                  <CardSkeleton />
                </div>
              </div>
            ) : consents.length === 0 ? (
              <Card className="border-border/60 bg-card/95">
                <CardContent className="flex items-center gap-3 py-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/70">
                    <UserCheck className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{tCommon("analytics.dataSharing.emptyTitle")}</p>
                    <p className="text-xs text-muted-foreground">
                      {tCommon("analytics.dataSharing.emptySubtitle")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
              <div className="scrollbar-themed max-h-96 grid gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {consentsPagination.pageItems.map((consent) => (
                  <Card key={consent.id} className="border-border/60 bg-card/95">
                    <CardContent className="flex flex-col gap-3 py-3 px-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${consent.is_active ? "bg-emerald-500/10" : "bg-muted/50"}`}>
                            {consent.is_active ? (
                              <Eye className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{consent.doctor_name || tCommon("analytics.dataSharing.doctorFallback")}</p>
                            <p className="text-xs text-muted-foreground">
                              {consent.is_active
                                ? tCommon("analytics.dataSharing.sharedSince", { date: new Date(consent.granted_at).toLocaleDateString(getLocaleTag(locale)) })
                                : tCommon("analytics.dataSharing.accessRevoked")}
                            </p>
                          </div>
                        </div>
                        {consent.is_active && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => void handleRevokeConsent(consent.id)}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                      {consent.is_active && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleToggleShareTests(consent.id, !consent.share_medical_tests)
                          }
                          className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${
                            consent.share_medical_tests
                              ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                              : "border-border/60 bg-muted/30 hover:bg-muted/50"
                          }`}
                          aria-pressed={consent.share_medical_tests}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FlaskConical
                              className={`h-4 w-4 shrink-0 ${
                                consent.share_medical_tests ? "text-primary" : "text-muted-foreground"
                              }`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground">Share medical tests</p>
                              <p className="text-[11px] text-muted-foreground">
                                {consent.share_medical_tests
                                  ? "Doctor can view your test results"
                                  : "Test results stay private"}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                              consent.share_medical_tests ? "bg-primary" : "bg-muted-foreground/30"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                                consent.share_medical_tests ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </span>
                        </button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              <PaginationControls
                currentPage={consentsPagination.currentPage}
                totalPages={consentsPagination.totalPages}
                totalItems={consentsPagination.totalItems}
                startIndex={consentsPagination.startIndex}
                endIndex={consentsPagination.endIndex}
                itemLabel="consents"
                onPrev={consentsPagination.goToPrevPage}
                onNext={consentsPagination.goToNextPage}
              />
              </>
            )}
          </section>
        </div>
      </main>

      {dueMedication && !hideDueAlert ? (
        <div className="fixed bottom-20 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-xl backdrop-blur-sm sm:bottom-24 sm:right-8">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <BellRing className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{tCommon("analytics.dueAlert.title")}</p>
              <p className="mt-1 text-sm text-foreground">
                {dueMedication.name} {dueMedication.dose}
              </p>
              <p className="text-xs text-muted-foreground">{tCommon("analytics.dueAlert.takeNow")}</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => takeMedication(dueMedication.id)}>
                  {tCommon("analytics.medicationItem.take")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => snoozeMedication(dueMedication.id)}>
                  {tCommon("analytics.dueAlert.snooze")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppBackground>
  );
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function parseHHMMToMinutes(value: string): number | null {
  const [hourString, minuteString] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatTimeFromHHMM(value: string): string {
  const parsed = parseHHMMToMinutes(value);
  if (parsed === null) return value;
  const hours = Math.floor(parsed / 60);
  const minutes = parsed % 60;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return formatMeridiemTime(date);
}

function getComputedStatus(scheduledMinutes: number, nowMinutes: number): MedicationStatus {
  if (nowMinutes >= scheduledMinutes && nowMinutes < scheduledMinutes + 60) return "due";
  if (nowMinutes >= scheduledMinutes + 60) return "skipped";
  return "upcoming";
}

function getMondayBasedDayIndex(currentDate: Date): number {
  return currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
}

function buildInsightMessage(
  { total, due, skipped }: { total: number; due: number; skipped: number },
  tCommon: TranslateFn,
): string {
  if (total === 0) return tCommon("analytics.insight.empty");
  if (skipped > 0) return tCommon("analytics.insight.skipped", { count: skipped });
  if (due > 0) return tCommon("analytics.insight.due", { count: due });
  return tCommon("analytics.insight.onTrack");
}

function formatDateId(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDisplayDate(date: Date, locale: string) {
  return date.toLocaleDateString(getLocaleTag(locale), { month: "short", day: "numeric" });
}

function getLocaleTag(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

function getHeatLevel(day: DailyDoseSummary): HeatmapDay["level"] {
  if (day.total === 0) return "future";
  const adherence = day.taken / day.total;
  if (adherence >= 1) return "perfect";
  if (adherence >= 0.5) return "partial";
  return "missed";
}

