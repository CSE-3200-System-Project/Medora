"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

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

export async function getMyAppointments() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return [];
  }

  const response = await fetch(`${BACKEND_URL}/appointment/my-appointments`, {
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
  
   if (!response.ok) throw new Error("Update failed");

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

// Get patient calendar appointments
export async function getPatientCalendarAppointments() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return { appointments: [], by_date: [], total: 0 };
  }

  const response = await fetch(`${BACKEND_URL}/appointment/patient/calendar`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      return { appointments: [], by_date: [], total: 0 };
    }
    throw new Error("Failed to fetch calendar appointments");
  }

  return response.json();
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

// Reschedule an appointment
export async function rescheduleAppointment(id: string, newDate: string, newSlot: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      appointment_date: new Date(newDate).toISOString(),
      notes: `Rescheduled to: ${newSlot}`,
    }),
  });

  if (!response.ok) throw new Error("Reschedule failed");

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
  return response.json();
}

// Respond to reschedule request (patient only)
export async function respondToRescheduleRequest(appointmentId: string, accepted: boolean) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/reschedule-response`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ accepted }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to respond to reschedule request");
  }

  revalidatePath("/patient/appointments");
  revalidatePath("/doctor/appointments");
  return response.json();
}

// Request reschedule (doctor only)
export async function requestRescheduleAppointment(appointmentId: string, newAppointmentDate: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}/appointment/${appointmentId}/request-reschedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ new_appointment_date: newAppointmentDate }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to request reschedule");
  }

  revalidatePath("/doctor/appointments");
  revalidatePath("/patient/appointments");
  return response.json();
}
