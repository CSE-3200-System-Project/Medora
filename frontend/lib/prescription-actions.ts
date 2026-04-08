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
      if (typeof json?.detail === "string" && json.detail.trim().length > 0) {
        return json.detail;
      }

      if (json?.detail && typeof json.detail === "object") {
        const detail = json.detail as { message?: unknown; errors?: unknown };

        if (typeof detail.message === "string" && detail.message.trim().length > 0) {
          return detail.message;
        }

        if (Array.isArray(detail.errors) && detail.errors.length > 0) {
          const firstError = detail.errors[0] as { msg?: unknown };
          if (typeof firstError?.msg === "string" && firstError.msg.trim().length > 0) {
            return firstError.msg;
          }
        }
      }

      if (typeof json?.message === "string" && json.message.trim().length > 0) {
        return json.message;
      }

      return `Error ${response.status}`;
    } catch {
      // Not JSON, return as-is or generic error
      return text || `Error ${response.status}: ${response.statusText}`;
    }
  } catch {
    return `Error ${response.status}: ${response.statusText}`;
  }
}

function normalizeOptionalText(value?: string | null): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeMedicationInput(
  medication: MedicationPrescriptionInput
): MedicationPrescriptionInput {
  return {
    ...medication,
    medicine_name: medication.medicine_name?.trim() || "",
    generic_name: normalizeOptionalText(medication.generic_name),
    strength: normalizeOptionalText(medication.strength),
    dose_morning_amount: normalizeOptionalText(medication.dose_morning_amount),
    dose_afternoon_amount: normalizeOptionalText(medication.dose_afternoon_amount),
    dose_evening_amount: normalizeOptionalText(medication.dose_evening_amount),
    dose_night_amount: normalizeOptionalText(medication.dose_night_amount),
    dosage_pattern: normalizeOptionalText(medication.dosage_pattern),
    frequency_text: normalizeOptionalText(medication.frequency_text),
    special_instructions: normalizeOptionalText(medication.special_instructions),
    start_date: normalizeOptionalText(medication.start_date),
    end_date: normalizeOptionalText(medication.end_date),
  };
}

function normalizeTestInput(test: TestPrescriptionInput): TestPrescriptionInput {
  return {
    ...test,
    test_name: test.test_name?.trim() || "",
    test_type: normalizeOptionalText(test.test_type),
    instructions: normalizeOptionalText(test.instructions),
    preferred_lab: normalizeOptionalText(test.preferred_lab),
    expected_date: normalizeOptionalText(test.expected_date),
  };
}

function normalizeSurgeryInput(
  surgery: SurgeryRecommendationInput
): SurgeryRecommendationInput {
  return {
    ...surgery,
    procedure_name: surgery.procedure_name?.trim() || "",
    procedure_type: normalizeOptionalText(surgery.procedure_type),
    reason: normalizeOptionalText(surgery.reason),
    recommended_date: normalizeOptionalText(surgery.recommended_date),
    pre_op_instructions: normalizeOptionalText(surgery.pre_op_instructions),
    notes: normalizeOptionalText(surgery.notes),
    preferred_facility: normalizeOptionalText(surgery.preferred_facility),
  };
}

function normalizeDraftUpdateInput(
  data: ConsultationDraftUpdateInput
): ConsultationDraftUpdateInput {
  return {
    chief_complaint: normalizeOptionalText(data.chief_complaint),
    diagnosis: normalizeOptionalText(data.diagnosis),
    notes: normalizeOptionalText(data.notes),
    prescription_type: data.prescription_type,
    prescription_notes: normalizeOptionalText(data.prescription_notes),
    medications: data.medications?.map((medication) => normalizeMedicationInput(medication)),
    tests: data.tests?.map((test) => normalizeTestInput(test)),
    surgeries: data.surgeries?.map((surgery) => normalizeSurgeryInput(surgery)),
  };
}

type AddPrescriptionInput = {
  type: PrescriptionType;
  notes?: string;
  medications?: MedicationPrescriptionInput[];
  tests?: TestPrescriptionInput[];
  surgeries?: SurgeryRecommendationInput[];
};

