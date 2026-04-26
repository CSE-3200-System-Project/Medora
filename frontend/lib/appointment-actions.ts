"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

export type CancellationReasonOption = {
  key: string;
  label: string;
};

export type CancellationReasonCatalog = {
  buffer_minutes: number;
  patient: CancellationReasonOption[];
  doctor: CancellationReasonOption[];
};

export type DoctorRevenueSummary = {
  total_revenue: number;
  monthly_revenue: number;
  completed_appointments: number;
  completed_this_month: number;
  consultation_fee?: number | null;
};

function getErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail.trim()) {
    return detail;
  }

  if (detail && typeof detail === "object") {
    const maybeDetail = (detail as { detail?: unknown }).detail;
    if (typeof maybeDetail === "string" && maybeDetail.trim()) {
      return maybeDetail;
    }
  }

  return fallback;
}

// === APPOINTMENT ACTIONS ===

export async function createAppointment(data: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
     const error = await response.json();
     throw new Error(error.detail || "Booking failed");
  }
  
  revalidatePath("/patient/appointments");
  return response.json();
}

export type MyAppointmentsOptions = {
  page?: number;
  size?: number;
};

export async function getMyAppointments(options: MyAppointmentsOptions = {}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return [];
  }

  const params = new URLSearchParams();
  if (options.page) params.set("page", String(options.page));
  if (typeof options.size === "number") params.set("size", String(options.size));
  const queryString = params.toString();
  const url = `${BACKEND_URL}/appointment/my-appointments${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return [];
    }
    throw new Error("Failed to fetch appointments");
  }

  return response.json();
}

export async function getDoctorAppointmentStats() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return null;
  }

  const response = await fetch(`${BACKEND_URL}/appointment/stats`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }
    throw new Error("Failed to fetch doctor appointment stats");
  }

  return response.json();
}

export async function getDoctorUpcomingAppointments(limit: number = 3) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return [];
  }

  const response = await fetch(`${BACKEND_URL}/appointment/upcoming?limit=${limit}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return [];
    }
    throw new Error("Failed to fetch doctor upcoming appointments");
  }

  return response.json();
}

export async function updateAppointment(id: string, data: any) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
       Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(getErrorMessage(error?.detail, "Update failed"));
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/patient/appointments");
  return response.json();
}

export async function getCancellationReasons(role: "patient" | "doctor" = "patient") {
  const response = await fetch(`${BACKEND_URL}/appointment/cancellation-reasons`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch cancellation reasons");
  }

  const payload = (await response.json()) as CancellationReasonCatalog;
  const reasons = role === "doctor" ? payload.doctor : payload.patient;

  return {
    bufferMinutes: payload.buffer_minutes,
    reasons,
  };
}

export async function cancelAppointment(
  appointmentId: string,
  payload: { reasonKey: string; reasonNote?: string },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/cancel`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reason_key: payload.reasonKey,
      reason_note: payload.reasonNote,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(getErrorMessage(error?.detail, "Failed to cancel appointment"));
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/patient/appointments");
  return response.json();
}

export async function getAppointmentsByDate(date: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return [];
  }

  const response = await fetch(`${BACKEND_URL}/appointment/by-date/${date}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      return [];
    }
    throw new Error("Failed to fetch appointments by date");
  }

  return response.json();
}

// Get booked slots for a doctor on a specific date (public)
export async function getDoctorBookedSlots(doctorId: string, date: string) {
  const response = await fetch(`${BACKEND_URL}/appointment/doctor/${doctorId}/booked-slots?date=${date}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch booked slots");
  }

  return response.json();
}

// Get previously visited doctors for a patient
export async function getPreviouslyVisitedDoctors() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return { doctors: [], total: 0 };
  }

  const response = await fetch(`${BACKEND_URL}/appointment/patient/previously-visited`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { doctors: [], total: 0 };
    }
    throw new Error("Failed to fetch previously visited doctors");
  }

  return response.json();
}

// Get patient calendar appointments.
// Defaults to a -180d / +180d window (server-side) for performance.
// Pass { showAll: true } to return every appointment (legacy behavior).
export type PatientCalendarOptions = {
  startDate?: string;        // ISO YYYY-MM-DD (or full ISO datetime)
  endDate?: string;
  page?: number;
  size?: number;
  showAll?: boolean;
};

export async function getPatientCalendarAppointments(options: PatientCalendarOptions = {}) {
  const fallbackPayload = { appointments: [], by_date: [], total: 0, page: 1, size: null, has_more: false };

  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token || !BACKEND_URL) {
    return fallbackPayload;
  }

  const params = new URLSearchParams();
  if (options.startDate) params.set("start_date", options.startDate);
  if (options.endDate) params.set("end_date", options.endDate);
  if (options.page) params.set("page", String(options.page));
  if (typeof options.size === "number") params.set("size", String(options.size));
  if (options.showAll) params.set("show_all", "true");

  const queryString = params.toString();
  const url = `${BACKEND_URL}/appointment/patient/calendar${queryString ? `?${queryString}` : ""}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        return fallbackPayload;
      }

      const responseText = await response.text().catch(() => "");
      console.warn("Calendar appointments request returned a non-ok response", {
        status: response.status,
        body: responseText,
      });

      return fallbackPayload;
    }

    return response.json();
  } catch (error) {
    console.warn("Calendar appointments request failed", error);
    return fallbackPayload;
  }
}

