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

export type NotificationType =
  | "appointment_booked"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_completed"
  | "appointment_reminder"
  | "new_patient"
  | "patient_checkin"
  | "doctor_available"
  | "access_requested"
  | "access_granted"
  | "access_revoked"
  | "verification_pending"
  | "verification_approved"
  | "verification_rejected"
  | "profile_update"
  | "onboarding_reminder"
  | "system_announcement"
  | "welcome";

export type NotificationPriority = "low" | "medium" | "high" | "urgent";

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  action_url?: string;
  metadata?: Record<string, any>;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  read_at?: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

/**
 * Get notifications for the current user
 */
export async function getNotifications(
  limit: number = 20,
  offset: number = 0,
  unreadOnly: boolean = false
): Promise<NotificationListResponse> {
  try {
    const headers = await getAuthHeaders();
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      unread_only: unreadOnly.toString(),
    });

    const response = await fetch(`${BACKEND_URL}/notifications/?${params}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch notifications");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return { notifications: [], total: 0, unread_count: 0 };
  }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/notifications/unread-count`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return 0;
    }

    const data: UnreadCountResponse = await response.json();
    return data.unread_count;
  } catch (error) {
    console.error("Error fetching unread count:", error);
    return 0;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/notifications/${notificationId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ is_read: true }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return false;
  }
}

/**
 * Mark multiple notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/notifications/mark-read`, {
      method: "POST",
      headers,
      body: JSON.stringify({ notification_ids: notificationIds }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return false;
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/notifications/mark-all-read`, {
      method: "POST",
      headers,
    });

    return response.ok;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return false;
  }
}

/**
 * Delete (archive) a notification
 */
export async function deleteNotification(notificationId: string): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/notifications/${notificationId}`, {
      method: "DELETE",
      headers,
    });

    return response.ok;
  } catch (error) {
    console.error("Error deleting notification:", error);
    return false;
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/notifications/`, {
      method: "DELETE",
      headers,
    });

    return response.ok;
  } catch (error) {
    console.error("Error clearing notifications:", error);
    return false;
  }
}
