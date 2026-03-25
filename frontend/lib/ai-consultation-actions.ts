"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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

export interface PatientSummaryResponse {
  ai_generated: boolean;
  interaction_id: string | null;
  summary: Record<string, unknown> | null;
  raw_data: {
    patient_id: string;
    gender?: string | null;
    conditions: string[];
    medications: string[];
    allergies: string[];
    risk_flags: string[];
    history?: Record<string, unknown>;
  };
}

export interface ClinicalInfoResponse {
  ai_generated: boolean;
  interaction_ids: string[];
  answer: string;
  suggested_conditions: Array<{ name: string; confidence: number }>;
  suggested_tests: Array<{ name: string; confidence: number }>;
  suggested_medications: Array<{ name: string; confidence: number }>;
  cautions: string[];
}

export interface VoiceToNotesResponse {
  interaction_id: string | null;
  soap_notes: Record<string, unknown>;
  formatted_notes: string;
}

export interface SafetyCheckResponse {
  status: "safe" | "warning" | "blocked";
  issues: string[];
  override_required: boolean;
}

export interface DoctorPatientAssistantSummaryResponse {
  ai_generated: boolean;
  summary: Record<string, unknown>;
  highlight_points: string[];
  cautions: string[];
  assistant_boundary: string;
  privacy_mode: string;
}

export interface PatientPrescriptionAssistantSummaryResponse {
  ai_generated: boolean;
  summary: Record<string, unknown>;
  highlight_points: string[];
  cautions: string[];
  assistant_boundary: string;
  privacy_mode: string;
}

export async function getAIPatientSummary(patientId: string): Promise<PatientSummaryResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/ai/patient-summary?patient_id=${encodeURIComponent(patientId)}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch AI patient summary");
  }

  return await response.json();
}

export async function getDoctorPatientAssistantSummary(
  patientId: string
): Promise<DoctorPatientAssistantSummaryResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/ai/doctor-patient-summary?patient_id=${encodeURIComponent(patientId)}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch doctor assistant summary");
  }

  return await response.json();
}

export async function getPatientPrescriptionAssistantSummary(
  prescriptionId: string
): Promise<PatientPrescriptionAssistantSummaryResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${BACKEND_URL}/ai/patient-prescription-summary?prescription_id=${encodeURIComponent(prescriptionId)}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch prescription assistant summary");
  }

  return await response.json();
}

export async function getAIClinicalInfo(payload: {
  patient_id: string;
  query: string;
  notes?: string;
  prompt_version?: string;
}): Promise<ClinicalInfoResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/ai/clinical-info`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch AI clinical info");
  }

  return await response.json();
}

export async function voiceToNotes(payload: {
  patient_id: string;
  transcript: string;
  prompt_version?: string;
}): Promise<VoiceToNotesResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/ai/voice-to-notes`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to convert voice transcript to notes");
  }

  return await response.json();
}

export async function runConsultationSafetyCheck(
  consultationId: string,
  payload: {
    notes: string;
    planned_medications?: string[];
    allergies?: string[];
    override_reason?: string;
  }
): Promise<SafetyCheckResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/safety-check`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to run safety check");
  }

  return await response.json();
}

