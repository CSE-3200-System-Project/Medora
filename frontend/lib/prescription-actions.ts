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

/**
 * Safely parse error response - handles both JSON and plain text errors
 */
async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json.detail || json.message || `Error ${response.status}`;
    } catch {
      // Not JSON, return as-is or generic error
      return text || `Error ${response.status}: ${response.statusText}`;
    }
  } catch {
    return `Error ${response.status}: ${response.statusText}`;
  }
}

// ========== TYPES ==========

export type ConsultationStatus = "open" | "completed";
export type PrescriptionType = "medication" | "test" | "surgery";
export type PrescriptionStatus = "pending" | "accepted" | "rejected";
export type MedicineType = "tablet" | "capsule" | "syrup" | "injection" | "cream" | "ointment" | "drops" | "inhaler" | "powder" | "gel" | "suppository" | "other";
export type TestUrgency = "normal" | "urgent";
export type SurgeryUrgency = "immediate" | "scheduled";
export type MealInstruction = "before_meal" | "after_meal" | "with_meal" | "empty_stomach" | "any_time";
export type DurationUnit = "days" | "weeks" | "months";

export interface MedicationPrescription {
  id: string;
  prescription_id: string;
  medicine_name: string;
  generic_name?: string;
  medicine_type: MedicineType;
  strength?: string;
  dose_morning: boolean;
  dose_afternoon: boolean;
  dose_evening: boolean;
  dose_night: boolean;
  dose_morning_amount?: string;
  dose_afternoon_amount?: string;
  dose_evening_amount?: string;
  dose_night_amount?: string;
  frequency_per_day?: number;
  duration_value?: number;
  duration_unit: DurationUnit;
  meal_instruction: MealInstruction;
  special_instructions?: string;
  start_date?: string;
  end_date?: string;
  quantity?: number;
  refills: number;
  created_at: string;
}

export interface TestPrescription {
  id: string;
  prescription_id: string;
  test_name: string;
  test_type?: string;
  instructions?: string;
  urgency: TestUrgency;
  preferred_lab?: string;
  expected_date?: string;
  created_at: string;
}

export interface SurgeryRecommendation {
  id: string;
  prescription_id: string;
  procedure_name: string;
  procedure_type?: string;
  reason?: string;
  urgency: SurgeryUrgency;
  recommended_date?: string;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  pre_op_instructions?: string;
  notes?: string;
  preferred_facility?: string;
  created_at: string;
}

export interface Prescription {
  id: string;
  consultation_id: string;
  doctor_id: string;
  patient_id: string;
  type: PrescriptionType;
  status: PrescriptionStatus;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  accepted_at?: string;
  rejected_at?: string;
  added_to_history: boolean;
  doctor_name?: string;
  doctor_photo?: string;
  doctor_specialization?: string;
  medications: MedicationPrescription[];
  tests: TestPrescription[];
  surgeries: SurgeryRecommendation[];
}

export interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_ref?: string;
  appointment_id?: string;
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
  status: ConsultationStatus;
  consultation_date: string;
  completed_at?: string;
  created_at: string;
  doctor_name?: string;
  doctor_photo?: string;
  doctor_specialization?: string;
  patient_name?: string;
  patient_photo?: string;
  prescriptions?: Prescription[];
}

export interface ConsultationListResponse {
  consultations: Consultation[];
  total: number;
}

export interface PrescriptionListResponse {
  prescriptions: Prescription[];
  total: number;
}

// ========== CONSULTATION ACTIONS (DOCTOR) ==========

/**
 * Start a new consultation with a patient
 */
export async function startConsultation(data: {
  patient_id: string;
  appointment_id?: string;
  chief_complaint?: string;
  notes?: string;
}): Promise<Consultation> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to start consultation");
  }

  return await response.json();
}

/**
 * Get doctor's active consultations
 */
export async function getDoctorActiveConsultations(): Promise<ConsultationListResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/doctor/active`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch active consultations");
  }

  return await response.json();
}

/**
 * Get doctor's consultation history
 */
export async function getDoctorConsultationHistory(
  limit: number = 20,
  offset: number = 0
): Promise<ConsultationListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${BACKEND_URL}/consultation/doctor/history?${params}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch consultation history");
  }

  return await response.json();
}

/**
 * Get a specific consultation with prescriptions
 */
export async function getConsultation(consultationId: string): Promise<Consultation> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch consultation");
  }

  return await response.json();
}

/**
 * Update consultation notes/diagnosis
 */
export async function updateConsultation(
  consultationId: string,
  data: {
    chief_complaint?: string;
    diagnosis?: string;
    notes?: string;
  }
): Promise<Consultation> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to update consultation");
  }

  return await response.json();
}

/**
 * Complete a consultation
 */
export async function completeConsultation(consultationId: string): Promise<Consultation> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/complete`, {
    method: "PATCH",
    headers,
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to complete consultation");
  }

  return await response.json();
}

// ========== PRESCRIPTION ACTIONS (DOCTOR) ==========

export interface MedicationPrescriptionInput {
  medicine_name: string;
  generic_name?: string;
  medicine_type?: MedicineType;
  strength?: string;
  dose_morning?: boolean;
  dose_afternoon?: boolean;
  dose_evening?: boolean;
  dose_night?: boolean;
  dose_morning_amount?: string;
  dose_afternoon_amount?: string;
  dose_evening_amount?: string;
  dose_night_amount?: string;
  frequency_per_day?: number;
  duration_value?: number;
  duration_unit?: DurationUnit;
  meal_instruction?: MealInstruction;
  special_instructions?: string;
  start_date?: string;
  end_date?: string;
  quantity?: number;
  refills?: number;
}

