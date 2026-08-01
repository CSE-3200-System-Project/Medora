import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");

export const DEFAULT_PATIENT_BAN_REASON = "Moderation action by admin";
export const DEFAULT_PATIENT_DELETE_REASON = "Removed by admin";

export async function callAdminBackend(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  const role = cookieStore.get("user_role")?.value?.toLowerCase();
  if (!token || role !== "admin") {
    const response = new Response(
      JSON.stringify({ detail: "Admin session is missing or expired" }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
    return { response, data: { detail: "Admin session is missing or expired" } };
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  return { response, data };
}

export function respondFromBackend(response: Response, data: unknown, fallback: unknown = { status: "ok" }) {
  if (!response.ok) {
    return NextResponse.json(data || { error: "Request failed" }, { status: response.status });
  }

  return NextResponse.json(data || fallback);
}
