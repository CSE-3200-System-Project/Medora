"use server";

/**
 * Voice-to-Text Server Actions
 * 
 * These actions handle communication with the backend ASR endpoint.
 * Audio is sent to the backend for transcription using Whisper-Small.
 */

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

export interface VoiceTranscriptionResult {
  success: true;
  normalized_text: string;
  confidence: number;
  confidence_level: "high" | "medium" | "low";
  language_detected: string;
  source: "voice";
}

export interface VoiceTranscriptionError {
  success: false;
  error: string;
  retry_suggested: boolean;
  fallback_to_text: boolean;
}

export type TranscribeVoiceResponse = VoiceTranscriptionResult | VoiceTranscriptionError;

// Supported languages for transcription
export type TranscriptionLanguage = "bn" | "en" | "auto";

/**
 * Send audio to backend for transcription.
 * 
 * @param formData - FormData containing the audio file
 * @param language - Language hint: "auto" (default), "bn" (Bangla), or "en" (English)
 * @returns Transcription result or error
 * 
 * **Language Selection:**
 * - Use "auto" (default) to automatically detect between English and Bangla
 * - Use "bn" to force Bangla transcription
 * - Use "en" to force English transcription
 * 
 * **Auto-detection Strategy:**
 * - Backend transcribes with both languages
 * - Compares confidence scores
 * - Returns the result with higher confidence
 */
export async function transcribeVoice(
  formData: FormData, 
  language: TranscriptionLanguage = "auto"
): Promise<TranscribeVoiceResponse> {
  try {
    if (!BACKEND_URL) {
      return {
        success: false,
        error: "Backend URL not configured",
        retry_suggested: false,
        fallback_to_text: true
      };
    }

    // Add language parameter to form data
    formData.append("language", language);

    const response = await fetch(`${BACKEND_URL}/ai/normalize/voice`, {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle error response from backend
      const errorDetail = data.detail || data;
      return {
        success: false,
        error: typeof errorDetail === "string" 
          ? errorDetail 
          : errorDetail.error || "Transcription failed",
        retry_suggested: errorDetail.retry_suggested ?? true,
        fallback_to_text: errorDetail.fallback_to_text ?? true
      };
    }

    // Success response
    return {
      success: true,
      normalized_text: data.normalized_text,
      confidence: data.confidence,
      confidence_level: data.confidence_level,
      language_detected: data.language_detected,
      source: data.source
    };

  } catch (error) {
    console.error("Voice transcription error:", error);
    return {
      success: false,
      error: "Failed to connect to server. Please try again.",
      retry_suggested: true,
      fallback_to_text: true
    };
  }
}
