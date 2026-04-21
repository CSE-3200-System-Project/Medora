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
    
    const response = await fetch(`${BACKEND_URL}/admin/stats`, {
      headers,
      cache: "no-store",
    });

    const responseText = await response.text();

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
  const fallback = {
    success: false,
    message: "Failed to fetch patients",
    data: [],
    patients: [],
    total: 0,
    limit,
    offset,
  };

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
      console.error("Patients fetch failed:", {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      return {
        ...fallback,
        message: `Failed to fetch patients: ${response.status}`,
      };
    }

    const payload = await response.json();
    return {
      ...fallback,
      ...payload,
      patients: Array.isArray(payload?.patients) ? payload.patients : [],
      total: typeof payload?.total === "number" ? payload.total : 0,
      success: payload?.success !== false,
      message: payload?.message || "Patients fetched successfully",
    };
  } catch (error) {
    console.error("Error fetching patients:", error);
    return fallback;
  }
}

// Appointments Management
export async function getAllAppointments(
  limit = 50,
  offset = 0,
  filters?: {
    status?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    sort?: "asc" | "desc";
  }
) {
  try {
    const headers = await getAdminHeaders();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (filters?.status && filters.status !== "all")
      params.set("status", filters.status);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.date_from) params.set("date_from", filters.date_from);
    if (filters?.date_to) params.set("date_to", filters.date_to);
    if (filters?.sort) params.set("sort", filters.sort);

    const response = await fetch(
      `${BACKEND_URL}/admin/appointments?${params.toString()}`,
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

// Appointment Summary Stats
export async function getAppointmentSummary() {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(
      `${BACKEND_URL}/admin/appointments/summary`,
      { headers, cache: "no-store" }
    );

    if (!response.ok) throw new Error("Failed to fetch appointment summary");
    return await response.json();
  } catch (error) {
    console.error("Error fetching appointment summary:", error);
    return null;
  }
}
// Audit Logs
export async function getAuditLogs(
  appointmentId?: string,
  limit = 50,
  offset = 0
) {
  try {
    const headers = await getAdminHeaders();
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (appointmentId) params.set("appointment_id", appointmentId);

    const response = await fetch(
      `${BACKEND_URL}/admin/audit-logs?${params.toString()}`,
      {
        headers,
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch audit logs");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    throw error;
  }
}

// Override Appointment Status (admin force)
export async function overrideAppointmentStatus(
  appointmentId: string,
  newStatus: string,
  notes?: string
) {
  try {
    const headers = await getAdminHeaders();
    const response = await fetch(
      `${BACKEND_URL}/admin/appointments/${appointmentId}/override-status`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          status: newStatus,
          notes: notes || undefined,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      const detail = error && typeof error === "object" ? (error as { detail?: unknown }).detail : null;

      let message = "Failed to override status";
      if (typeof detail === "string" && detail.trim()) {
        message = detail;
      } else if (Array.isArray(detail)) {
        const firstDetail = detail[0];
        if (
          firstDetail &&
          typeof firstDetail === "object" &&
          "msg" in firstDetail &&
          typeof (firstDetail as { msg?: unknown }).msg === "string"
        ) {
          message = String((firstDetail as { msg: string }).msg);
        }
      }

      throw new Error(message);
    }

    return await response.json();
  } catch (error) {
    console.error("Error overriding appointment status:", error);
    throw error;
  }
}

// ========== APPOINTMENT APPROVAL WORKFLOW ==========

export async function getPendingAppointments(limit = 50, offset = 0) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `${BACKEND_URL}/admin/appointments/pending-review?limit=${limit}&offset=${offset}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch pending appointments");
    return await res.json();
  } catch (e) {
    console.error("Error fetching pending appointments:", e);
    return { appointments: [], total: 0 };
  }
}

export async function adminApproveAppointment(appointmentId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${BACKEND_URL}/admin/appointments/${appointmentId}/approve`,
    { method: "POST", headers, body: JSON.stringify({ notes }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to approve appointment");
  }
  return await res.json();
}

export async function adminRejectAppointment(appointmentId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${BACKEND_URL}/admin/appointments/${appointmentId}/reject`,
    { method: "POST", headers, body: JSON.stringify({ notes }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reject appointment");
  }
  return await res.json();
}

export async function getPendingRescheduleRequests(limit = 50, offset = 0) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `${BACKEND_URL}/admin/reschedule-requests?limit=${limit}&offset=${offset}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch reschedule requests");
    return await res.json();
  } catch (e) {
    console.error("Error fetching reschedule requests:", e);
    return { requests: [], total: 0 };
  }
}

export async function adminApproveReschedule(requestId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${BACKEND_URL}/admin/reschedule-requests/${requestId}/approve`,
    { method: "POST", headers, body: JSON.stringify({ notes }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to approve reschedule");
  }
  return await res.json();
}

export async function adminRejectReschedule(requestId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${BACKEND_URL}/admin/reschedule-requests/${requestId}/reject`,
    { method: "POST", headers, body: JSON.stringify({ notes }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reject reschedule");
  }
  return await res.json();
}

export async function getPendingCancellationRequests(limit = 50, offset = 0) {
  try {
    const headers = await getAdminHeaders();
    const res = await fetch(
      `${BACKEND_URL}/admin/cancellation-requests?limit=${limit}&offset=${offset}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to fetch cancellation requests");
    return await res.json();
  } catch (e) {
    console.error("Error fetching cancellation requests:", e);
    return { requests: [], total: 0 };
  }
}

export async function adminApproveCancellation(requestId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${BACKEND_URL}/admin/cancellation-requests/${requestId}/approve`,
    { method: "POST", headers, body: JSON.stringify({ notes }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to approve cancellation");
  }
  return await res.json();
}

export async function adminRejectCancellation(requestId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const res = await fetch(
    `${BACKEND_URL}/admin/cancellation-requests/${requestId}/reject`,
    { method: "POST", headers, body: JSON.stringify({ notes }) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to reject cancellation");
  }
  return await res.json();
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
