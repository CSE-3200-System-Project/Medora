"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export interface PatientAIAccessResponse {
  ai_personal_context_enabled: boolean;
  ai_general_chat_enabled: boolean;
  consent_ai: boolean;
}

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

export async function getPatientAIAccess(): Promise<PatientAIAccessResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/profile/patient/ai-access`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await parseErrorResponse(response);
    throw new Error(message || "Failed to fetch AI access settings");
  }

  return await response.json();
}

export async function updatePatientAIAccess(updates: {
  ai_personal_context_enabled?: boolean;
  ai_general_chat_enabled?: boolean;
}): Promise<PatientAIAccessResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${BACKEND_URL}/profile/patient/ai-access`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const message = await parseErrorResponse(response);
    throw new Error(message || "Failed to update AI access settings");
  }

  return await response.json();
}
