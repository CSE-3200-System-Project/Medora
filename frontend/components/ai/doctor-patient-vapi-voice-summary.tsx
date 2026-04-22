"use client";

import React from "react";
import Vapi from "@vapi-ai/web";
import { Loader2, Mic, MicOff, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createVapiAudioResources,
  disableDailyKrispProcessor,
  installVapiKrispGuard,
  isKrispSampleRateError,
  KRISP_SAMPLE_RATE_ERROR_MESSAGE,
  releaseVapiAudioResources,
  withVapiAudioFallback,
  type VapiAudioResources,
} from "@/lib/vapi-audio";

type VapiClient = Pick<Vapi, "start" | "stop" | "on" | "getDailyCallObject"> & {
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type VapiListeners = {
  handleCallStart: () => void;
  handleCallEnd: () => void;
  handleSpeechStart: () => void;
  handleSpeechEnd: () => void;
  handleError: (error: unknown) => void;
};

type DoctorPatientVapiVoiceSummaryProps = {
  patientId: string;
};

function getCookieValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : "";
}

function getVapiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  if (error && typeof error === "object") {
    const payload = error as Record<string, unknown>;
    const candidates: unknown[] = [payload.message, payload.detail, payload.statusText, payload.error];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate;
      }
    }
  }

  return "Unable to start voice summary.";
}

