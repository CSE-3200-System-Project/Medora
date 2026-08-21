"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function clearAdminAccess() {
  const cookieStore = await cookies();
  cookieStore.delete("session_token");
  cookieStore.delete("user_role");
  cookieStore.delete("onboarding_completed");
  cookieStore.delete("verification_status");
  cookieStore.delete("remember_me");
  cookieStore.delete("admin_access");
}

async function getAdminHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  const role = cookieStore.get("user_role")?.value?.toLowerCase();
  if (!token || role !== "admin") {
    throw new Error("Admin session is missing or expired");
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

// Admin Notifications (backed by persisted Notification rows with target_role="admin")
export type AdminNotificationRow = {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  action_url: string | null;
  data: Record<string, unknown> | null;
  is_read: boolean;
  is_archived: boolean;
  created_at: string | null;
  read_at: string | null;
};

export async function getAdminNotifications(params?: { limit?: number; unreadOnly?: boolean }) {
  const headers = await getAdminHeaders();
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.unreadOnly) search.set("unread_only", "true");
  const qs = search.toString();
  const response = await fetch(
    `${BACKEND_URL}/admin/notifications${qs ? `?${qs}` : ""}`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch admin notifications: ${response.status}`);
  }
  return (await response.json()) as {
    notifications: AdminNotificationRow[];
    unread_count: number;
  };
}

export type AdminReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AdminReviewRow = {
  review: {
    id: string;
    doctor_id: string;
    rating: number;
    note?: string | null;
    status: AdminReviewStatus;
    admin_feedback?: string | null;
    created_at: string;
    updated_at: string;
    author?: {
      patient_id: string;
      first_name?: string | null;
      last_name?: string | null;
      profile_photo_url?: string | null;
    } | null;
  };
  doctor_name: string;
  patient_name: string;
  patient_email?: string | null;
};

export async function getAdminReviews(status: AdminReviewStatus = "PENDING", page = 1, limit = 20) {
  const headers = await getAdminHeaders();
  // Send both page alias AND canonical offset for new backend
  const offset = (page - 1) * limit;
  const response = await fetch(
    `${BACKEND_URL}/admin/reviews?status=${status}&limit=${limit}&offset=${offset}&page=${page}`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || "Failed to fetch reviews");
  }
  const data = await response.json();
  return {
    ...data,
    reviews: data.reviews ?? data.items ?? [],
    items: data.items ?? data.reviews ?? [],
  } as {
    reviews: AdminReviewRow[];
    items: AdminReviewRow[];
    total: number;
    page: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export async function approveAdminReview(reviewId: string) {
  const headers = await getAdminHeaders();
  const response = await fetch(`${BACKEND_URL}/admin/reviews/${reviewId}/approve`, {
    method: "POST",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || "Failed to approve review");
  }
  return response.json();
}

export async function rejectAdminReview(reviewId: string, adminFeedback?: string) {
  const headers = await getAdminHeaders();
  const response = await fetch(`${BACKEND_URL}/admin/reviews/${reviewId}/reject`, {
    method: "POST",
    headers,
    body: JSON.stringify({ admin_feedback: adminFeedback || undefined }),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { detail?: string }).detail || "Failed to reject review");
  }
  return response.json();
}

export async function adminApproveNewAppointment(appointmentId: string, notes?: string) {
  const headers = await getAdminHeaders();
  const response = await fetch(
    `${BACKEND_URL}/admin/appointments/${appointmentId}/approve`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ notes: notes || null }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      (error as { detail?: string }).detail || `Failed to approve appointment: ${response.status}`,
    );
  }
  return response.json();
}

export async function markAdminNotificationsRead(ids: string[] | "all") {
  const headers = await getAdminHeaders();
  const body = ids === "all"
    ? { mark_all: true }
    : { notification_ids: ids };
  const response = await fetch(`${BACKEND_URL}/admin/notifications/mark-read`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to mark notifications read: ${response.status}`);
  }
  return (await response.json()) as { updated: number };
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
    items: [],
    data: [],
    patients: [],
    total: 0,
    limit,
    offset,
    has_more: false,
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
    const patients = Array.isArray(payload?.patients)
      ? payload.patients
      : Array.isArray(payload?.items)
      ? payload.items
      : [];
    return {
      ...fallback,
      ...payload,
      patients,
      items: patients,
      data: patients,
      total: typeof payload?.total === "number" ? payload.total : 0,
      has_more: payload?.has_more ?? false,
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

// Privileged administrator action evidence
export type GovernanceAuditLog = {
  id: string;
  actorProfileId: string;
  approvedByProfileId: string | null;
  permission: string;
  action: string;
  targetType: string;
  targetId: string;
  status: string;
  reason: string;
  autonomyTier: string | null;
  createdAt: string;
};

export async function getGovernanceAudit(
  action?: string,
  status?: string,
  limit = 50,
  offset = 0
) {
  const headers = await getAdminHeaders();
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (action) params.set("action", action);
  if (status) params.set("status", status);

  const response = await fetch(
    `${BACKEND_URL}/admin/governance/audit?${params.toString()}`,
    { headers, cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch governance audit");
  }
  const payload = await response.json();
  return {
    ...payload,
    items: (payload.items || []).map(
      (row: Record<string, string | null>): GovernanceAuditLog => ({
        id: String(row.id),
        actorProfileId: String(row.actor_profile_id),
        approvedByProfileId: row.approved_by_profile_id,
        permission: String(row.permission),
        action: String(row.action),
        targetType: String(row.target_type),
        targetId: String(row.target_id),
        status: String(row.status),
        reason: String(row.reason),
        autonomyTier: row.autonomy_tier,
        createdAt: String(row.created_at),
      })
    ),
  };
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

export type ScheduleReviewDoctor = {
  profile_id: string;
  name: string;
  email: string;
  time_slots?: string;
  normalized_time_slots?: string;
};

export async function getAdminScheduleReview(): Promise<ScheduleReviewDoctor[]> {
  const headers = await getAdminHeaders();
  const response = await fetch(`${BACKEND_URL}/admin/schedule-review`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch schedule review: ${response.status}`);
  }
  const data = (await response.json()) as { doctors?: ScheduleReviewDoctor[] };
  return data.doctors ?? [];
}

export async function applyAdminScheduleFix(
  doctor: Pick<ScheduleReviewDoctor, "profile_id" | "normalized_time_slots">,
) {
  const headers = await getAdminHeaders();
  const response = await fetch(`${BACKEND_URL}/admin/schedule-review/fix`, {
    method: "POST",
    headers,
    body: JSON.stringify(doctor),
    cache: "no-store",
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `Failed to apply schedule fix: ${response.status}`);
  }
  return response.json();
}
