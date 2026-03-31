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

function readErrorDetail(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }

  return fallback;
}

function normalizeTimeForApi(rawTime: string): string {
  const input = rawTime.trim();
  const twentyFourHour = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(input);
  if (twentyFourHour) {
    const hour = twentyFourHour[1].padStart(2, "0");
    const minute = twentyFourHour[2];
    const second = twentyFourHour[3] ?? "00";
    return `${hour}:${minute}:${second}`;
  }

  const twelveHour = /^(\d{1,2}):([0-5]\d)\s*([AP]M)$/i.exec(input);
  if (twelveHour) {
    const hourValue = Number(twelveHour[1]);
    const minute = twelveHour[2];
    const meridiem = twelveHour[3].toUpperCase();
    const convertedHour =
      meridiem === "AM"
        ? (hourValue === 12 ? 0 : hourValue)
        : (hourValue === 12 ? 12 : hourValue + 12);
    return `${String(convertedHour).padStart(2, "0")}:${minute}:00`;
  }

  return input;
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
  const normalizedTime = normalizeTimeForApi(data.proposed_time);
  const canonicalPayload = {
    proposed_date: data.proposed_date,
    proposed_time: normalizedTime,
    reason: data.reason,
  };

  const response = await fetch(`${BACKEND_URL}/appointment/${data.appointment_id}/reschedule-requests`, {
    method: "POST",
    headers,
    body: JSON.stringify(canonicalPayload),
  });

  if (!response.ok && response.status === 404) {
    // Compatibility fallback: legacy dedicated reschedule router.
    const compatResponse = await fetch(`${BACKEND_URL}/reschedule/request`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        appointment_id: data.appointment_id,
        proposed_date: data.proposed_date,
        proposed_time: normalizedTime,
        reason: data.reason,
      }),
    });

    if (compatResponse.ok) {
      revalidatePath("/patient/appointments");
      revalidatePath("/doctor/appointments");
      return compatResponse.json();
    }

    if (compatResponse.status !== 404) {
      const compatError = await compatResponse.json().catch(() => null);
      throw new Error(readErrorDetail(compatError, "Failed to request reschedule"));
    }

    // Final fallback: old appointment legacy endpoint accepting `new_appointment_date`.
    const legacyResponse = await fetch(`${BACKEND_URL}/appointment/${data.appointment_id}/request-reschedule`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        new_appointment_date: `${data.proposed_date}T${normalizedTime}`,
        reason: data.reason,
      }),
    });

    if (!legacyResponse.ok) {
      const legacyError = await legacyResponse.json().catch(() => null);
      throw new Error(readErrorDetail(legacyError, "Failed to request reschedule"));
    }

    revalidatePath("/patient/appointments");
    revalidatePath("/doctor/appointments");
    return legacyResponse.json();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(readErrorDetail(error, "Failed to request reschedule"));
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/appointments");
  return response.json();
}

export async function respondToReschedule(
  requestId: string,
  accept: boolean,
  responseNote?: string,
) {
  const headers = await authHeaders();

  const response = await fetch(
    `${BACKEND_URL}/appointment/reschedule-requests/${requestId}/respond`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ accept, response_note: responseNote }),
    }
  );

  if (!response.ok && response.status === 404) {
    const compatResponse = await fetch(
      `${BACKEND_URL}/reschedule/${requestId}/respond`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ accept, response_note: responseNote }),
      }
    );

    if (!compatResponse.ok) {
      const compatError = await compatResponse.json().catch(() => null);
      throw new Error(readErrorDetail(compatError, "Failed to respond to reschedule"));
    }

    revalidatePath("/patient/appointments");
    revalidatePath("/doctor/appointments");
    return compatResponse.json();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(readErrorDetail(error, "Failed to respond to reschedule"));
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
