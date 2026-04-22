"use client";

import React from "react";
import type Vapi from "@vapi-ai/web";
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

interface UserLocation {
  latitude: number;
  longitude: number;
}

type VapiClient = Pick<Vapi, "start" | "stop" | "on" | "getDailyCallObject"> & {
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type VapiListeners = {
  handleCallStart: () => void;
  handleCallEnd: () => void;
  handleSpeechStart: () => void;
  handleSpeechEnd: () => void;
  handleMessage: (message: unknown) => void;
  handleError: (error: unknown) => void;
};

type AIDoctorSearchVapiAssistantProps = {
  location?: string;
  consultationMode?: string;
  userLocation?: UserLocation | null;
  onTranscriptDetected: (text: string) => void;
};

function getCookieValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : "";
}

function parseTranscriptMessage(message: unknown): { role: string; transcript: string } | null {
  if (!message || typeof message !== "object") {
    return null;
  }

  const payload = message as Record<string, unknown>;
  if (payload.type !== "transcript") {
    return null;
  }

  const role = typeof payload.role === "string" ? payload.role.toLowerCase() : "";
  const transcript = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
  if (!transcript) {
    return null;
  }

  return { role, transcript };
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

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;
        const nestedMessage = nested.message;
        if (typeof nestedMessage === "string" && nestedMessage.trim()) {
          return nestedMessage;
        }
      }
    }
  }

  return "Unable to start AI voice assistant.";
}

function isAssistantNotFoundError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("assistant") &&
    (normalized.includes("not found") || normalized.includes("not_found") || normalized.includes("does not exist"))
  );
}

