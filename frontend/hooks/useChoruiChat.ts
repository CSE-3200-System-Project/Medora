"use client";

import * as React from "react";

import { fetchWithAuth } from "@/lib/auth-utils";
import {
  CHORUI_DISCLAIMER,
  type ChoruiConversationDeleteResponse,
  DEFAULT_CHORUI_STRUCTURED_DATA,
  type ChoruiConversationHistoryResponse,
  type ChoruiConversationSummary,
  type ChoruiIntakeResponse,
  type ChoruiMessage,
  type ChoruiRoleContext,
  type ChoruiStructuredData,
} from "@/types/ai";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const AI_DEBOUNCE_MS = 380;

const FALLBACK_AI_REPLY =
  "I could not reach Medora AI right now. Please try again and I will continue from your context.";

const MODE_WELCOME_MESSAGE: Record<ChoruiRoleContext, string> = {
  patient:
    "Hello. I am Chorui, Medora's AI assistant. I can help you understand your health records and prepare useful details for your doctor.",
  doctor:
    "Hello Doctor. I am Chorui, your workflow assistant. Ask general workflow questions anytime, and include a patient ID when you want record-linked intelligence.",
};

type AuthMeResponse = {
  id?: string;
  user_id?: string;
  profile_id?: string;
};

function getCookieValue(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : null;
}

function clampSeverity(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(10, Math.round(value)));
}

function mergeStructuredData(
  previous: ChoruiStructuredData,
  incoming?: Partial<ChoruiStructuredData>
): ChoruiStructuredData {
  if (!incoming) {
    return previous;
  }

  return {
    symptoms: Array.isArray(incoming.symptoms)
      ? incoming.symptoms.filter(Boolean).map((item) => item.trim())
      : previous.symptoms,
    conditions: Array.isArray(incoming.conditions)
      ? incoming.conditions.filter(Boolean).map((item) => item.trim())
      : previous.conditions,
    duration: typeof incoming.duration === "string" ? incoming.duration.trim() : previous.duration,
    severity:
      typeof incoming.severity === "number"
        ? clampSeverity(incoming.severity)
        : previous.severity,
  };
}

function createMessage(role: "ai" | "user", content: string, failed = false): ChoruiMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    timestamp: new Date().toISOString(),
    failed,
  };
}

