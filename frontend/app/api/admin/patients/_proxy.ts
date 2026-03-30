import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function adminHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Admin-Password": ADMIN_PASSWORD,
  };
}

export async function proxyAdminJson(path: string, init?: RequestInit) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      ...adminHeaders(),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const body = text ? safeJson(text) : {};

  if (!response.ok) {
    return NextResponse.json(
      { detail: body?.detail || body?.error || "Request failed" },
      { status: response.status },
    );
  }

  return NextResponse.json(body, { status: response.status });
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