function normalizeAddPrescriptionInput(data: AddPrescriptionInput): AddPrescriptionInput {
  return {
    ...data,
    notes: normalizeOptionalText(data.notes),
    medications: data.medications?.map((medication) => normalizeMedicationInput(medication)),
    tests: data.tests?.map((test) => normalizeTestInput(test)),
    surgeries: data.surgeries?.map((surgery) => normalizeSurgeryInput(surgery)),
  };
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
export type DosageType = "pattern" | "frequency";

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
  dosage_type?: DosageType;
  dosage_pattern?: string;
  frequency_text?: string;
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

export interface FullPrescriptionDoctor {
  name: string;
  qualification?: string;
  specialization?: string;
  chamber_info?: string;
  phone?: string;
  address?: string;
  registration_number?: string;
  signature_url?: string;
}

export interface FullPrescriptionPatient {
  name: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  patient_id: string;
}

export interface FullPrescriptionConsultation {
  date: string;
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
}

export interface FullPrescriptionMedication {
  medicine_name: string;
  strength?: string;
  dosage_type: DosageType;
  dosage_pattern?: string;
  frequency_text?: string;
  duration?: string;
  route?: string;
  meal_instruction?: string;
  quantity?: number;
}

export interface FullPrescriptionTest {
  test_name: string;
  instructions?: string;
  urgency?: string;
}

export interface FullPrescriptionProcedure {
  procedure_name: string;
  notes?: string;
  reason?: string;
  urgency?: string;
}

export interface FullPrescriptionResponse {
  data_source?: "draft" | "prescription";
  doctor: FullPrescriptionDoctor;
  patient: FullPrescriptionPatient;
  consultation: FullPrescriptionConsultation;
  medications: FullPrescriptionMedication[];
  tests: FullPrescriptionTest[];
  procedures: FullPrescriptionProcedure[];
}

export interface Consultation {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_ref?: string;
  appointment_id?: string;
  draft_id?: string;
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

export interface ConsultationDraftPayload {
  consultation_id: string;
  draft_id?: string;
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
  prescription_type?: PrescriptionType;
  prescription_notes?: string;
  medications: MedicationPrescriptionInput[];
  tests: TestPrescriptionInput[];
  surgeries: SurgeryRecommendationInput[];
  updated_at?: string;
}

export interface ConsultationDraftUpdateInput {
  chief_complaint?: string;
  diagnosis?: string;
  notes?: string;
  prescription_type?: PrescriptionType;
  prescription_notes?: string;
  medications?: MedicationPrescriptionInput[];
  tests?: TestPrescriptionInput[];
  surgeries?: SurgeryRecommendationInput[];
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
 * Get backend consultation draft payload.
 */
export async function getConsultationDraft(consultationId: string): Promise<ConsultationDraftPayload> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/draft`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch consultation draft");
  }

  return await response.json();
}

/**
 * Get consultation draft payload by draft_id.
 */
export async function getConsultationDraftById(draftId: string): Promise<ConsultationDraftPayload> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/drafts/${draftId}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch consultation draft");
  }

  return await response.json();
}

/**
 * Persist consultation draft payload.
 */
export async function saveConsultationDraft(
  consultationId: string,
  data: ConsultationDraftUpdateInput
): Promise<ConsultationDraftPayload> {
  const headers = await getAuthHeaders();
  const normalizedData = normalizeDraftUpdateInput(data);

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/draft`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(normalizedData),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to save consultation draft");
  }

  return await response.json();
}

/**
 * Persist consultation draft payload by draft_id.
 */
export async function saveConsultationDraftById(
  draftId: string,
  data: ConsultationDraftUpdateInput
): Promise<ConsultationDraftPayload> {
  const headers = await getAuthHeaders();
  const normalizedData = normalizeDraftUpdateInput(data);

  const response = await fetch(`${BACKEND_URL}/consultation/drafts/${draftId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(normalizedData),
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to save consultation draft");
  }

  return await response.json();
}

/**
 * Get consultation-level full prescription payload for preview/print.
 */
export async function getFullPrescriptionByConsultation(
  consultationId: string
): Promise<FullPrescriptionResponse> {
  const headers = await getAuthHeaders();

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/full`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorMessage = await parseErrorResponse(response);
    throw new Error(errorMessage || "Failed to fetch full prescription");
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
  dosage_type?: DosageType;
  dosage_pattern?: string;
  frequency_text?: string;
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
  data: AddPrescriptionInput
): Promise<Prescription> {
  const headers = await getAuthHeaders();
  const normalizedData = normalizeAddPrescriptionInput(data);

  const response = await fetch(`${BACKEND_URL}/consultation/${consultationId}/prescription`, {
    method: "POST",
    headers,
    body: JSON.stringify(normalizedData),
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
