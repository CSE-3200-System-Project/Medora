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
