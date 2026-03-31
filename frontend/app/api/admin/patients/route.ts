import { NextRequest, NextResponse } from "next/server";

import { callAdminBackend, respondFromBackend } from "./_shared";

type StatusFilter = "all" | "active" | "incomplete" | "banned";

const MAX_FETCH_LIMIT = 2000;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function matchesStatus(patient: Record<string, unknown>, status: StatusFilter): boolean {
  if (status === "all") {
    return true;
  }

  const accountStatus = String(patient.account_status || "").toLowerCase();
  const onboardingCompleted = Boolean(patient.onboarding_completed);

  if (status === "active") {
    return accountStatus === "active" && onboardingCompleted;
  }

  if (status === "incomplete") {
    return accountStatus !== "banned" && !onboardingCompleted;
  }

  return accountStatus === "banned";
}

function matchesSearch(patient: Record<string, unknown>, search: string): boolean {
  if (!search) {
    return true;
  }

  const haystack = [patient.name, patient.email, patient.phone]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");

  return haystack.includes(search);
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (value === "active" || value === "incomplete" || value === "banned") {
    return value;
  }

  return "all";
}

export async function GET(request: NextRequest) {
  try {
    const page = parsePositiveInt(request.nextUrl.searchParams.get("page"), 1);
    const pageSize = parsePositiveInt(request.nextUrl.searchParams.get("pageSize"), 12);
    const search = String(request.nextUrl.searchParams.get("search") || "").trim().toLowerCase();
    const status = parseStatusFilter(request.nextUrl.searchParams.get("status"));

    const { response, data } = await callAdminBackend(`/admin/patients?limit=${MAX_FETCH_LIMIT}&offset=0`);
    if (!response.ok) {
      return respondFromBackend(response, data, { patients: [], total: 0, page, pageSize });
    }

    const payload = (data || {}) as { patients?: unknown[] };
    const allPatients = Array.isArray(payload.patients)
      ? payload.patients.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      : [];

    const filteredPatients = allPatients.filter(
      (patient) => matchesStatus(patient, status) && matchesSearch(patient, search),
    );

    const startIndex = (page - 1) * pageSize;
    const pagedPatients = filteredPatients.slice(startIndex, startIndex + pageSize);

    return NextResponse.json({
      patients: pagedPatients,
      total: filteredPatients.length,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Admin patients list proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const { response, data } = await callAdminBackend("/admin/patients", {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });

    return respondFromBackend(response, data);
  } catch (error) {
    console.error("Admin patient create proxy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
