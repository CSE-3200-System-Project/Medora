"use client";

import * as React from "react";
import Vapi from "@vapi-ai/web";
import { Loader2, Mic, MicOff, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  createVapiAudioResources,
  disableDailyKrispProcessor,
  isKrispSampleRateError,
  KRISP_SAMPLE_RATE_ERROR_MESSAGE,
  releaseVapiAudioResources,
  withVapiAudioFallback,
  type VapiAudioResources,
} from "@/lib/vapi-audio";

type ChoruiVapiVoiceControlProps = {
  roleContext: "patient" | "doctor";
  patientId?: string;
};

type VapiClient = Pick<Vapi, "start" | "stop" | "on" | "getDailyCallObject"> & {
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type VapiListeners = {
  handleCallStart: () => void;
  handleCallEnd: () => void;
  handleSpeechStart: () => void;
  handleSpeechEnd: () => void;
  handleError: (error: unknown) => void;
  handleMessage: (message: unknown) => void;
};

function readCookieValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : "";
}

function getMessageTranscript(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const payload = message as Record<string, unknown>;
  if (payload.type !== "transcript") {
    return "";
  }

  const transcript = typeof payload.transcript === "string" ? payload.transcript.trim() : "";
  if (!transcript) {
    return "";
  }

  const role = typeof payload.role === "string" ? payload.role.toLowerCase() : "";
  const speaker = role === "assistant" ? "Chorui" : role === "user" ? "You" : "Voice";
  return `${speaker}: ${transcript}`;
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

  return "Unable to start voice call.";
}

export function ChoruiVapiVoiceControl({ roleContext, patientId }: ChoruiVapiVoiceControlProps) {
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "";
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID || "";
  const isConfigured = Boolean(publicKey && assistantId);

  const vapiRef = React.useRef<VapiClient | null>(null);
  const listenersRef = React.useRef<VapiListeners | null>(null);
  const audioResourcesRef = React.useRef<VapiAudioResources | null>(null);

  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string>("");
  const [lastTranscript, setLastTranscript] = React.useState<string>("");

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
    instance.off("message", listeners.handleMessage);
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
        // Release microphone + AudioContext and drop the Vapi instance so
        // the next "Start Voice" click re-acquires a fresh 48 kHz audio
        // source (required because the track was consumed by Daily).
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
          // Best-effort: disable Krisp at runtime so the call can keep going
          // instead of being ejected by Daily. We still surface the message so
          // the user understands what happened if this race is lost.
          void disableDailyKrispProcessor(instance);
        }
        setIsConnecting(false);
        setIsActive(false);
        setIsAssistantSpeaking(false);
        setVoiceError(isKrispSampleRateError(message) ? KRISP_SAMPLE_RATE_ERROR_MESSAGE : message);
      };

      const handleMessage = (message: unknown) => {
        const transcript = getMessageTranscript(message);
        if (transcript) {
          setLastTranscript(transcript);
        }
      };

      listenersRef.current = {
        handleCallStart,
        handleCallEnd,
        handleSpeechStart,
        handleSpeechEnd,
        handleError,
        handleMessage,
      };

      instance.on("call-start", handleCallStart);
      instance.on("call-end", handleCallEnd);
      instance.on("speech-start", handleSpeechStart);
      instance.on("speech-end", handleSpeechEnd);
      instance.on("error", handleError);
      instance.on("message", handleMessage);
    },
    [detachVapiListeners],
  );

  const createVapiClient = React.useCallback(async (): Promise<VapiClient> => {
    if (vapiRef.current) {
      return vapiRef.current;
    }

    // Resample the microphone to 48 kHz before Daily/Krisp touches it.
    // Without this, high sample-rate devices (192 kHz) trip Krisp and Daily
    // immediately ejects the participant.
    const resources = await createVapiAudioResources();
    audioResourcesRef.current = resources;

    const dailyCallObject =
      resources && resources.normalizedTrack ? { audioSource: resources.normalizedTrack } : undefined;

    const instance = new Vapi(publicKey, undefined, undefined, dailyCallObject);
    vapiRef.current = instance;
    attachVapiListeners(instance);
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

  const startVoice = React.useCallback(async () => {
    if (!isConfigured || !assistantId) {
      setVoiceError("Vapi is not configured. Add public key and assistant ID to env.");
      return;
    }

    if (isConnecting || isActive) {
      return;
    }

    setVoiceError("");
    setIsConnecting(true);

    const sessionToken = readCookieValue("session_token");

    try {
      const vapiClient = await createVapiClient();
      const startResult = await vapiClient.start(
        assistantId,
        withVapiAudioFallback({
          variableValues: {
            medora_role_context: roleContext,
            medora_patient_id: patientId || "",
            medora_session_token: sessionToken,
          },
          metadata: {
            role_context: roleContext,
            patient_id: patientId || "",
            session_token: sessionToken,
            source: "medora-chorui-voice",
          },
        }),
      );

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
    assistantId,
    createVapiClient,
    disposeVapiClient,
    isActive,
    isConfigured,
    isConnecting,
    patientId,
    roleContext,
  ]);

  const stopVoice = React.useCallback(() => {
    const instance = vapiRef.current;
    if (!instance) {
      return;
    }

    try {
      instance.stop();
    } catch {
      setVoiceError("Unable to stop voice call cleanly.");
    } finally {
      setIsConnecting(false);
      setIsActive(false);
      setIsAssistantSpeaking(false);
    }
  }, []);

  return (
    <div className="mb-3 rounded-2xl border border-border/70 bg-card/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={isActive ? "outline" : "medical"}
          size="sm"
          className="h-9"
          disabled={!isConfigured || isConnecting}
          onClick={() => {
            if (isActive) {
              stopVoice();
              return;
            }
            void startVoice();
          }}
        >
          {isConnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {!isConnecting && isActive ? <MicOff className="mr-2 h-4 w-4" /> : null}
          {!isConnecting && !isActive ? <Mic className="mr-2 h-4 w-4" /> : null}
          {isConnecting ? "Connecting..." : isActive ? "Stop Voice" : "Start Voice"}
        </Button>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {isConfigured ? (
            isActive ? (
              <>
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                {isAssistantSpeaking ? "AI is speaking" : "AI is listening"}
              </>
            ) : (
              "Start Vapi voice for hands-free Chorui chat."
            )
          ) : (
            "Set NEXT_PUBLIC_VAPI_PUBLIC_KEY and NEXT_PUBLIC_VAPI_ASSISTANT_ID to enable voice."
          )}
        </p>

        {isAssistantSpeaking ? (
          <div className="ml-auto flex items-center gap-1" aria-label="assistant-speaking-indicator">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:120ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70 animate-pulse [animation-delay:240ms]" />
          </div>
        ) : null}
      </div>

      {lastTranscript ? <p className="mt-2 line-clamp-2 text-xs text-foreground/80">{lastTranscript}</p> : null}
      {voiceError ? <p className="mt-2 text-xs text-destructive">{voiceError}</p> : null}
    </div>
  );
}
