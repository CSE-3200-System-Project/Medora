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

export type HealthMetricType =
  | "steps"
  | "sleep_hours"
  | "sleep_minutes"
  | "heart_rate"
  | "blood_pressure_systolic"
  | "blood_pressure_diastolic"
  | "weight"
  | "blood_sugar";

export type HealthMetricSource = "manual" | "device";

export type HealthMetric = {
  id: string;
  user_id: string;
  metric_type: HealthMetricType;
  value: number;
  unit: string;
  recorded_at: string;
  source: HealthMetricSource;
  notes?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type HealthMetricTrendPoint = {
  date: string;
  average_value: number;
  min_value: number;
  max_value: number;
  entries: number;
};

export type HealthMetricTrendSeries = {
  metric_type: HealthMetricType;
  unit: string;
  points: HealthMetricTrendPoint[];
};

export async function logHealthMetric(input: {
  metric_type: HealthMetricType;
  value: number;
  unit: string;
  recorded_at?: string;
  source?: HealthMetricSource;
  notes?: string;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-metrics/`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to log health metric" }));
    throw new Error(error.detail || "Failed to log health metric");
  }

  return (await response.json()) as HealthMetric;
}

export async function getHealthMetrics(params?: {
  metric_type?: HealthMetricType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}) {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.metric_type) query.set("metric_type", params.metric_type);
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  if (typeof params?.offset === "number") query.set("offset", String(params.offset));

  const response = await fetch(`${BACKEND_URL}/health-metrics/?${query.toString()}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch health metrics" }));
    throw new Error(error.detail || "Failed to fetch health metrics");
  }

  return (await response.json()) as { metrics: HealthMetric[]; total: number };
}

export async function getTodayMetrics() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-metrics/today`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch today health metrics" }));
    throw new Error(error.detail || "Failed to fetch today health metrics");
  }

  return (await response.json()) as {
    date: string;
    summary: Array<{
      metric_type: HealthMetricType;
      value: number;
      unit: string;
      source: HealthMetricSource;
      recorded_at: string;
    }>;
  };
}

export async function getMetricTrends(params?: { days?: number; metric_type?: HealthMetricType }) {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  query.set("days", String(params?.days ?? 7));
  if (params?.metric_type) query.set("metric_type", params.metric_type);

  const response = await fetch(`${BACKEND_URL}/health-metrics/trends?${query.toString()}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch health metric trends" }));
    throw new Error(error.detail || "Failed to fetch health metric trends");
  }

  return (await response.json()) as {
    days: number;
    trends: HealthMetricTrendSeries[];
  };
}

export async function updateHealthMetric(
  metricId: string,
  input: {
    value?: number;
    unit?: string;
    recorded_at?: string;
    source?: HealthMetricSource;
    notes?: string;
  }
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-metrics/${metricId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update health metric" }));
    throw new Error(error.detail || "Failed to update health metric");
  }

  return (await response.json()) as HealthMetric;
}

export async function deleteHealthMetric(metricId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-metrics/${metricId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete health metric" }));
    throw new Error(error.detail || "Failed to delete health metric");
  }
}
