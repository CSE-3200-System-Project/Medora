/**
 * Client-side medical report upload.
 * Uses FormData (not JSON) so this runs in the browser, not as a server action.
 */

import type { MedicalReportUploadResponse } from "./medical-report-actions";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

function readSessionToken(): string | null {
  if (typeof document === "undefined") return null;
  const tokenCookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("session_token="));
  return tokenCookie
    ? decodeURIComponent(tokenCookie.split("=")[1] || "")
    : null;
}

function getAuthHeaders(): Record<string, string> {
  const token = readSessionToken();
  if (!token) {
    throw new Error("Authentication required. Please log in again.");
  }
  return { Authorization: `Bearer ${token}` };
}

export async function uploadMedicalReport(
  file: File,
  options?: { reportDate?: string }
): Promise<MedicalReportUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.reportDate) {
    formData.append("report_date", options.reportDate);
  }

  const response = await fetch(`${BACKEND_URL}/medical-reports/upload`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.detail || "Failed to upload medical report.");
  }

  return data as MedicalReportUploadResponse;
}
