"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const ADMIN_PASSWORD = "admin123";

// Admin Authentication
export async function setAdminAccess(password: string) {
  if (password === ADMIN_PASSWORD) {
    const cookieStore = await cookies();
    cookieStore.set("admin_access", "true", {
      path: "/",
      maxAge: 86400, // 24 hours
      sameSite: "lax",
    });
    cookieStore.set("user_role", "admin", {
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
    });
    return { success: true };
  }
  return { success: false, error: "Incorrect admin password" };
}

export async function clearAdminAccess() {
  const cookieStore = await cookies();
  cookieStore.delete("admin_access");
  cookieStore.delete("user_role");
}

async function getAdminHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Password": ADMIN_PASSWORD,
  };
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    throw new Error("Not authenticated");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// Dashboard Stats
export async function getAdminStats() {
  try {
    const headers = await getAdminHeaders();
    console.log("Fetching admin stats from:", `${BACKEND_URL}/admin/stats`);
    console.log("Headers:", headers);
    
    const response = await fetch(`${BACKEND_URL}/admin/stats`, {
      headers,
      cache: "no-store",
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response text:", responseText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = JSON.parse(responseText);
      } catch {
        errorData = { detail: `Server error: ${responseText.substring(0, 200)}` };
      }
      throw new Error(errorData.detail || `Failed to fetch stats: ${response.status}`);
    }

    return JSON.parse(responseText);
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    throw error;
  }
}

// Doctors Management
export async function getPendingDoctors() {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(`${BACKEND_URL}/admin/pending-doctors`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch pending doctors");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching pending doctors:", error);
    throw error;
  }
}

export async function getAllDoctors() {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(`${BACKEND_URL}/admin/doctors`, {
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch doctors");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching doctors:", error);
    throw error;
  }
}

export async function verifyDoctor(doctorId: string, approved: boolean, notes?: string) {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(`${BACKEND_URL}/admin/verify-doctor/${doctorId}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        approved,
        notes: notes || "",
        verification_method: "manual",
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to verify doctor");
    }

    return await response.json();
  } catch (error) {
    console.error("Error verifying doctor:", error);
    throw error;
  }
}

// Patients Management
export async function getAllPatients(limit = 50, offset = 0) {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(
      `${BACKEND_URL}/admin/patients?limit=${limit}&offset=${offset}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Patients fetch failed:", response.status, errorText);
      throw new Error(`Failed to fetch patients: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching patients:", error);
    throw error;
  }
}

// Appointments Management
export async function getAllAppointments(limit = 50, offset = 0) {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(
      `${BACKEND_URL}/admin/appointments?limit=${limit}&offset=${offset}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Appointments fetch failed:", response.status, errorText);
      throw new Error(`Failed to fetch appointments: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching appointments:", error);
    throw error;
  }
}
// Ban user
export async function banUser(userId: string, reason?: string) {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(
      `${BACKEND_URL}/admin/users/${userId}/ban`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ reason }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to ban user");
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to ban user:", error);
    throw error;
  }
}

// Unban user
export async function unbanUser(userId: string) {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(
      `${BACKEND_URL}/admin/users/${userId}/unban`,
      {
        method: "POST",
        headers,
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to unban user");
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to unban user:", error);
    throw error;
  }
}