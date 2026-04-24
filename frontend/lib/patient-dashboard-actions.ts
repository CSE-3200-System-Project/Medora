"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

async function getAuthHeaders() {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) {
    throw new Error("Authentication required");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type PatientDashboardScoreFactor = {
  label: string;
  points: number;
  max_points: number;
  status: "good" | "warning" | "missing";
  detail: string;
};

export type PatientDashboardScoreBreakdown = {
  total: number;
  max_total: number;
  factors: PatientDashboardScoreFactor[];
  summary: string;
};

export type PatientDashboardBMI = {
  value: number | null;
  category: string | null;
  height_cm: number | null;
  weight_kg: number | null;
};

export type PatientDashboardPayload = {
  user_name: string;
  health_score: number;
  score_breakdown?: PatientDashboardScoreBreakdown | null;
  bmi?: PatientDashboardBMI | null;
  chronic_conditions_count?: number;
  chronic_conditions?: string[];
  active_medications_count?: number;
  upcoming_appointments: Array<{
    id: string;
    doctor_name: string;
    specialty?: string | null;
    appointment_date: string;
    status: string;
    reason?: string | null;
    doctor_photo_url?: string | null;
  }>;
  medication_adherence_trend: {
    labels: string[];
    values: number[];
    adherence_rate: number;
    delta_percent: number;
  };
  today_health_stats: Array<{
    label: string;
    value: string;
    trend: string;
    trend_type: "up" | "down" | "neutral";
  }>;
  ai_insights: Array<{
    title: string;
    description: string;
    tone: "success" | "warning" | "info" | "danger";
    icon?: string | null;
  }>;
  device_connection_status: {
    title: string;
    last_synced: string;
    connected: boolean;
  };
};

export async function getPatientDashboard() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/patient/dashboard`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch patient dashboard" }));
    throw new Error(error.detail || "Failed to fetch patient dashboard");
  }

  return (await response.json()) as PatientDashboardPayload;
}
