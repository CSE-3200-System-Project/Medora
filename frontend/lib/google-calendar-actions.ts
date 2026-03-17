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
}> {
  const headers = await authHeaders();
  const response = await fetch(`${BACKEND_URL}/oauth/google/status`, {
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    return { connected: false, provider: "google" };
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
