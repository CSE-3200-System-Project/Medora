"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export type ProcessingPurpose =
  | "clinical_sharing"
  | "external_text_ai"
  | "cloud_document_ocr"
  | "external_live_audio"
  | "research_export";

export type ProcessingConsentGrant = {
  id: string;
  subject_id: string;
  purpose: ProcessingPurpose;
  version: number;
  scopes: string[];
  provider: string;
  recipient_id: string;
  policy_version: string;
  valid_from: string;
  valid_until: string | null;
  revoked_at: string | null;
  granted_at: string;
  active: boolean;
};

async function headers() {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) throw new Error("Authentication required");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function errorMessage(response: Response): Promise<string> {
  const payload = await response.json().catch(() => null);
  return typeof payload?.detail === "string" ? payload.detail : payload?.detail?.message || "Consent request failed";
}

export async function listProcessingConsents(): Promise<ProcessingConsentGrant[]> {
  const response = await fetch(`${BACKEND_URL}/privacy/processing-consents`, { headers: await headers(), cache: "no-store" });
  if (!response.ok) throw new Error(await errorMessage(response));
  return (await response.json()).items;
}

export async function grantProcessingConsent(purpose: ProcessingPurpose): Promise<ProcessingConsentGrant> {
  const response = await fetch(`${BACKEND_URL}/privacy/processing-consents/${purpose}`, {
    method: "PUT",
    headers: await headers(),
    body: JSON.stringify({ scopes: [purpose], policy_version: "softwarex-v1" }),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return await response.json();
}

export async function revokeProcessingConsent(consentId: string): Promise<ProcessingConsentGrant> {
  const response = await fetch(`${BACKEND_URL}/privacy/processing-consents/${consentId}/revoke`, {
    method: "POST",
    headers: await headers(),
  });
  if (!response.ok) throw new Error(await errorMessage(response));
  return await response.json();
}