export interface TestPrescriptionInput {
  test_name: string;
  test_type?: string;
  instructions?: string;
  urgency?: TestUrgency;
  preferred_lab?: string;
  expected_date?: string;
}

export interface SurgeryRecommendationInput {
  procedure_name: string;
  procedure_type?: string;
  reason?: string;
  urgency?: SurgeryUrgency;
  recommended_date?: string;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  pre_op_instructions?: string;
  notes?: string;
  preferred_facility?: string;
}

/**
 * Add a prescription to a consultation
 */
export async function addPrescription(
  consultationId: string,
  data: {
    type: PrescriptionType;
    notes?: string;
    medications?: MedicationPrescriptionInput[];
    tests?: TestPrescriptionInput[];
    surgeries?: SurgeryRecommendationInput[];
  }
): Promise<Prescription> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/prescription`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to add prescription");
  }

  return await response.json();
}

/**
 * Get all prescriptions for a consultation
 */
export async function getConsultationPrescriptions(consultationId: string): Promise<PrescriptionListResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/prescriptions`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch prescriptions");
  }

  return await response.json();
}

/**
 * Delete a prescription (only if pending)
 */
export async function deletePrescription(prescriptionId: string): Promise<{ message: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/prescription/${prescriptionId}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to delete prescription");
  }

  return await response.json();
}

// ========== PATIENT PRESCRIPTION ACTIONS ==========

/**
 * Get all prescriptions for the current patient
 */
export async function getPatientPrescriptions(
  statusFilter?: PrescriptionStatus,
  limit: number = 20,
  offset: number = 0
): Promise<PrescriptionListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  if (statusFilter) {
    params.append("status_filter", statusFilter);
  }

  const response = await fetch(`${BACKEND_URL}/consultation/patient/prescriptions?${params}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch prescriptions");
  }

  return await response.json();
}

/**
 * Get a specific prescription for the current patient
 */
export async function getPatientPrescription(prescriptionId: string): Promise<Prescription> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/patient/prescription/${prescriptionId}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch prescription");
  }

  return await response.json();
}

/**
 * Accept a prescription
 */
export async function acceptPrescription(prescriptionId: string): Promise<{ message: string; status: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/patient/prescription/${prescriptionId}/accept`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to accept prescription");
  }

  return await response.json();
}

/**
 * Reject a prescription
 */
export async function rejectPrescription(
  prescriptionId: string,
  reason?: string
): Promise<{ message: string; status: string }> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/patient/prescription/${prescriptionId}/reject`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to reject prescription");
  }

  return await response.json();
}

// ========== MEDICAL HISTORY INTEGRATION ==========

/**
 * Get accepted prescriptions for medical history
 */
export async function getMedicalHistoryPrescriptions(
  prescriptionType?: PrescriptionType,
  limit: number = 100,
  offset: number = 0
): Promise<PrescriptionListResponse> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  
  if (prescriptionType) {
    params.append("prescription_type", prescriptionType);
  }

  const response = await fetch(`${BACKEND_URL}/consultation/patient/medical-history/prescriptions?${params}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch medical history prescriptions");
  }

  return await response.json();
}

// ========== CONSULTATION AI ACTIONS ==========

export interface AIInteractionResult {
  interaction_id: string;
  feature: string;
  output: Record<string, unknown>;
  validation_status: string;
  provider: string;
  latency_ms?: number;
}

export async function generateAIPatientSummary(
  consultationId: string,
  data: Record<string, unknown>,
  promptVersion: string = "v1"
): Promise<AIInteractionResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/ai/patient-summary`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data, prompt_version: promptVersion }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to generate patient summary");
  }

  return await response.json();
}

export async function structureAIIntake(
  consultationId: string,
  data: Record<string, unknown>,
  promptVersion: string = "v1"
): Promise<AIInteractionResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/ai/intake-structure`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data, prompt_version: promptVersion }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to structure intake");
  }

  return await response.json();
}

export async function generateAISoapNotes(
  consultationId: string,
  transcript: string,
  promptVersion: string = "v1"
): Promise<AIInteractionResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/ai/soap-notes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ transcript, prompt_version: promptVersion }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to generate SOAP notes");
  }

  return await response.json();
}

export async function askAIClinicalQuery(
  consultationId: string,
  query: string,
  promptVersion: string = "v1"
): Promise<AIInteractionResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/ai/clinical-query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, prompt_version: promptVersion }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to get clinical info");
  }

  return await response.json();
}

export async function generateAIPrescriptionSuggestions(
  consultationId: string,
  data: Record<string, unknown>,
  promptVersion: string = "v1"
): Promise<AIInteractionResult> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/ai/prescription-suggestions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ data, prompt_version: promptVersion }),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to generate prescription suggestions");
  }

  return await response.json();
}

export async function submitAIInteractionFeedback(
  consultationId: string,
  payload: {
    ai_interaction_id: string;
    rating: number;
    correction_text?: string;
    doctor_action?: string;
  }
): Promise<{ message: string; ai_interaction_id: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/ai/feedback`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to submit AI feedback");
  }

  return await response.json();
}