export function AIDoctorSearchVapiAssistant({
  location,
  consultationMode,
  userLocation,
  onTranscriptDetected,
}: AIDoctorSearchVapiAssistantProps) {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";
  const fallbackAssistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "";
  const doctorSearchAssistantId = process.env.NEXT_PUBLIC_VAPI_DOCTOR_SEARCH_ASSISTANT_ID || "";
  const isDoctorSearchAssistantMisconfigured =
    Boolean(doctorSearchAssistantId) && doctorSearchAssistantId === publicKey;
  const primaryAssistantId =
    doctorSearchAssistantId && !isDoctorSearchAssistantMisconfigured
      ? doctorSearchAssistantId
      : fallbackAssistantId;
  const secondaryAssistantId =
    primaryAssistantId && fallbackAssistantId && primaryAssistantId !== fallbackAssistantId
      ? fallbackAssistantId
      : "";
  const isConfigured = Boolean(publicKey && primaryAssistantId);

  const vapiRef = React.useRef<VapiClient | null>(null);
  const listenersRef = React.useRef<VapiListeners | null>(null);
  const audioResourcesRef = React.useRef<VapiAudioResources | null>(null);

  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string>("");

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
    instance.off("message", listeners.handleMessage);
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

      const handleMessage = (message: unknown) => {
        const transcriptPayload = parseTranscriptMessage(message);
        if (!transcriptPayload) {
          return;
        }

        if (transcriptPayload.role === "user") {
          onTranscriptDetected(transcriptPayload.transcript);
        }
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
        handleMessage,
        handleError,
      };

      instance.on("call-start", handleCallStart);
      instance.on("call-end", handleCallEnd);
      instance.on("speech-start", handleSpeechStart);
      instance.on("speech-end", handleSpeechEnd);
      instance.on("message", handleMessage);
      instance.on("error", handleError);
    },
    [detachVapiListeners, onTranscriptDetected],
  );

  const createVapiClient = React.useCallback(async (): Promise<VapiClient> => {
    if (vapiRef.current) {
      return vapiRef.current;
    }

    // Normalise mic to 48 kHz so Daily/Krisp never sees a 192 kHz source.
    const resources = await createVapiAudioResources();
    audioResourcesRef.current = resources;
    const dailyCallObject = resources ? { audioSource: resources.normalizedTrack } : undefined;

    const { default: VapiCtor } = await import("@vapi-ai/web");
    const instance = new VapiCtor(publicKey, undefined, undefined, dailyCallObject);
    vapiRef.current = instance;
    attachVapiListeners(instance);
    installVapiKrispGuard(instance);
    return instance;
  }, [attachVapiListeners, publicKey]);

  React.useEffect(() => {
    return () => {
      disposeVapiClient(true);
    };
  }, [disposeVapiClient]);

  const startVoiceAssistant = React.useCallback(async () => {
    if (isDoctorSearchAssistantMisconfigured && !fallbackAssistantId) {
      setVoiceError(
        "NEXT_PUBLIC_VAPI_DOCTOR_SEARCH_ASSISTANT_ID is set to the Vapi public key. Use a Vapi assistant ID.",
      );
      return;
    }

    if (!isConfigured || !primaryAssistantId) {
      setVoiceError("Vapi doctor-search assistant is not configured.");
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
      const startOptions = withVapiAudioFallback({
        metadata: {
          source: "medora-ai-doctor-search",
          role_context: "patient",
          session_token: sessionToken,
          location: location || "",
          consultation_mode: consultationMode || "",
          user_location: userLocation || undefined,
        },
        variableValues: {
          medora_session_token: sessionToken,
          medora_role_context: "patient",
          medora_location: location || "",
          medora_consultation_mode: consultationMode || "",
        },
      });

      let startResult: unknown = null;
      try {
        startResult = await vapiClient.start(primaryAssistantId, startOptions);
      } catch (primaryError) {
        const primaryMessage = getVapiErrorMessage(primaryError);
        const shouldRetryWithFallback = Boolean(
          secondaryAssistantId && isAssistantNotFoundError(primaryMessage),
        );

        if (!shouldRetryWithFallback) {
          throw primaryError;
        }

        startResult = await vapiClient.start(secondaryAssistantId, startOptions);
      }

      if (startResult === null) {
        throw new Error("Voice call did not start.");
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
    createVapiClient,
    consultationMode,
    disposeVapiClient,
    fallbackAssistantId,
    isActive,
    isConfigured,
    isConnecting,
    isDoctorSearchAssistantMisconfigured,
    location,
    primaryAssistantId,
    secondaryAssistantId,
    userLocation,
  ]);

  const stopVoiceAssistant = React.useCallback(() => {
    const instance = vapiRef.current;
    if (!instance) {
      return;
    }

    try {
      instance.stop();
    } catch {
      setVoiceError("Unable to stop voice assistant cleanly.");
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
              stopVoiceAssistant();
              return;
            }
            void startVoiceAssistant();
          }}
          className="h-9"
        >
          {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {!isConnecting && isActive ? <MicOff className="mr-2 h-4 w-4" /> : null}
          {!isConnecting && !isActive ? <Mic className="mr-2 h-4 w-4" /> : null}
          {isConnecting ? "Connecting..." : isActive ? "Stop Voice Agent" : "Start Voice Agent"}
        </Button>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isActive ? (
            <>
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              {isAssistantSpeaking ? "AI is speaking" : "AI is listening"}
            </>
          ) : (
            "Use Vapi voice agent for AI doctor search"
          )}
        </div>

        {isAssistantSpeaking ? (
          <div className="ml-auto flex items-center gap-1" aria-label="assistant-speaking-indicator">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:240ms]" />
          </div>
        ) : null}
      </div>

      {voiceError ? <p className="mt-2 text-xs text-destructive">{voiceError}</p> : null}
      {isDoctorSearchAssistantMisconfigured ? (
        <p className="mt-2 text-xs text-destructive">
          NEXT_PUBLIC_VAPI_DOCTOR_SEARCH_ASSISTANT_ID must be a Vapi assistant ID, not the public key.
        </p>
      ) : null}
      {!isConfigured ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_DOCTOR_SEARCH_ASSISTANT_ID to enable doctor-search voice agent.
        </p>
      ) : null}
    </div>
  );
}
