export type TrendDirection = "up" | "down" | "neutral";

export type MetricAccent = "primary" | "tertiary" | "error";

export type DateRangeOption = "7d" | "30d" | "90d" | "6mo" | "1yr" | "2yr";

export type AnalyticsMetric = {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  changeLabel: string;
  changeDirection: TrendDirection;
  accent: MetricAccent;
  sparkline: number[];
};

export type WorkloadPoint = {
  day: string;
  actual: number;
  capacity: number;
};

export type AIInsight = {
  badge: string;
  title: string;
  description: string;
  ctaLabel: string;
};

export type HeatmapData = {
  hours: string[];
  days: string[];
  values: number[][];
};

export type DemographicSegment = {
  label: string;
  value: number;
  color: string;
};

export type DemographicsData = {
  highlightedLabel: string;
  highlightedValue: number;
  segments: DemographicSegment[];
  newPatients: number;
  returningPatients: number;
  trendLabel: string;
};

export type ClinicalCondition = {
  name: string;
  count: number;
  percentage: number;
};

export type PrescriptionSafetyData = {
  score: number;
  safe: number;
  warning: number;
  blocked: number;
  overrideRate: number;
  status: string;
};

export type RevenuePoint = {
  label: string;
  value: number;
};

export type RevenueData = {
  series: RevenuePoint[];
  total: number;
  pending: number;
  avgPerVisit: number;
};

export type AIPerformanceData = {
  suggestions: number;
  accepted: number;
  modified: number;
  rejected: number;
  insightTitle: string;
  insightBody: string;
};

export type PatientOutcomeData = {
  recoveryProgress: number;
  recoveryTrendLabel: string;
  repeatVisitProgress: number;
  repeatVisitLabel: string;
  averageRecoveryTime: string;
  satisfaction: string;
};

export type ActionableInsightCard = {
  id: string;
  title: string;
  body: string;
  kind: "warning" | "primary" | "tertiary" | "neutral";
};

export type PatientTableRow = {
  id: string;
  patientName: string;
  condition: string;
  lastVisit: string;
  riskLabel: string;
  riskPercent: number;
  ltv: string;
  status: string;
};

export type ConsultationTableRow = {
  id: string;
  patientName: string;
  date: string;
  duration: string;
  diagnosis: string;
  status: string;
};

export type PrescriptionTableRow = {
  id: string;
  patientName: string;
  medicineCount: number;
  warnings: number;
  issuedAt: string;
  safety: string;
};

export type DoctorAnalyticsData = {
  dateRange: DateRangeOption;
  comparePeriod: boolean;
  metrics: AnalyticsMetric[];
  workload: {
    chart: WorkloadPoint[];
    peakWindow: string;
    averagePatientsPerDay: string;
    burnoutRisk: string;
  };
  aiInsight: AIInsight;
  heatmap: HeatmapData;
  demographics: DemographicsData;
  conditions: {
    alert: string;
    items: ClinicalCondition[];
  };
  prescriptionSafety: PrescriptionSafetyData;
  revenue: RevenueData;
  aiPerformance: AIPerformanceData;
  outcomes: PatientOutcomeData;
  actionableInsights: {
    title: string;
    subtitle: string;
    ctaLabel: string;
    cards: ActionableInsightCard[];
  };
  table: {
    patients: PatientTableRow[];
    consultations: ConsultationTableRow[];
    prescriptions: PrescriptionTableRow[];
  };
};