export function DoctorPatientVapiVoiceSummary({ patientId }: DoctorPatientVapiVoiceSummaryProps) {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";
  const assistantId =
    process.env.NEXT_PUBLIC_VAPI_DOCTOR_PATIENT_SUMMARY_ASSISTANT_ID
    || process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID
    || "";
  const isConfigured = Boolean(publicKey && assistantId);

  const vapiRef = React.useRef<VapiClient | null>(null);
  const listenersRef = React.useRef<VapiListeners | null>(null);
  const audioResourcesRef = React.useRef<VapiAudioResources | null>(null);

  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState("");

  const detachVapiListeners = React.useCallback(() => {
    const instance = vapiRef.current;
    const listeners = listenersRef.current;
    if (!instance || !listeners || typeof instance.off !== "function") {
      listenersRef.current = null;
      return;
    }

    instance.off("call-start", listeners.handleCallStart);
    instance.off("call-end", listeners.handleCallEnd);
    instance.off("speech-start", listeners.handleSpeechStart);
    instance.off("speech-end", listeners.handleSpeechEnd);
    instance.off("error", listeners.handleError);
    listenersRef.current = null;
  }, []);

  const disposeVapiClient = React.useCallback(
    (stopCall: boolean) => {
      const instance = vapiRef.current;
      if (instance) {
        if (stopCall) {
          try {
            instance.stop();
          } catch {
            // Ignore stop errors during cleanup.
          }
        }

        detachVapiListeners();
        vapiRef.current = null;
      }

      releaseVapiAudioResources(audioResourcesRef.current);
      audioResourcesRef.current = null;
    },
    [detachVapiListeners],
  );

  const attachVapiListeners = React.useCallback(
    (instance: VapiClient) => {
      const handleCallStart = () => {
        setIsConnecting(false);
        setIsActive(true);
        setVoiceError("");
      };

      const handleCallEnd = () => {
        setIsConnecting(false);
        setIsActive(false);
        setIsAssistantSpeaking(false);
        releaseVapiAudioResources(audioResourcesRef.current);
        audioResourcesRef.current = null;
        detachVapiListeners();
        vapiRef.current = null;
      };

      const handleSpeechStart = () => {
        setIsAssistantSpeaking(true);
      };

      const handleSpeechEnd = () => {
        setIsAssistantSpeaking(false);
      };

      const handleError = (error: unknown) => {
        const message = getVapiErrorMessage(error);
        if (isKrispSampleRateError(message)) {
          void disableDailyKrispProcessor(instance);
        }
        setIsConnecting(false);
        setIsActive(false);
        setIsAssistantSpeaking(false);
        setVoiceError(isKrispSampleRateError(message) ? KRISP_SAMPLE_RATE_ERROR_MESSAGE : message);
      };

      listenersRef.current = {
        handleCallStart,
        handleCallEnd,
        handleSpeechStart,
        handleSpeechEnd,
        handleError,
      };

      instance.on("call-start", handleCallStart);
      instance.on("call-end", handleCallEnd);
      instance.on("speech-start", handleSpeechStart);
      instance.on("speech-end", handleSpeechEnd);
      instance.on("error", handleError);
    },
    [detachVapiListeners],
  );

  const createVapiClient = React.useCallback(async (): Promise<VapiClient> => {
    if (vapiRef.current) {
      return vapiRef.current;
    }

    const resources = await createVapiAudioResources();
    audioResourcesRef.current = resources;
    const dailyCallObject = resources ? { audioSource: resources.normalizedTrack } : undefined;

    const instance = new Vapi(publicKey, undefined, undefined, dailyCallObject);
    vapiRef.current = instance;
    attachVapiListeners(instance);
    installVapiKrispGuard(instance);
    return instance;
  }, [attachVapiListeners, publicKey]);

  React.useEffect(() => {
    if (!isConfigured) {
      disposeVapiClient(true);
    }

    return () => {
      disposeVapiClient(true);
    };
  }, [disposeVapiClient, isConfigured]);

  const startVoiceSummary = React.useCallback(async () => {
    if (!isConfigured || !assistantId) {
      setVoiceError("Vapi doctor summary assistant is not configured.");
      return;
    }

    if (isConnecting || isActive) {
      return;
    }

    setIsConnecting(true);
    setVoiceError("");

    const sessionToken = getCookieValue("session_token");

    try {
      const vapiClient = await createVapiClient();
      const startResult = await vapiClient.start(
        assistantId,
        withVapiAudioFallback({
          metadata: {
            source: "medora-doctor-patient-voice-summary",
            role_context: "doctor",
            session_token: sessionToken,
            patient_id: patientId,
            medora_patient_id: patientId,
            voice_mode: "doctor_patient_summary",
          },
          variableValues: {
            medora_role_context: "doctor",
            medora_session_token: sessionToken,
            medora_patient_id: patientId,
            medora_voice_mode: "doctor_patient_summary",
          },
        }),
      );

      if (startResult === null) {
        throw new Error("Voice summary call did not start.");
      }
    } catch (error) {
      const message = getVapiErrorMessage(error);
      setIsConnecting(false);
      setIsActive(false);
      setIsAssistantSpeaking(false);

      if (isKrispSampleRateError(message)) {
        setVoiceError(KRISP_SAMPLE_RATE_ERROR_MESSAGE);
      } else {
        setVoiceError(message);
      }

      disposeVapiClient(false);
    }
  }, [
    assistantId,
    createVapiClient,
    disposeVapiClient,
    isActive,
    isConfigured,
    isConnecting,
    patientId,
  ]);

  const stopVoiceSummary = React.useCallback(() => {
    const instance = vapiRef.current;
    if (!instance) {
      return;
    }

    try {
      instance.stop();
    } catch {
      setVoiceError("Unable to stop voice summary cleanly.");
    } finally {
      setIsConnecting(false);
      setIsActive(false);
      setIsAssistantSpeaking(false);
    }
  }, []);

  return (
    <div className="rounded-xl border border-primary/20 bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isActive ? "outline" : "medical"}
          size="sm"
          disabled={!isConfigured || isConnecting}
          onClick={() => {
            if (isActive) {
              stopVoiceSummary();
              return;
            }
            void startVoiceSummary();
          }}
          className="h-9"
        >
          {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {!isConnecting && isActive ? <MicOff className="mr-2 h-4 w-4" /> : null}
          {!isConnecting && !isActive ? <Mic className="mr-2 h-4 w-4" /> : null}
          {isConnecting ? "Connecting..." : isActive ? "Stop Voice Summary" : "Listen to Summary"}
        </Button>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {isConfigured ? (
            isActive ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                {isAssistantSpeaking ? "AI is speaking" : "AI is listening"}
              </>
            ) : (
              "Use Vapi to read this patient summary aloud"
            )
          ) : (
            "Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_DOCTOR_PATIENT_SUMMARY_ASSISTANT_ID to enable voice summary."
          )}
        </p>

        {isAssistantSpeaking ? (
          <div className="ml-auto flex items-center gap-1" aria-label="assistant-speaking-indicator">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0.2s]" />
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:0.4s]" />
          </div>
        ) : null}
      </div>

      {voiceError ? <p className="mt-2 text-xs text-destructive">{voiceError}</p> : null}
    </div>
  );
}

