"use server";

import { cookies } from "next/headers";
import type {
  SharingCategories,
  DoctorSharingSummary,
  PatientDoctorListItem,
} from "./patient-data-sharing-types";

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

// ─── Server Actions ──────────────────────────────────────────────────────────

export async function listPatientDoctors(): Promise<PatientDoctorListItem[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/patient-data-sharing/doctors`,
    { method: "GET", headers, cache: "no-store" }
  );
  if (!response.ok) {
    const msg = await parseErrorResponse(response);
    throw new Error(msg || "Failed to fetch doctors list");
  }
  return await response.json();
}

export async function listAllSharingPreferences(): Promise<
  DoctorSharingSummary[]
> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/patient-data-sharing`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    const msg = await parseErrorResponse(response);
    throw new Error(msg || "Failed to fetch sharing preferences");
  }
  return await response.json();
}

export async function getSharingForDoctor(
  doctorId: string
): Promise<DoctorSharingSummary> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/patient-data-sharing/doctors/${doctorId}`,
    { method: "GET", headers, cache: "no-store" }
  );
  if (!response.ok) {
    const msg = await parseErrorResponse(response);
    throw new Error(msg || "Failed to fetch sharing preferences for doctor");
  }
  return await response.json();
}

export async function updateSharingForDoctor(
  doctorId: string,
  updates: Partial<SharingCategories>
): Promise<SharingCategories> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/patient-data-sharing/doctors/${doctorId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(updates),
    }
  );
  if (!response.ok) {
    const msg = await parseErrorResponse(response);
    throw new Error(msg || "Failed to update sharing preferences");
  }
  return await response.json();
}

export async function bulkUpdateSharing(
  doctorId: string,
  shareAll: boolean
): Promise<SharingCategories> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/patient-data-sharing/doctors/${doctorId}/bulk`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({ share_all: shareAll }),
    }
  );
  if (!response.ok) {
    const msg = await parseErrorResponse(response);
    throw new Error(msg || "Failed to bulk update sharing");
  }
  return await response.json();
}

export async function deleteSharingForDoctor(
  doctorId: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/patient-data-sharing/doctors/${doctorId}`,
    { method: "DELETE", headers }
  );
  if (!response.ok) {
    const msg = await parseErrorResponse(response);
    throw new Error(msg || "Failed to revoke sharing");
  }
}
