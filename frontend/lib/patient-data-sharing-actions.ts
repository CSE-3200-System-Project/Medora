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

export interface SharingCategories {
  can_view_profile: boolean;
  can_view_conditions: boolean;
  can_view_medications: boolean;
  can_view_allergies: boolean;
  can_view_medical_history: boolean;
  can_view_family_history: boolean;
  can_view_lifestyle: boolean;
  can_view_vaccinations: boolean;
  can_view_reports: boolean;
  can_view_health_metrics: boolean;
  can_view_prescriptions: boolean;
}

export interface DoctorSharingSummary {
  doctor_id: string;
  doctor_name: string;
  doctor_photo_url: string | null;
  specialization: string | null;
  sharing: SharingCategories;
  created_at: string | null;
  updated_at: string | null;
}

export interface PatientDoctorListItem {
  doctor_id: string;
  doctor_name: string;
  doctor_photo_url: string | null;
  specialization: string | null;
  has_sharing_record: boolean;
}

export const CATEGORY_LABELS: Record<keyof SharingCategories, string> = {
  can_view_profile: "Profile & Identity",
  can_view_conditions: "Medical Conditions",
  can_view_medications: "Medications",
  can_view_allergies: "Allergies",
  can_view_medical_history: "Medical History",
  can_view_family_history: "Family History",
  can_view_lifestyle: "Lifestyle & Habits",
  can_view_vaccinations: "Vaccinations",
  can_view_reports: "Lab Reports",
  can_view_health_metrics: "Health Metrics",
  can_view_prescriptions: "Prescriptions",
};

export const CATEGORY_DESCRIPTIONS: Record<keyof SharingCategories, string> = {
  can_view_profile: "Name, age, gender, blood group, photo",
  can_view_conditions: "Chronic conditions, current diagnoses",
  can_view_medications: "Current medications, dosages",
  can_view_allergies: "Drug, food, and environmental allergies",
  can_view_medical_history: "Surgeries, hospitalizations, past treatments",
  can_view_family_history: "Family medical history",
  can_view_lifestyle: "Smoking, alcohol, diet, exercise, sleep, mental health",
  can_view_vaccinations: "Vaccination records",
  can_view_reports: "Uploaded lab test reports",
  can_view_health_metrics: "Vitals and health metrics tracked over time",
  can_view_prescriptions: "Consultation prescriptions",
};

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
