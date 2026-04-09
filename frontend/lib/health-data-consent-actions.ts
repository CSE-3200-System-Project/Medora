"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

async function getAuthHeaders() {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) {
    throw new Error("Authentication required");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export type HealthDataConsent = {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string | null;
  is_active: boolean;
  granted_at: string;
  revoked_at: string | null;
};

export type PatientHealthOverview = {
  patient_id: string;
  patient_name: string;
  today_metrics: Array<{
    metric_type: string;
    value: number;
    unit: string;
    recorded_at: string;
  }>;
  trends: Array<{
    metric_type: string;
    unit: string;
    points: Array<{
      date: string;
      average_value: number;
      min_value: number;
      max_value: number;
      entries: number;
    }>;
  }>;
  consent_granted_at: string;
};

/** Patient: grant a doctor access to health metrics */
export async function grantHealthDataConsent(doctorId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-data/consents`, {
    method: "POST",
    headers,
    body: JSON.stringify({ doctor_id: doctorId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to grant consent" }));
    throw new Error(error.detail || "Failed to grant consent");
  }

  return (await response.json()) as HealthDataConsent;
}

/** Patient: revoke a doctor's access */
export async function revokeHealthDataConsent(consentId: string) {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-data/consents/${consentId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to revoke consent" }));
    throw new Error(error.detail || "Failed to revoke consent");
  }

  return (await response.json()) as { message: string };
}

/** Patient: list all consents */
export async function listMyConsents() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-data/consents`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to list consents" }));
    throw new Error(error.detail || "Failed to list consents");
  }

  return (await response.json()) as { consents: HealthDataConsent[]; total: number };
}

/** Doctor: view a patient's health data (requires active consent) */
export async function getPatientHealthForDoctor(patientId: string, days: number = 7) {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/health-data/doctor/patient/${patientId}/health?days=${days}`,
    { method: "GET", headers, cache: "no-store" },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to fetch patient health data" }));
    const detail = String(error.detail || "Failed to fetch patient health data");
    const lowered = detail.toLowerCase();
    const consentMissing =
      response.status === 403 &&
      (lowered.includes("not granted") || lowered.includes("no active consent"));

    if (consentMissing) {
      return null;
    }

    throw new Error(detail);
  }

  return (await response.json()) as PatientHealthOverview;
}

/** Doctor: list patients who have granted consent */
export async function listPatientsWithConsent() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/health-data/doctor/patients-with-consent`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to list patients with consent" }));
    throw new Error(error.detail || "Failed to list patients with consent");
  }

  return (await response.json()) as {
    patients: Array<{ patient_id: string; patient_name: string; consent_granted_at: string }>;
    total: number;
  };
}
