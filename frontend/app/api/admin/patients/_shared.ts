import { NextResponse } from "next/server";

const BACKEND_URL = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/$/, "");
const ADMIN_PASSWORD = "admin123";

export const DEFAULT_PATIENT_BAN_REASON = "Moderation action by admin";
export const DEFAULT_PATIENT_DELETE_REASON = "Removed by admin";

export async function callAdminBackend(path: string, init?: RequestInit) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": ADMIN_PASSWORD,
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