// Tiny payload for cards: total, upcoming_count, next_appointment, last_visit.
export async function getPatientCalendarSummary() {
  const fallbackPayload = { total: 0, upcoming_count: 0, next_appointment: null, last_visit: null };

  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token || !BACKEND_URL) {
    return fallbackPayload;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/appointment/patient/calendar/summary`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 20 },
    });

    if (!response.ok) {
      return fallbackPayload;
    }

    return response.json();
  } catch (error) {
    console.warn("Calendar summary request failed", error);
    return fallbackPayload;
  }
}

// Get doctor's patient list
export async function getDoctorPatients() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return { patients: [], total: 0 };
  }

  const response = await fetch(`${BACKEND_URL}/appointment/doctor/patients`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { patients: [], total: 0 };
    }
    throw new Error("Failed to fetch patients");
  }

  return response.json();
}

function toReschedulePayload(newAppointmentDate: string) {
  const parsed = new Date(newAppointmentDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid appointment date");
  }

  const iso = parsed.toISOString();
  return {
    proposed_date: iso.slice(0, 10),
    proposed_time: iso.slice(11, 16),
  };
}

// Reschedule helper (legacy alias kept for compatibility)
export async function rescheduleAppointment(id: string, newDate: string, newSlot: string) {
  const slotSuffix = newSlot ? ` ${newSlot}` : "";
  return requestRescheduleAppointment(id, newDate, `Reschedule requested${slotSuffix}`.trim());
}

export async function deletePendingAppointmentRequest(appointmentId: string) {
  if (!appointmentId?.trim()) {
    throw new Error("Invalid appointment id");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/pending-request`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok && response.status === 404) {
    // Compatibility fallback for older backend builds that don't expose /pending-request yet.
    const cancelResponse = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/cancel`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        reason_key: "OTHER",
        reason_note: "Pending request deleted by patient",
      }),
    });

    if (cancelResponse.ok) {
      revalidatePath("/doctor/appointments");
      revalidatePath("/patient/appointments");
      return cancelResponse.json();
    }

    // Final fallback for legacy PATCH status flow.
    const legacyPatchResponse = await fetch(`${BACKEND_URL}/appointment/${appointmentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        status: "CANCELLED",
        notes: "Pending request deleted by patient",
      }),
    });

    if (legacyPatchResponse.ok) {
      revalidatePath("/doctor/appointments");
      revalidatePath("/patient/appointments");
      return legacyPatchResponse.json();
    }

    const legacyError = await legacyPatchResponse.json().catch(() => null);
    throw new Error(getErrorMessage(legacyError?.detail, "Failed to delete pending request"));
  }

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(getErrorMessage(error?.detail, "Failed to delete pending request"));
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/patient/appointments");
  return response.json();
}

// Sync appointment status (auto-complete past appointments)
export async function syncAppointmentStatus() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return { updated_count: 0 };
  }

  try {
    const response = await fetch(`${BACKEND_URL}/appointment/sync-status`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to sync appointment status");
      return { updated_count: 0 };
    }

    return response.json();
  } catch (error) {
    console.error("Error syncing appointment status:", error);
    return { updated_count: 0 };
  }
}

// Complete appointment (doctor only - after appointment time has passed)
export async function completeAppointment(appointmentId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/complete`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to complete appointment");
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/doctor/home");
  return response.json();
}

export async function getDoctorRevenueSummary() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return {
      total_revenue: 0,
      monthly_revenue: 0,
      completed_appointments: 0,
      completed_this_month: 0,
      consultation_fee: null,
    } satisfies DoctorRevenueSummary;
  }

  const response = await fetch(`${BACKEND_URL}/appointment/doctor/revenue-summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return {
        total_revenue: 0,
        monthly_revenue: 0,
        completed_appointments: 0,
        completed_this_month: 0,
        consultation_fee: null,
      } satisfies DoctorRevenueSummary;
    }
    const error = await response.json().catch(() => null);
    throw new Error(getErrorMessage(error?.detail, "Failed to fetch doctor revenue summary"));
  }

  return (await response.json()) as DoctorRevenueSummary;
}

export async function respondToRescheduleRequest(
  rescheduleRequestId: string,
  accepted: boolean,
  responseNote?: string,
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/reschedule-requests/${rescheduleRequestId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ accept: accepted, response_note: responseNote }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to respond to reschedule request");
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/appointments");
  return response.json();
}

export async function requestRescheduleAppointment(
  appointmentId: string,
  newAppointmentDate: string,
  reason?: string,
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");
  const payload = toReschedulePayload(newAppointmentDate);

  const response = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/reschedule-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...payload,
      reason,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to request reschedule");
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/patient/appointments");
  return response.json();
}


// === THREE-STEP CONFIRMATION FLOW ===
// admin approves -> PENDING_DOCTOR_CONFIRMATION
// doctor confirms -> PENDING_PATIENT_CONFIRMATION
// patient confirms -> CONFIRMED

export async function doctorConfirmAppointment(appointmentId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${BACKEND_URL}/appointment/${appointmentId}/doctor-confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(getErrorMessage(error, "Failed to confirm appointment"));
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/patient/appointments");
  return response.json();
}

export async function patientConfirmAppointment(appointmentId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${BACKEND_URL}/appointment/${appointmentId}/patient-confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(getErrorMessage(error, "Failed to confirm appointment"));
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/appointments");
  return response.json();
}
