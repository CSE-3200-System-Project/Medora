"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type ReminderType = "medication" | "test";

export interface Reminder {
  id: string;
  user_id: string;
  type: ReminderType;
  item_name: string;
  item_id?: string;
  prescription_id?: string;  // Links reminder to a doctor prescription
  reminder_times: string[];  // Array of HH:MM format times (e.g., ["08:00", "14:00", "20:00"])
  days_of_week: number[];    // 0=Monday, 6=Sunday
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ReminderListResponse {
  reminders: Reminder[];
  total: number;
}

export interface CreateReminderInput {
  type: ReminderType;
  item_name: string;
  item_id?: string;
  prescription_id?: string;  // Optional link to prescription
  reminder_times: string[];  // Array of HH:MM format times
  days_of_week?: number[];
  notes?: string;
}

export interface UpdateReminderInput {
  item_name?: string;
  reminder_times?: string[];  // Array of HH:MM format times
  days_of_week?: number[];
  notes?: string;
  is_active?: boolean;
}

/**
 * Create a new reminder
 */
export async function createReminder(data: CreateReminderInput): Promise<Reminder> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/reminders/`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create reminder" }));
    throw new Error(error.detail || "Failed to create reminder");
  }

  return await response.json();
}

/**
 * Get all reminders for the current user
 */
export async function getReminders(options?: {
  type_filter?: ReminderType;
  active_only?: boolean;
}): Promise<ReminderListResponse> {
  const headers = await getAuthHeaders();
  
  const params = new URLSearchParams();
  if (options?.type_filter) params.append("type_filter", options.type_filter);
  if (options?.active_only !== undefined) params.append("active_only", String(options.active_only));

  const response = await fetch(`${BACKEND_URL}/reminders/?${params.toString()}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch reminders" }));
    throw new Error(error.detail || "Failed to fetch reminders");
  }

  return await response.json();
}

/**
 * Get a specific reminder by ID
 */
export async function getReminder(reminderId: string): Promise<Reminder> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/reminders/${reminderId}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch reminder" }));
    throw new Error(error.detail || "Failed to fetch reminder");
  }

  return await response.json();
}

/**
 * Update a reminder
 */
export async function updateReminder(
  reminderId: string,
  data: UpdateReminderInput
): Promise<Reminder> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/reminders/${reminderId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to update reminder" }));
    throw new Error(error.detail || "Failed to update reminder");
  }

  return await response.json();
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId: string): Promise<void> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/reminders/${reminderId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to delete reminder" }));
    throw new Error(error.detail || "Failed to delete reminder");
  }
}

/**
 * Toggle reminder active status
 */
export async function toggleReminder(reminderId: string): Promise<Reminder> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/reminders/${reminderId}/toggle`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to toggle reminder" }));
    throw new Error(error.detail || "Failed to toggle reminder");
  }

  return await response.json();
}
