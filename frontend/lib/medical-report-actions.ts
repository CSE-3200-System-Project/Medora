"use server";

import { cookies } from "next/headers";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function getAuthHeadersNoContentType() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json.detail || json.message || `Error ${response.status}`;
    } catch {
      return text || `Error ${response.status}: ${response.statusText}`;
    }
  } catch {
    return `Error ${response.status}: ${response.statusText}`;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportTestResult {
  id: string;
  report_id: string;
  test_id: number | null;
  test_name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  status: string | null; // "normal" | "high" | "low"
  reference_range_min: number | null;
  reference_range_max: number | null;
  reference_range_text: string | null;
  confidence: number | null;
  created_at: string;
}

export interface DoctorComment {
  id: string;
  report_id: string;
  doctor_id: string;
  doctor_name: string | null;
  comment: string;
  created_at: string;
  updated_at: string | null;
}

export interface MedicalReport {
  id: string;
  patient_id: string;
  uploaded_by: string;
  file_url: string | null;
  file_name: string | null;
  report_date: string | null;
  parsed: boolean;
  ocr_engine: string | null;
  processing_time_ms: number | null;
  created_at: string;
  updated_at: string | null;
  results: ReportTestResult[];
  comments: DoctorComment[];
}

export interface MedicalReportListItem {
  id: string;
  patient_id: string;
  file_url: string | null;
  file_name: string | null;
  report_date: string | null;
  parsed: boolean;
  created_at: string;
  result_count: number;
  comment_count: number;
  summary: string | null;
}

export interface MedicalReportUploadResponse {
  report: MedicalReport;
  file_url: string | null;
}

// ─── Server Actions ──────────────────────────────────────────────────────────

export async function listMedicalReports(
  patientId?: string,
  limit = 20,
  offset = 0
): Promise<MedicalReportListItem[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (patientId) {
    params.set("patient_id", patientId);
  }

  const response = await fetch(
    `${BACKEND_URL}/medical-reports?${params.toString()}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch medical reports");
  }

  return await response.json();
}

export async function getMedicalReport(
  reportId: string
): Promise<MedicalReport> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${BACKEND_URL}/medical-reports/${reportId}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch report details");
  }

  return await response.json();
}

export async function addReportComment(
  reportId: string,
  comment: string
): Promise<DoctorComment> {
  const headers = await getAuthHeaders();

  const response = await fetch(
    `${BACKEND_URL}/medical-reports/${reportId}/comment`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ comment }),
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to add comment");
  }

  return await response.json();
}
