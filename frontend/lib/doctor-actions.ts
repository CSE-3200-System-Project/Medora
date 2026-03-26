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

export type DoctorActionType =
  | "appointment_completed"
  | "prescription_issued"
  | "consultation_completed"
  | "lab_review"
  | "patient_message"
  | "manual_task";

export type DoctorActionPriority = "low" | "medium" | "high" | "urgent";
export type DoctorActionStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type DoctorAction = {
  id: string;
  doctor_id: string;
  action_type: DoctorActionType;
  title: string;
  description?: string | null;
  priority: DoctorActionPriority;
  status: DoctorActionStatus;
  related_patient_id?: string | null;
  related_appointment_id?: string | null;
  revenue_amount?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type DoctorActionStats = {
  monthly_revenue: number;
  weekly_wsi: Array<{
    week: string;
    appointments: number;
    no_shows: number;
    pending_tasks: number;
    overdue_tasks: number;
    wsi: number;
  }>;
  pending_actions_count: number;
  pending_actions: Array<{
    id: string;
    title: string;
    priority: DoctorActionPriority;
    status: DoctorActionStatus;
    due_date?: string | null;
    related_patient_id?: string | null;
  }>;
  completion_rate: number;
  revenue_trend: Array<{ week: string; revenue: number }>;
  demographic_breakdown: Array<{ range: string; value: number }>;
};

export async function createDoctorAction(input: {
  action_type?: DoctorActionType;
  title: string;
  description?: string;
  priority?: DoctorActionPriority;
  status?: DoctorActionStatus;
  related_patient_id?: string;
  related_appointment_id?: string;
  revenue_amount?: number;
  due_date?: string;
}) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/doctor/actions/`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create doctor action" }));
    throw new Error(error.detail || "Failed to create doctor action");
  }

  return (await response.json()) as DoctorAction;
}

export async function getDoctorActions(params?: {
  status_filter?: DoctorActionStatus;
  type_filter?: DoctorActionType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}) {
  const headers = await getAuthHeaders();
  const query = new URLSearchParams();
  if (params?.status_filter) query.set("status_filter", params.status_filter);
  if (params?.type_filter) query.set("type_filter", params.type_filter);
  if (params?.start_date) query.set("start_date", params.start_date);
  if (params?.end_date) query.set("end_date", params.end_date);
  if (typeof params?.limit === "number") query.set("limit", String(params.limit));
  if (typeof params?.offset === "number") query.set("offset", String(params.offset));

  const response = await fetch(`${BACKEND_URL}/doctor/actions/?${query.toString()}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch doctor actions" }));
    throw new Error(error.detail || "Failed to fetch doctor actions");
  }

  return (await response.json()) as { actions: DoctorAction[]; total: number };
}

export async function getPendingDoctorActions() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/doctor/actions/pending`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch pending actions" }));
    throw new Error(error.detail || "Failed to fetch pending actions");
  }

  return (await response.json()) as { actions: DoctorAction[]; total: number };
}

export async function getDoctorActionStats() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/doctor/actions/stats`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch doctor action stats" }));
    throw new Error(error.detail || "Failed to fetch doctor action stats");
  }

  return (await response.json()) as DoctorActionStats;
}

export async function updateDoctorAction(
  actionId: string,
  input: {
    title?: string;
    description?: string;
    priority?: DoctorActionPriority;
    status?: DoctorActionStatus;
    related_patient_id?: string;
    related_appointment_id?: string;
    revenue_amount?: number;
    due_date?: string;
    completed_at?: string;
  }
) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/doctor/actions/${actionId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update doctor action" }));
    throw new Error(error.detail || "Failed to update doctor action");
  }

  return (await response.json()) as DoctorAction;
}

export async function deleteDoctorAction(actionId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/doctor/actions/${actionId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete doctor action" }));
    throw new Error(error.detail || "Failed to delete doctor action");
  }
}
