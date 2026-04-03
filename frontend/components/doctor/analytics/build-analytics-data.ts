import type { DoctorAction, DoctorActionStats } from "@/lib/doctor-actions";

import type {
  AnalyticsMetric,
  ConsultationTableRow,
  DoctorAnalyticsData,
  PatientTableRow,
  PrescriptionTableRow,
  TrendDirection,
} from "@/components/doctor/analytics/types";

type DoctorAppointmentStats = {
  todays_appointments?: number;
  total_patients?: number;
  pending_reviews?: number;
  completion_rate?: number;
} | null;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const HEATMAP_HOUR_LABELS = ["6a", "9a", "12p", "3p", "6p", "9p"] as const;
const TIME_WINDOW_LABELS = [
  "06:00 - 08:59",
  "09:00 - 11:59",
  "12:00 - 14:59",
  "15:00 - 17:59",
  "18:00 - 20:59",
  "21:00 - 23:59",
] as const;

const ACTION_LABELS: Record<DoctorAction["action_type"], string> = {
  appointment_completed: "Appointments Completed",
  consultation_completed: "Consultations Completed",
  prescription_issued: "Prescriptions Issued",
  lab_review: "Lab Reviews",
  patient_message: "Patient Messages",
  manual_task: "Manual Tasks",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function safeNumber(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatPercent(value: number, digits = 1): string {
  return `${safeNumber(value).toFixed(digits)}%`;
}

function formatChange(change: number): string {
  const normalized = safeNumber(change);
  if (Math.abs(normalized) < 0.05) {
    return "0%";
  }

  const precision = Math.abs(normalized) >= 10 ? 0 : 1;
  const prefix = normalized > 0 ? "+" : "";
  return `${prefix}${normalized.toFixed(precision)}%`;
}

function calculateChange(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const first = values[0] ?? 0;
  const last = values[values.length - 1] ?? 0;
  if (first === 0) {
    return last === 0 ? 0 : 100;
  }

  return ((last - first) / Math.abs(first)) * 100;
}

function trendDirectionFromChange(change: number): TrendDirection {
  if (change > 0.05) {
    return "up";
  }
  if (change < -0.05) {
    return "down";
  }
  return "neutral";
}

function inverseTrendDirection(change: number): TrendDirection {
  if (change > 0.05) {
    return "down";
  }
  if (change < -0.05) {
    return "up";
  }
  return "neutral";
}

function ensureSparkline(values: number[], fallback: number[]): number[] {
  const filtered = values
    .map((value) => safeNumber(value))
    .filter((value) => Number.isFinite(value));

  if (filtered.length === 0) {
    return fallback;
  }

  if (filtered.length === 1) {
    return [filtered[0], filtered[0], filtered[0], filtered[0]];
  }

  return filtered;
}

function toReadableDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown";
  }

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildHeatmapFromActions(actions: DoctorAction[]): {
  hours: string[];
  days: string[];
  values: number[][];
  peakWindow: string;
} {
  const counts = DAY_LABELS.map(() => HEATMAP_HOUR_LABELS.map(() => 0));

  const toBucketIndex = (hour: number): number => {
    if (hour < 9) return 0;
    if (hour < 12) return 1;
    if (hour < 15) return 2;
    if (hour < 18) return 3;
    if (hour < 21) return 4;
    return 5;
  };

  actions.forEach((action) => {
    const timestamp = new Date(action.created_at);
    if (Number.isNaN(timestamp.getTime())) {
      return;
    }

    const dayIndex = (timestamp.getUTCDay() + 6) % 7;
    const hourBucket = toBucketIndex(timestamp.getUTCHours());
    counts[dayIndex][hourBucket] += 1;
  });

  const maxCount = Math.max(0, ...counts.flat());
  const normalized = counts.map((dayCounts) =>
    dayCounts.map((value) => {
      if (maxCount === 0) {
        return 0;
      }
      return Math.round((value / maxCount) * 100);
    }),
  );

  const bucketTotals = HEATMAP_HOUR_LABELS.map((_, index) =>
    counts.reduce((sum, dayCounts) => sum + (dayCounts[index] ?? 0), 0),
  );

  const peakBucketIndex = bucketTotals.reduce((bestIndex, value, index, source) => {
    return value > source[bestIndex] ? index : bestIndex;
  }, 0);

  return {
    hours: [...HEATMAP_HOUR_LABELS],
    days: [...DAY_LABELS],
    values: normalized,
    peakWindow: TIME_WINDOW_LABELS[peakBucketIndex] ?? TIME_WINDOW_LABELS[2],
  };
}

function buildRevenueSeries(actionStats: DoctorActionStats | null, actions: DoctorAction[]): Array<{ label: string; value: number }> {
  const statsSeries = (actionStats?.revenue_trend ?? []).map((item) => ({
    label: item.week,
    value: safeNumber(item.revenue),
  }));

  if (statsSeries.length > 0) {
    return statsSeries;
  }

  const weekTotals = [0, 0, 0, 0];
  const now = Date.now();
  const weekInMs = 7 * 24 * 60 * 60 * 1000;

  actions.forEach((action) => {
    const revenue = safeNumber(action.revenue_amount);
    if (revenue <= 0) {
      return;
    }

    const createdAt = new Date(action.created_at).getTime();
    if (Number.isNaN(createdAt)) {
      return;
    }

    const weeksAgo = Math.floor((now - createdAt) / weekInMs);
    if (weeksAgo < 0 || weeksAgo > 3) {
      return;
    }

    const index = 3 - weeksAgo;
    weekTotals[index] += revenue;
  });

  return weekTotals.map((value, index) => ({
    label: `W${index + 1}`,
    value: Number(value.toFixed(2)),
  }));
}

function buildPatientMix(actions: DoctorAction[]): {
  newPatients: number;
  returningPatients: number;
  trendLabel: string;
} {
  const patientActionCounts = new Map<string, number>();

  actions.forEach((action) => {
    if (!action.related_patient_id) {
      return;
    }

    patientActionCounts.set(action.related_patient_id, (patientActionCounts.get(action.related_patient_id) ?? 0) + 1);
  });

  const totalPatients = patientActionCounts.size;
  if (totalPatients === 0) {
    return {
      newPatients: 0,
      returningPatients: 0,
      trendLabel: "No patient recurrence data yet",
    };
  }

  let returningCount = 0;
  patientActionCounts.forEach((count) => {
    if (count > 1) {
      returningCount += 1;
    }
  });

  const returningPatients = Math.round((returningCount / totalPatients) * 100);
  const newPatients = clamp(100 - returningPatients, 0, 100);

  const trendLabel =
    returningPatients >= 60
      ? "Strong continuity of care"
      : returningPatients >= 35
        ? "Balanced new and returning mix"
        : "Higher share of first-time patients";

  return {
    newPatients,
    returningPatients,
    trendLabel,
  };
}

function buildActionCategories(actions: DoctorAction[]): Array<{ name: string; count: number; percentage: number }> {
  const counts = new Map<string, number>();

  actions.forEach((action) => {
    const label = ACTION_LABELS[action.action_type] ?? "Other Activity";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => ({ name, count }));

  const maxCount = sorted[0]?.count ?? 0;

  return sorted.map((item) => ({
    ...item,
    percentage: maxCount > 0 ? Math.round((item.count / maxCount) * 100) : 0,
  }));
}

function buildMetrics(
  actionStats: DoctorActionStats | null,
  appointmentStats: DoctorAppointmentStats,
): AnalyticsMetric[] {
  const weekly = actionStats?.weekly_wsi ?? [];

  const weeklyAppointments = ensureSparkline(
    weekly.map((item) => safeNumber(item.appointments)),
    [0, 0, 0, 0],
  );

  const weeklyNoShowRates = ensureSparkline(
    weekly.map((item) => {
      const appointments = safeNumber(item.appointments);
      const noShows = safeNumber(item.no_shows);
      if (appointments <= 0) {
        return 0;
      }
      return (noShows / appointments) * 100;
    }),
    [0, 0, 0, 0],
  );

  const weeklyPending = ensureSparkline(
    weekly.map((item) => safeNumber(item.pending_tasks) + safeNumber(item.overdue_tasks)),
    [0, 0, 0, 0],
  );

  const weeklyWsi = ensureSparkline(
    weekly.map((item) => safeNumber(item.wsi)),
    [0, 0, 0, 0],
  );

  const revenueTrend = ensureSparkline(
    (actionStats?.revenue_trend ?? []).map((item) => safeNumber(item.revenue)),
    [0, 0, 0, 0],
  );

  const appointmentsChange = calculateChange(weeklyAppointments);
  const noShowChange = calculateChange(weeklyNoShowRates);
  const pendingChange = calculateChange(weeklyPending);
  const wsiChange = calculateChange(weeklyWsi);
  const revenueChange = calculateChange(revenueTrend);

  const totalPatients = safeNumber(appointmentStats?.total_patients);
  const todaysAppointments = safeNumber(appointmentStats?.todays_appointments);
  const pendingReviews = safeNumber(appointmentStats?.pending_reviews);
  const completionRate = safeNumber(actionStats?.completion_rate ?? appointmentStats?.completion_rate);
  const pendingActionsCount = safeNumber(actionStats?.pending_actions_count);
  const monthlyRevenue = safeNumber(actionStats?.monthly_revenue);
  const averageWsi = Math.round(weeklyWsi.reduce((sum, value) => sum + value, 0) / Math.max(weeklyWsi.length, 1));

  const baselineDailyAppointments =
    weeklyAppointments.reduce((sum, value) => sum + value, 0) / Math.max(weeklyAppointments.length * 7, 1);
  const todayChange = baselineDailyAppointments > 0
    ? ((todaysAppointments - baselineDailyAppointments) / baselineDailyAppointments) * 100
    : 0;

  return [
    {
      id: "total-patients",
      label: "Total Patients",
      value: formatCompact(totalPatients),
      subtitle: "unique patients connected",
      changeLabel: formatChange(appointmentsChange),
      changeDirection: trendDirectionFromChange(appointmentsChange),
      accent: "primary",
      sparkline: weeklyAppointments,
    },
    {
      id: "todays-appointments",
      label: "Today's Appointments",
      value: String(Math.round(todaysAppointments)),
      subtitle: "scheduled sessions today",
      changeLabel: formatChange(todayChange),
      changeDirection: trendDirectionFromChange(todayChange),
      accent: "primary",
      sparkline: weeklyAppointments,
    },
    {
      id: "pending-reviews",
      label: "Pending Reviews",
      value: String(Math.round(pendingReviews)),
      subtitle: "appointments pending review",
      changeLabel: formatChange(pendingChange),
      changeDirection: inverseTrendDirection(pendingChange),
      accent: "error",
      sparkline: weeklyPending,
    },
    {
      id: "completion-rate",
      label: "Completion Rate",
      value: formatPercent(completionRate),
      subtitle: "appointments/actions completed",
      changeLabel: formatChange(calculateChange([completionRate - 5, completionRate])),
      changeDirection: trendDirectionFromChange(calculateChange([completionRate - 5, completionRate])),
      accent: "primary",
      sparkline: weeklyWsi,
    },
    {
      id: "no-show-rate",
      label: "No-show Rate",
      value: formatPercent(weeklyNoShowRates[weeklyNoShowRates.length - 1] ?? 0),
      subtitle: "attendance risk indicator",
      changeLabel: formatChange(noShowChange),
      changeDirection: inverseTrendDirection(noShowChange),
      accent: "error",
      sparkline: weeklyNoShowRates,
    },
    {
      id: "pending-actions",
      label: "Pending Actions",
      value: String(Math.round(pendingActionsCount)),
      subtitle: "open workflow items",
      changeLabel: formatChange(pendingChange),
      changeDirection: inverseTrendDirection(pendingChange),
      accent: "tertiary",
      sparkline: weeklyPending,
    },
    {
      id: "revenue",
      label: "Monthly Revenue",
      value: formatCurrency(monthlyRevenue),
      subtitle: "backend-reported monthly total",
      changeLabel: formatChange(revenueChange),
      changeDirection: trendDirectionFromChange(revenueChange),
      accent: "primary",
      sparkline: revenueTrend,
    },
    {
      id: "workload-index",
      label: "Workload Index",
      value: `${averageWsi}`,
      subtitle: "weekly stress indicator",
      changeLabel: formatChange(wsiChange),
      changeDirection: inverseTrendDirection(wsiChange),
      accent: "tertiary",
      sparkline: weeklyWsi,
    },
  ];
}

function buildTableData(actions: DoctorAction[]): {
  patients: PatientTableRow[];
  consultations: ConsultationTableRow[];
  prescriptions: PrescriptionTableRow[];
} {
  const sortedActions = [...actions].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const patientMap = new Map<string, {
    id: string;
    patientName: string;
    condition: string;
    lastVisit: string;
    riskPercent: number;
    revenue: number;
    status: string;
  }>();

  const priorityRiskMap: Record<DoctorAction["priority"], number> = {
    low: 20,
    medium: 45,
    high: 70,
    urgent: 90,
  };

  sortedActions.forEach((action) => {
    const patientId = action.related_patient_id ?? "unknown";
    const patientSuffix = patientId === "unknown" ? "0000" : patientId.slice(-4);
    const currentRisk = priorityRiskMap[action.priority] ?? 20;
    const revenue = safeNumber(action.revenue_amount);

    const existing = patientMap.get(patientId);
    if (!existing) {
      patientMap.set(patientId, {
        id: action.id,
        patientName: patientId === "unknown" ? "Unassigned Patient" : `Patient #${patientSuffix}`,
        condition: action.title || ACTION_LABELS[action.action_type] || "General review",
        lastVisit: toReadableDate(action.created_at),
        riskPercent: currentRisk,
        revenue,
        status: action.status === "completed" ? "Active" : "Needs Attention",
      });
      return;
    }

    existing.riskPercent = Math.max(existing.riskPercent, currentRisk);
    existing.revenue += revenue;
    if (existing.status !== "Needs Attention" && action.status !== "completed") {
      existing.status = "Needs Attention";
    }
  });

  const patients: PatientTableRow[] = Array.from(patientMap.values())
    .slice(0, 12)
    .map((item) => ({
      id: item.id,
      patientName: item.patientName,
      condition: item.condition,
      lastVisit: item.lastVisit,
      riskLabel: item.riskPercent >= 70 ? "High" : item.riskPercent >= 45 ? "Moderate" : "Low",
      riskPercent: item.riskPercent,
      ltv: formatCurrency(item.revenue),
      status: item.status,
    }));

  const consultations: ConsultationTableRow[] = sortedActions
    .filter((item) => item.action_type === "consultation_completed")
    .slice(0, 10)
    .map((item, index) => {
      const start = new Date(item.created_at).getTime();
      const end = item.completed_at ? new Date(item.completed_at).getTime() : NaN;
      const durationInMinutes = Number.isFinite(start) && Number.isFinite(end) && end > start
        ? Math.max(1, Math.round((end - start) / 60000))
        : null;

      return {
        id: item.id,
        patientName: item.related_patient_id ? `Patient #${item.related_patient_id.slice(-4)}` : `Patient #${(index + 1000).toString()}`,
        date: toReadableDate(item.created_at),
        duration: durationInMinutes ? `${durationInMinutes}m` : "-",
        diagnosis: item.title || "Consultation review",
        status: item.status,
      };
    });

  const prescriptions: PrescriptionTableRow[] = sortedActions
    .filter((item) => item.action_type === "prescription_issued")
    .slice(0, 10)
    .map((item, index) => {
      const warning = item.priority === "high" || item.priority === "urgent" ? 1 : 0;
      return {
        id: item.id,
        patientName: item.related_patient_id ? `Patient #${item.related_patient_id.slice(-4)}` : `Patient #${(index + 2000).toString()}`,
        medicineCount: 1,
        warnings: warning,
        issuedAt: toReadableDate(item.created_at),
        safety: warning ? "Warning" : "Safe",
      };
    });

  return {
    patients,
    consultations,
    prescriptions,
  };
}

export function buildDoctorAnalyticsData(args: {
  actionStats: DoctorActionStats | null;
  appointmentStats: DoctorAppointmentStats;
  actions: DoctorAction[];
}): DoctorAnalyticsData {
  const { actionStats, appointmentStats, actions } = args;

  const metrics = buildMetrics(actionStats, appointmentStats);
  const table = buildTableData(actions);
  const heatmap = buildHeatmapFromActions(actions);
  const revenueSeries = buildRevenueSeries(actionStats, actions);
  const patientMix = buildPatientMix(actions);
  const actionCategories = buildActionCategories(actions);

  const weeklyWsi = actionStats?.weekly_wsi ?? [];
  const workloadChart =
    weeklyWsi.length > 0
      ? weeklyWsi.map((item) => ({
          day: item.week,
          actual: safeNumber(item.appointments),
          capacity: Math.max(
            safeNumber(item.appointments) + safeNumber(item.pending_tasks) + safeNumber(item.overdue_tasks),
            1,
          ),
        }))
      : [
          {
            day: "Current",
            actual: safeNumber(appointmentStats?.todays_appointments),
            capacity: Math.max(safeNumber(appointmentStats?.todays_appointments) * 2, 1),
          },
        ];

  const averageAppointmentsPerDay =
    workloadChart.reduce((sum, item) => sum + item.actual, 0) /
    Math.max(workloadChart.length * 7, 1);

  const averageWsi =
    weeklyWsi.reduce((sum, item) => sum + safeNumber(item.wsi), 0) /
    Math.max(weeklyWsi.length, 1);

  const burnoutRisk = averageWsi >= 75 ? "High" : averageWsi >= 50 ? "Moderate" : "Low";

  const noShowRate = weeklyWsi.length
    ? (weeklyWsi.reduce((sum, item) => sum + safeNumber(item.no_shows), 0) /
      Math.max(weeklyWsi.reduce((sum, item) => sum + safeNumber(item.appointments), 0), 1)) *
      100
    : 0;

  const topWorkloadPoint = workloadChart.reduce((best, point) => {
    return point.actual > best.actual ? point : best;
  }, workloadChart[0]);

  const demographicByRange = new Map(
    (actionStats?.demographic_breakdown ?? []).map((item) => [item.range, safeNumber(item.value)]),
  );

  const demographicSegments = [
    { label: "19-45", sourceKey: "19-45 Years", color: "#0360D9" },
    { label: "46-64", sourceKey: "46-64 Years", color: "#b1c6fc" },
    { label: "0-18", sourceKey: "0-18 Years", color: "#ffb597" },
    { label: "65+", sourceKey: "65+ Years", color: "#334876" },
  ].map((segment) => ({
    label: segment.label,
    value: Number((demographicByRange.get(segment.sourceKey) ?? 0).toFixed(1)),
    color: segment.color,
  }));

  const highlightedDemographic = demographicSegments.reduce((best, segment) => {
    return segment.value > best.value ? segment : best;
  }, demographicSegments[0]);

  const pendingRevenue = actions
    .filter((action) => action.status === "pending" || action.status === "in_progress")
    .reduce((sum, action) => sum + safeNumber(action.revenue_amount), 0);

  const totalAppointments = weeklyWsi.reduce((sum, item) => sum + safeNumber(item.appointments), 0);
  const monthlyRevenue = safeNumber(actionStats?.monthly_revenue);
  const avgPerVisit = totalAppointments > 0 ? monthlyRevenue / totalAppointments : 0;

  const prescriptionActions = actions.filter((action) => action.action_type === "prescription_issued");
  const blockedCount = prescriptionActions.filter((action) => {
    return action.priority === "urgent" || action.status === "cancelled";
  }).length;
  const warningCount = prescriptionActions.filter((action) => {
    return action.priority === "high" || action.status === "in_progress";
  }).length;

  const uniqueWarningCount = Math.max(0, warningCount - blockedCount);
  const safeCount = Math.max(0, prescriptionActions.length - blockedCount - uniqueWarningCount);
  const safetyScore =
    prescriptionActions.length > 0
      ? (safeCount / prescriptionActions.length) * 100
      : 0;
  const overrideRate =
    prescriptionActions.length > 0
      ? ((blockedCount + uniqueWarningCount) / prescriptionActions.length) * 100
      : 0;

  const completionRate = safeNumber(actionStats?.completion_rate ?? appointmentStats?.completion_rate);

  const completedDurationsInDays = actions
    .filter((action) => !!action.completed_at)
    .map((action) => {
      const start = new Date(action.created_at).getTime();
      const end = action.completed_at ? new Date(action.completed_at).getTime() : NaN;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
      }
      return (end - start) / (1000 * 60 * 60 * 24);
    })
    .filter((value): value is number => value !== null);

  const averageRecoveryTime = completedDurationsInDays.length > 0
    ? `${(completedDurationsInDays.reduce((sum, value) => sum + value, 0) / completedDurationsInDays.length).toFixed(1)} days`
    : "No timing data";

  const satisfactionScore = totalAppointments > 0
    ? clamp(5 - noShowRate / 20, 1, 5)
    : 0;

  const actionableCards: DoctorAnalyticsData["actionableInsights"]["cards"] = [];

  if (noShowRate >= 8) {
    actionableCards.push({
      id: "reduce-no-show",
      title: "Address Elevated No-show Rate",
      body: `No-show rate is ${formatPercent(noShowRate)}. Prioritize reminder workflows for high-risk slots.`,
      kind: "warning",
    });
  }

  if (safeNumber(actionStats?.pending_actions_count) > 0) {
    actionableCards.push({
      id: "pending-queue",
      title: "Clear Pending Action Queue",
      body: `${Math.round(safeNumber(actionStats?.pending_actions_count))} action items are still open. Focus on overdue and urgent tasks first.`,
      kind: "primary",
    });
  }

  if (burnoutRisk !== "Low") {
    actionableCards.push({
      id: "workload-balance",
      title: "Rebalance Workload Windows",
      body: `Current workload risk is ${burnoutRisk.toLowerCase()}. Shift non-urgent work away from ${heatmap.peakWindow}.`,
      kind: "tertiary",
    });
  }

  const revenueChange = calculateChange(revenueSeries.map((point) => point.value));
  actionableCards.push({
    id: "revenue-check",
    title: "Monitor Revenue Momentum",
    body:
      revenueChange >= 0
        ? `Revenue trend is ${formatChange(revenueChange)} over the recent window. Keep current throughput controls in place.`
        : `Revenue trend is ${formatChange(revenueChange)} over the recent window. Review appointment conversion and follow-up completion.`,
    kind: revenueChange >= 0 ? "neutral" : "warning",
  });

  const fallbackActionableCards = actionableCards.length > 0
    ? actionableCards
    : [
        {
          id: "baseline-monitoring",
          title: "No Critical Signals",
          body: "Current dataset does not indicate urgent operational risk. Continue baseline monitoring.",
          kind: "neutral" as const,
        },
      ];

  return {
    dateRange: "30d",
    comparePeriod: false,
    metrics,
    workload: {
      chart: workloadChart,
      peakWindow: heatmap.peakWindow,
      averagePatientsPerDay: `${averageAppointmentsPerDay.toFixed(1)} / day`,
      burnoutRisk,
    },
    aiInsight: {
      badge: "Backend-derived",
      title: "Operational Insight",
      description: `Peak workload is in ${topWorkloadPoint.day} with ${Math.round(topWorkloadPoint.actual)} appointments. No-show rate currently sits at ${formatPercent(noShowRate)}.`,
      ctaLabel: "Review Weekly Plan",
    },
    heatmap: {
      hours: heatmap.hours,
      days: heatmap.days,
      values: heatmap.values,
    },
    demographics: {
      highlightedLabel: `${highlightedDemographic.label} yrs`,
      highlightedValue: highlightedDemographic.value,
      segments: demographicSegments,
      newPatients: patientMix.newPatients,
      returningPatients: patientMix.returningPatients,
      trendLabel: patientMix.trendLabel,
    },
    conditions: {
      alert:
        actionCategories.length > 0
          ? `Top activity: ${actionCategories[0].name}`
          : "No recent activity signals",
      items: actionCategories.map((category) => ({
        name: category.name,
        count: category.count,
        percentage: category.percentage,
      })),
    },
    prescriptionSafety: {
      score: Number(safetyScore.toFixed(1)),
      safe: safeCount,
      warning: uniqueWarningCount,
      blocked: blockedCount,
      overrideRate: Number(overrideRate.toFixed(1)),
      status: safetyScore >= 90 ? "Stable" : safetyScore >= 70 ? "Watch" : "High Risk",
    },
    revenue: {
      series: revenueSeries,
      total: monthlyRevenue,
      pending: Number(pendingRevenue.toFixed(2)),
      avgPerVisit: Number(avgPerVisit.toFixed(2)),
    },
    aiPerformance: {
      suggestions: actions.length,
      accepted: Math.round(completionRate),
      modified: Math.round((safeNumber(actionStats?.pending_actions_count) / Math.max(actions.length, 1)) * 100),
      rejected: Math.round((actions.filter((action) => action.status === "cancelled").length / Math.max(actions.length, 1)) * 100),
      insightTitle: "Workflow Throughput Insight",
      insightBody:
        actions.length > 0
          ? `${actions.length} tracked actions were analyzed. Completion is at ${formatPercent(completionRate)} with ${Math.round(safeNumber(actionStats?.pending_actions_count))} pending.`
          : "No recent action records available yet.",
    },
    outcomes: {
      recoveryProgress: Math.round(completionRate),
      recoveryTrendLabel: formatChange(calculateChange(metrics.map((metric) => metric.sparkline[metric.sparkline.length - 1] ?? 0))),
      repeatVisitProgress: patientMix.returningPatients,
      repeatVisitLabel: patientMix.returningPatients >= 50 ? "Strong continuity" : "Growth opportunity",
      averageRecoveryTime,
      satisfaction: satisfactionScore > 0 ? `${satisfactionScore.toFixed(1)} / 5.0` : "No data",
    },
    actionableInsights: {
      title: "Operational Recommendations",
      subtitle: "Recommendations are generated from live doctor action, appointment, and workload data.",
      ctaLabel: "Open Action Queue",
      cards: fallbackActionableCards,
    },
    table,
  };
}
