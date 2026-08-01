"use server";

import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function authorizeExternalLiveAudio(): Promise<void> {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) {
    throw new Error("Sign in before starting a hosted voice session.");
  }

  const response = await fetch(
    `${BACKEND_URL}/privacy/processing-consents/authorize/external-live-audio`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    const message =
      typeof detail === "object" && detail?.message
        ? `${detail.message} Use local voice processing or grant Vapi audio consent in privacy settings.`
        : typeof detail === "string"
          ? detail
          : "Hosted voice processing requires active Vapi audio consent.";
    throw new Error(message);
  }
}
