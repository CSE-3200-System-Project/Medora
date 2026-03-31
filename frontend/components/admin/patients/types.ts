export type PatientStatusFilter = "all" | "active" | "incomplete" | "banned";

export type PatientRecord = {
  id: string;
  name: string;
  first_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  onboarding_completed: boolean;
  created_at?: string;
  blood_group?: string;
  city?: string;
  account_status?: string;
  ban_reason?: string;
  avatar_url?: string;
  medical_reports_count?: number;
};

export type PatientsListPayload = {
  patients: PatientRecord[];
  total: number;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
};

export type PatientStatsSummary = {
  total: number;
  active: number;
  incomplete: number;
  banned: number;
};

export type PatientChartsPayload = {
  growth: Array<{ name: string; value: number }>;
  distribution: Array<{ name: string; value: number; color?: string }>;
};

export type PatientInsightsPayload = {
  todaysRegistrations: number;
  pendingReviews: number;
  recentActivity: Array<{
    id?: string;
    message?: string;
    createdAt?: string;
    type?: string;
  }>;
};