async function parseError(response: Response): Promise<string> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.detail === "string") {
        return parsed.detail;
      }
      if (typeof parsed?.message === "string") {
        return parsed.message;
      }
    } catch {
      // Ignore parse failure and fallback to raw text.
    }
    return text || `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

type UseChoruiChatOptions = {
  roleContext: ChoruiRoleContext;
  defaultPatientId?: string;
};

export function useChoruiChat({ roleContext, defaultPatientId }: UseChoruiChatOptions) {
  const [messages, setMessages] = React.useState<ChoruiMessage[]>([
    createMessage("ai", MODE_WELCOME_MESSAGE[roleContext]),
  ]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saveState, setSaveState] = React.useState<string | null>(null);
  const [patientId, setPatientId] = React.useState<string>(defaultPatientId ?? "");
  const [conversationId, setConversationId] = React.useState<string>("");
  const [conversations, setConversations] = React.useState<ChoruiConversationSummary[]>([]);
  const [conversationsLoading, setConversationsLoading] = React.useState(false);
  const [deletingConversationId, setDeletingConversationId] = React.useState<string>("");
  const [structuredData, setStructuredData] = React.useState<ChoruiStructuredData>(DEFAULT_CHORUI_STRUCTURED_DATA);
  const [contextMode, setContextMode] = React.useState<string>(
    roleContext === "doctor" ? "doctor-general" : "patient-self"
  );

  const latestUserInputRef = React.useRef<string>("");

  const resetToWelcome = React.useCallback(() => {
    setConversationId("");
    setContextMode(roleContext === "doctor" ? "doctor-general" : "patient-self");
    setStructuredData(DEFAULT_CHORUI_STRUCTURED_DATA);
    setMessages([createMessage("ai", MODE_WELCOME_MESSAGE[roleContext])]);
  }, [roleContext]);

  const fetchConversationList = React.useCallback(async () => {
    const token = getCookieValue("session_token");
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const query = new URLSearchParams({ role_context: roleContext, limit: "30" });
    if (roleContext === "doctor" && patientId) {
      query.set("patient_id", patientId);
    }

    setConversationsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/ai/assistant/conversations?${query.toString()}`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { conversations?: ChoruiConversationSummary[] };
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
    } catch {
      // Keep the current conversation usable even if history fetch fails.
    } finally {
      setConversationsLoading(false);
    }
  }, [patientId, roleContext]);

  React.useEffect(() => {
    if (roleContext !== "patient" || defaultPatientId) {
      return;
    }

    if (!getCookieValue("session_token")) {
      setError("Your session has expired. Please log in again.");
      return;
    }

    let isMounted = true;

    async function resolvePatientId() {
      const authResponse = await fetchWithAuth("/api/auth/me", { cache: "no-store" });
      if (!authResponse?.ok) {
        if (isMounted) {
          setError("Unable to verify your account session. Please refresh or sign in again.");
        }
        return;
      }

      const data = (await authResponse.json()) as AuthMeResponse;
      const resolvedId = data.id || data.user_id || data.profile_id || "";

      if (isMounted && roleContext === "patient") {
        setPatientId(resolvedId);
      }
    }

    resolvePatientId().catch(() => {
      if (isMounted) {
        setError("Unable to verify your account session. Please refresh or sign in again.");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [defaultPatientId, roleContext]);

  React.useEffect(() => {
    if (roleContext === "doctor" && defaultPatientId) {
      setPatientId(defaultPatientId);
    }
  }, [defaultPatientId, roleContext]);

  React.useEffect(() => {
    void fetchConversationList();
  }, [fetchConversationList]);

  const openConversation = React.useCallback(
    async (targetConversationId: string) => {
      const normalizedId = targetConversationId.trim();
      if (!normalizedId || loading) {
        return;
      }

      const token = getCookieValue("session_token");
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      try {
        setError(null);
        const response = await fetch(
          `${BACKEND_URL}/ai/assistant/conversations/${encodeURIComponent(normalizedId)}?limit=200`,
          {
            method: "GET",
            headers,
          }
        );

        if (!response.ok) {
          const message = await parseError(response);
          throw new Error(message);
        }

        const data = (await response.json()) as ChoruiConversationHistoryResponse;
        const loadedMessages: ChoruiMessage[] = Array.isArray(data.messages)
          ? data.messages.map((item) => ({
              id: item.id,
              role: item.role === "ai" ? "ai" : "user",
              content: item.content,
              timestamp: item.timestamp,
            }))
          : [];

        setConversationId(data.conversation_id || normalizedId);
        setContextMode(data.context_mode ?? (roleContext === "doctor" ? "doctor-general" : "patient-self"));
        setMessages(loadedMessages.length > 0 ? loadedMessages : [createMessage("ai", MODE_WELCOME_MESSAGE[roleContext])]);
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load conversation";
        setError(message);
      }
    },
    [loading, roleContext]
  );

  const startNewConversation = React.useCallback(() => {
    resetToWelcome();
    setError(null);
    setSaveState(null);
  }, [resetToWelcome]);

  const deleteConversation = React.useCallback(
    async (targetConversationId: string) => {
      const normalizedId = targetConversationId.trim();
      if (!normalizedId || deletingConversationId || loading) {
        return;
      }

      const token = getCookieValue("session_token");
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      setDeletingConversationId(normalizedId);
      setError(null);
      try {
        const response = await fetch(
          `${BACKEND_URL}/ai/assistant/conversations/${encodeURIComponent(normalizedId)}`,
          {
            method: "DELETE",
            headers,
          }
        );

        if (!response.ok) {
          const message = await parseError(response);
          throw new Error(message);
        }

        const data = (await response.json()) as ChoruiConversationDeleteResponse;
        if (data.deleted) {
          setConversations((prev) => prev.filter((item) => item.conversation_id !== normalizedId));
          if (conversationId === normalizedId) {
            resetToWelcome();
          }
        }
      } catch (deleteError) {
        const message = deleteError instanceof Error ? deleteError.message : "Failed to delete conversation";
        setError(message);
      } finally {
        setDeletingConversationId("");
      }
    },
    [conversationId, deletingConversationId, loading, resetToWelcome]
  );

  const submitMessage = React.useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) {
      return;
    }

    if (roleContext === "patient" && !patientId) {
      setError("Patient session is still loading. Please try again in a moment.");
      return;
    }

    setError(null);
    setSaveState(null);

    const userMessage = createMessage("user", trimmed);
    latestUserInputRef.current = trimmed;
    setInput("");
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    const historySnapshot = [...messages, userMessage];

    const token = getCookieValue("session_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, AI_DEBOUNCE_MS));

      const response = await fetch(`${BACKEND_URL}/ai/assistant-chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: trimmed,
          conversation_id: conversationId || undefined,
          patient_id: patientId || undefined,
          history: historySnapshot,
          role_context: roleContext,
        }),
      });

      if (!response.ok) {
        const message = await parseError(response);
        throw new Error(message);
      }

      const data = (await response.json()) as ChoruiIntakeResponse;
      const aiReply =
        typeof data.reply === "string" && data.reply.trim().length > 0
          ? data.reply.trim()
          : "Thank you. I have updated the intake summary. Please continue with any additional details.";

      setMessages((prev) => [...prev, createMessage("ai", aiReply)]);
      if (typeof data.conversation_id === "string" && data.conversation_id.trim().length > 0) {
        setConversationId(data.conversation_id.trim());
      }
      setStructuredData((prev) => mergeStructuredData(prev, data.structured_data));
      setContextMode(data.context_mode ?? contextMode);
      void fetchConversationList();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Unable to process intake message";
      setError(message);
      setMessages((prev) => [...prev, createMessage("ai", FALLBACK_AI_REPLY, true)]);
    } finally {
      setLoading(false);
    }
  }, [contextMode, conversationId, fetchConversationList, input, loading, messages, patientId, roleContext]);

  const retryLastMessage = React.useCallback(async () => {
    if (!latestUserInputRef.current || loading) {
      return;
    }
    setInput(latestUserInputRef.current);
  }, [loading]);

  const updateStructuredData = React.useCallback((next: ChoruiStructuredData) => {
    setStructuredData({
      symptoms: next.symptoms,
      conditions: next.conditions,
      duration: next.duration,
      severity: clampSeverity(next.severity),
    });
  }, []);

  const confirmAndSave = React.useCallback(async () => {
    if (roleContext === "doctor") {
      setSaveState("Doctor mode does not store intake snapshots from this panel.");
      return;
    }

    if (!patientId) {
      setSaveState("Unable to save yet. Patient session is not ready.");
      return;
    }

    const token = getCookieValue("session_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    setSaving(true);
    setSaveState(null);

    try {
      const response = await fetch(`${BACKEND_URL}/ai/intake/save`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          patient_id: patientId,
          structured_data: structuredData,
        }),
      });

      if (!response.ok) {
        const message = await parseError(response);
        throw new Error(message);
      }

      setSaveState("Clinical intake saved successfully.");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "Failed to save intake data";
      setSaveState(message);
    } finally {
      setSaving(false);
    }
  }, [patientId, roleContext, structuredData]);

  return {
    messages,
    input,
    setInput,
    loading,
    error,
    saving,
    saveState,
    structuredData,
    updateStructuredData,
    submitMessage,
    retryLastMessage,
    confirmAndSave,
    conversations,
    conversationsLoading,
    openConversation,
    deleteConversation,
    deletingConversationId,
    startNewConversation,
    refreshConversations: fetchConversationList,
    roleContext,
    contextMode,
    disclaimer: CHORUI_DISCLAIMER,
  };
}
