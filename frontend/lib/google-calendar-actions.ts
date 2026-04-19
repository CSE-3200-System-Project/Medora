"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getGoogleCalendarStatus(): Promise<{
  connected: boolean;
  provider: string;
  google_email: string | null;
  google_name: string | null;
  google_picture: string | null;
}> {
  const headers = await authHeaders();
  const response = await fetch(`${BACKEND_URL}/oauth/google/status`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      connected: false,
      provider: "google",
      google_email: null,
      google_name: null,
      google_picture: null,
    };
  }

  return response.json();
}

export async function getGoogleConnectUrl(): Promise<string> {
  const headers = await authHeaders();
  const response = await fetch(`${BACKEND_URL}/oauth/google/connect`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to get Google Calendar authorization URL");
  }

  const data = await response.json();
  return data.authorization_url;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const headers = await authHeaders();
  const response = await fetch(`${BACKEND_URL}/oauth/google/disconnect`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to disconnect Google Calendar");
  }
}

export async function syncMedicationReminderToCalendar(
  reminderId: string,
  data: {
    item_name: string;
    reminder_times: string[];
    days_of_week: number[];
    start_date: string;
    end_date?: string;
    notes?: string;
  }
): Promise<{ message: string; event_id: string }> {
  const headers = await authHeaders();
  const response = await fetch(
    `${BACKEND_URL}/oauth/google/sync/medication/${reminderId}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to sync medication reminder");
  }

  return response.json();
}

export async function syncAppointmentToCalendar(
  appointmentId: string,
  data: {
    summary: string;
    description: string;
    start_datetime: string;
    duration_minutes?: number;
    location?: string;
  }
): Promise<{ message: string; event_id: string }> {
  const headers = await authHeaders();
  const response = await fetch(
    `${BACKEND_URL}/oauth/google/sync/appointment/${appointmentId}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to sync appointment");
  }

  return response.json();
}
