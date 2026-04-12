"use client";

import * as React from "react";
import Vapi from "@vapi-ai/web";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, Mic, MicOff, Navigation, Volume2 } from "lucide-react";

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
import {
  buildMedoraAssistantOverrides,
  extractVapiToolCalls,
  MEDORA_CLIENT_ACTION_TOOLS,
  resolveVapiNavigation,
  type MedoraRoleContext,
  type VapiToolCall,
} from "@/lib/vapi-tools";
import { useAppI18n } from "@/i18n/client";

type ChoruiVapiVoiceControlProps = {
  roleContext: MedoraRoleContext;
  patientId?: string;
};

type VapiClient = Pick<Vapi, "start" | "stop" | "send" | "on" | "off" | "getDailyCallObject">;

type VapiListeners = {
  handleCallStart: () => void;
  handleCallEnd: () => void;
  handleSpeechStart: () => void;
  handleSpeechEnd: () => void;
  handleError: (error: unknown) => void;
  handleMessage: (message: unknown) => void;
};

type VoiceAction = {
  label: string;
  route?: string;
  timestamp: number;
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

  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useAppI18n();

  const vapiRef = React.useRef<VapiClient | null>(null);
  const listenersRef = React.useRef<VapiListeners | null>(null);
  const audioResourcesRef = React.useRef<VapiAudioResources | null>(null);
  const pathnameRef = React.useRef(pathname);

  const [isConnecting, setIsConnecting] = React.useState(false);
  const [isActive, setIsActive] = React.useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string>("");
  const [lastTranscript, setLastTranscript] = React.useState<string>("");
  const [lastAction, setLastAction] = React.useState<VoiceAction | null>(null);

  React.useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Send route updates to VAPI when the user navigates while voice is active
  React.useEffect(() => {
    const instance = vapiRef.current;
    if (!instance || !isActive) return;

    try {
      instance.send({
        type: "add-message",
        message: {
          role: "system",
          content: `[Medora context update] User navigated to ${pathname}.`,
        },
      });
    } catch {
      // Best-effort: call may have ended between the check and send.
    }
  }, [pathname, isActive]);

  const handleClientToolCall = React.useCallback(
    (toolCall: VapiToolCall) => {
      const name = toolCall.name;

      if (name === "navigate_medora" || name === "navigate") {
        const resolved = resolveVapiNavigation(toolCall.arguments, roleContext);
        if (resolved) {
          setLastAction({
            label: `Navigating to ${resolved.label}`,
            route: resolved.route,
            timestamp: Date.now(),
          });
          router.push(resolved.route);
        }
        return;
      }

      if (name === "end_voice_call") {
        setLastAction({
          label: "Ending voice session",
          timestamp: Date.now(),
        });
        const instance = vapiRef.current;
        if (instance) {
          try {
            instance.stop();
          } catch {
            // Handled by call-end event.
          }
        }
      }
    },
    [roleContext, router],
  );

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

      const handleMessage = (message: unknown) => {
        const transcript = getMessageTranscript(message);
        if (transcript) {
          setLastTranscript(transcript);
        }

        const toolCalls = extractVapiToolCalls(message);
        for (const call of toolCalls) {
          if (MEDORA_CLIENT_ACTION_TOOLS.has(call.name)) {
            handleClientToolCall(call);
          }
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
    [detachVapiListeners, handleClientToolCall],
  );

  const createVapiClient = React.useCallback(async (): Promise<VapiClient> => {
    if (vapiRef.current) {
      return vapiRef.current;
    }

    const resources = await createVapiAudioResources();
    audioResourcesRef.current = resources;

    const dailyCallObject =
      resources && resources.normalizedTrack ? { audioSource: resources.normalizedTrack } : undefined;

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

  const startVoice = React.useCallback(async () => {
    if (!isConfigured || !assistantId) {
      setVoiceError("Vapi is not configured. Add public key and assistant ID to env.");
      return;
    }

    if (isConnecting || isActive) {
      return;
    }

    setVoiceError("");
    setLastAction(null);
    setIsConnecting(true);

    const sessionToken = readCookieValue("session_token");
    const currentRoute = pathnameRef.current || "/";

    const overrides = buildMedoraAssistantOverrides({
      roleContext,
      patientId: patientId || "",
      sessionToken,
      currentRoute,
      locale: locale || "en",
    });

    try {
      const vapiClient = await createVapiClient();
      const startResult = await vapiClient.start(
        assistantId,
        withVapiAudioFallback(overrides) as Parameters<typeof vapiClient.start>[1],
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
    locale,
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
                {isAssistantSpeaking ? "Chorui is speaking" : "Chorui is listening"}
              </>
            ) : (
              "Start Chorui voice — ask anything, navigate, check appointments."
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

      {lastAction ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-primary">
          <Navigation className="h-3 w-3" />
          <span>{lastAction.label}</span>
        </div>
      ) : null}

      {voiceError ? <p className="mt-2 text-xs text-destructive">{voiceError}</p> : null}
    </div>
  );
}
