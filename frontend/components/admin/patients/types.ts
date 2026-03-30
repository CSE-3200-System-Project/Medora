export type PatientStatusFilter = "all" | "active" | "incomplete" | "banned";

export type PatientRecord = {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  city?: string;
  blood_group?: string;
  avatar_url?: string;
  account_status: "active" | "banned" | "suspended";
  onboarding_completed: boolean;
  onboarding_progress: number;
  medical_reports_count: number;
  created_at?: string;
};

export type PatientStatsSummary = {
  total: number;
  active: number;
  incomplete: number;
  banned: number;
};

export type PatientGrowthPoint = {
  key: string;
  label: string;
  registrations: number;
};

export type PatientStatusDistributionPoint = {
  name: string;
  value: number;
  color: string;
};

export type PatientChartsPayload = {
  growth: PatientGrowthPoint[];
  distribution: PatientStatusDistributionPoint[];
};

export type PatientInsightItem = {
  id: string;
  type: "registration" | "account_banned" | "profile_updated";
  message: string;
  timestamp: string;
};

export type PatientInsightsPayload = {
  todaysRegistrations: number;
  pendingReviews: number;
  recentActivity: PatientInsightItem[];
};

export type PatientsListPayload = {
  patients: PatientRecord[];
  total: number;
  page: number;
  pageSize: number;
};
