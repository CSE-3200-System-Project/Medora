"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

// === Helper ===

async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) throw new Error("Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// === Weekly Availability ===

export async function getWeeklyAvailability(doctorId: string) {
  const response = await fetch(`${BACKEND_URL}/availability/${doctorId}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Failed to fetch availability");
  }

  return response.json();
}

export async function updateWeeklyAvailability(schedule: {
  days: {
    day_of_week: number;
    is_active: boolean;
    time_blocks: {
      start_time: string;
      end_time: string;
      slot_duration_minutes: number;
    }[];
  }[];
  appointment_duration: number;
}) {
  const headers = await authHeaders();

  const response = await fetch(`${BACKEND_URL}/availability/weekly`, {
    method: "PUT",
    headers,
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to update availability");
  }

  revalidatePath("/doctor/schedule");
  return response.json();
}

// === Exceptions (Leave / Holidays) ===

export async function addException(data: {
  exception_date: string;
  is_available: boolean;
  reason?: string;
}) {
  const headers = await authHeaders();

  const response = await fetch(`${BACKEND_URL}/availability/exception`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to add exception");
  }

  revalidatePath("/doctor/schedule");
  return response.json();
}

export async function removeException(exceptionId: string) {
  const headers = await authHeaders();

  const response = await fetch(
    `${BACKEND_URL}/availability/exception/${exceptionId}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to remove exception");
  }

  revalidatePath("/doctor/schedule");
  return response.json();
}

// === Schedule Overrides (One-off custom dates) ===

export async function addScheduleOverride(data: {
  override_date: string;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
}) {
  const headers = await authHeaders();

  const response = await fetch(`${BACKEND_URL}/availability/override`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to add override");
  }

  revalidatePath("/doctor/schedule");
  return response.json();
}

export async function removeScheduleOverride(overrideId: string) {
  const headers = await authHeaders();

  const response = await fetch(
    `${BACKEND_URL}/availability/override/${overrideId}`,
    {
      method: "DELETE",
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to remove override");
  }

  revalidatePath("/doctor/schedule");
  return response.json();
}

// === Slot Lookup (Public) ===

export async function getAvailableSlots(doctorId: string, date: string) {
  const response = await fetch(
    `${BACKEND_URL}/availability/${doctorId}/slots/${date}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Failed to fetch available slots");
  }

  return response.json();
}

// === Reschedule ===

export async function requestReschedule(data: {
  appointment_id: string;
  proposed_date: string;
  proposed_time: string;
  reason?: string;
}) {
  const headers = await authHeaders();

  const response = await fetch(`${BACKEND_URL}/reschedule/request`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to request reschedule");
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/appointments");
  return response.json();
}

export async function respondToReschedule(
  requestId: string,
  accept: boolean
) {
  const headers = await authHeaders();

  const response = await fetch(
    `${BACKEND_URL}/reschedule/${requestId}/respond`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ accept }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to respond to reschedule");
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/appointments");
  return response.json();
}

export async function getRescheduleHistory(appointmentId: string) {
  const headers = await authHeaders();

  const response = await fetch(
    `${BACKEND_URL}/reschedule/appointment/${appointmentId}`,
    {
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error("Failed to fetch reschedule history");
  }

  return response.json();
}
