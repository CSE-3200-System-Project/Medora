"use client";

import * as React from "react";

import { fetchWithAuth } from "@/lib/auth-utils";
import { useAppI18n, useT } from "@/i18n/client";
import {
  CHORUI_DISCLAIMER,
  type ChoruiConversationDeleteResponse,
  DEFAULT_CHORUI_STRUCTURED_DATA,
  type ChoruiConversationHistoryResponse,
  type ChoruiConversationSummary,
  type ChoruiIntakeResponse,
  type ChoruiNavigationAction,
  type ChoruiNavigationActionOption,
  type ChoruiNavigationActionType,
  type ChoruiNavigationMemory,
  type ChoruiNavigationMeta,
  type ChoruiMessage,
  type ChoruiNavigationSuggestion,
  type ChoruiRoleContext,
  type ChoruiSuggestedRoute,
  type ChoruiStructuredData,
} from "@/types/ai";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const AI_DEBOUNCE_MS = 380;

const CHORUI_NAVIGATION_ACTION_TYPES = new Set<ChoruiNavigationActionType>([
  "navigate",
  "clarify",
  "suggest",
  "undo",
  "none",
]);

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

function normalizeActionType(value: unknown): ChoruiNavigationActionType {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "none";
  if (CHORUI_NAVIGATION_ACTION_TYPES.has(normalized as ChoruiNavigationActionType)) {
    return normalized as ChoruiNavigationActionType;
  }
  return "none";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normalizeConfidence(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value ?? fallback);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, Number(parsed.toFixed(2))));
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function normalizeDelayMs(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  if (value < 0) {
    return null;
  }

  return Math.round(value);
}

function normalizeRoute(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

function normalizeActionOptions(value: unknown): ChoruiNavigationActionOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const options: ChoruiNavigationActionOption[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const label = normalizeText(record.label);
    const canonicalIntent = normalizeText(record.canonical_intent);
    const route = normalizeRoute(record.route);

    if (!label || !canonicalIntent || !route) {
      continue;
    }

    options.push({
      label,
      canonical_intent: canonicalIntent,
      route,
    });
  }

  return options;
}

function normalizeSuggestedRoutes(value: unknown): ChoruiSuggestedRoute[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const suggestions: ChoruiSuggestedRoute[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const label = normalizeText(record.label);
    const canonicalIntent = normalizeText(record.canonical_intent);
    const route = normalizeRoute(record.route);

    if (!label || !canonicalIntent || !route) {
      continue;
    }

    suggestions.push({
      label,
      canonical_intent: canonicalIntent,
      route,
    });
  }

  return suggestions;
}

function sanitizeNavigationList(value: unknown): ChoruiNavigationSuggestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const suggestions: ChoruiNavigationSuggestion[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const label = normalizeText(record.label);
    const path = normalizeRoute(record.path) || normalizeRoute(record.route);
    const description = normalizeText(record.description);
    if (!label || !path) {
      continue;
    }

    suggestions.push({
      label,
      path,
      description: description || null,
    });
  }

  return suggestions;
}

function normalizeNavigationAction(value: unknown): ChoruiNavigationAction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    type: normalizeActionType(record.type),
    route: normalizeRoute(record.route),
    confidence: normalizeConfidence(record.confidence, 0),
    requires_confirmation: normalizeBoolean(record.requires_confirmation),
    missing_params: normalizeStringArray(record.missing_params),
    options: normalizeActionOptions(record.options),
    reason: normalizeText(record.reason) || null,
    delay_ms: normalizeDelayMs(record.delay_ms),
  };
}

function normalizeNavigationMemory(value: unknown): ChoruiNavigationMemory | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    pending_intent: normalizeText(record.pending_intent) || null,
    missing_params: normalizeStringArray(record.missing_params),
    last_resolved_intent: normalizeText(record.last_resolved_intent) || null,
  };
}

function normalizeNavigationMeta(value: unknown): ChoruiNavigationMeta | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return {
    previous_route: normalizeRoute(record.previous_route),
    last_navigation_route: normalizeRoute(record.last_navigation_route),
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

function createWelcomeMessage(content: string): ChoruiMessage {
  return {
    id: "ai-welcome",
    role: "ai",
    content,
    timestamp: "",
    failed: false,
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
  const { locale } = useAppI18n();
  const tChorui = useT("chorui");
  const welcomeMessage = React.useMemo(
    () => (roleContext === "doctor" ? tChorui("welcomeDoctor") : tChorui("welcomePatient")),
    [roleContext, tChorui]
  );

  const [messages, setMessages] = React.useState<ChoruiMessage[]>([
    createWelcomeMessage(welcomeMessage),
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
  const [navigationAction, setNavigationAction] = React.useState<ChoruiNavigationAction | null>(null);
  const [suggestedRoutes, setSuggestedRoutes] = React.useState<ChoruiSuggestedRoute[]>([]);
  const [navigationMemory, setNavigationMemory] = React.useState<ChoruiNavigationMemory | null>(null);
  const [navigationMeta, setNavigationMeta] = React.useState<ChoruiNavigationMeta | null>(null);

  const latestUserInputRef = React.useRef<string>("");

  const clearNavigationState = React.useCallback(() => {
    setNavigationAction(null);
    setSuggestedRoutes([]);
    setNavigationMemory(null);
    setNavigationMeta(null);
  }, []);

  const resetToWelcome = React.useCallback(() => {
    setConversationId("");
    setContextMode(roleContext === "doctor" ? "doctor-general" : "patient-self");
    setStructuredData(DEFAULT_CHORUI_STRUCTURED_DATA);
    setMessages([createWelcomeMessage(welcomeMessage)]);
    clearNavigationState();
  }, [clearNavigationState, roleContext, welcomeMessage]);

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
              navigation: sanitizeNavigationList(item.structured_data?.navigation),
            }))
          : [];

        setConversationId(data.conversation_id || normalizedId);
        setContextMode(data.context_mode ?? (roleContext === "doctor" ? "doctor-general" : "patient-self"));
        setMessages(loadedMessages.length > 0 ? loadedMessages : [createWelcomeMessage(welcomeMessage)]);
        clearNavigationState();
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : tChorui("loadConversationFailed");
        setError(message);
      }
    },
    [clearNavigationState, loading, roleContext, tChorui, welcomeMessage]
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
        const message = deleteError instanceof Error ? deleteError.message : tChorui("deleteConversationFailed");
        setError(message);
      } finally {
        setDeletingConversationId("");
      }
    },
    [conversationId, deletingConversationId, loading, resetToWelcome, tChorui]
  );

  const submitMessage = React.useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) {
      return;
    }

    if (roleContext === "patient" && !patientId) {
      setError(tChorui("patientSessionLoading"));
      return;
    }

    setError(null);
    setSaveState(null);

    const userMessage = createMessage("user", trimmed);
    latestUserInputRef.current = trimmed;
    setInput("");
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);
    clearNavigationState();

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
          ui_locale: locale,
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
          : tChorui("fallbackReply");

      setMessages((prev) => [...prev, createMessage("ai", aiReply)]);
      if (typeof data.conversation_id === "string" && data.conversation_id.trim().length > 0) {
        setConversationId(data.conversation_id.trim());
      }
      setStructuredData((prev) => mergeStructuredData(prev, data.structured_data));
      setContextMode(data.context_mode ?? contextMode);
      setNavigationAction(normalizeNavigationAction(data.action));
      setSuggestedRoutes(normalizeSuggestedRoutes(data.suggested_routes));
      setNavigationMemory(normalizeNavigationMemory(data.memory));
      setNavigationMeta(normalizeNavigationMeta(data.navigation_meta));
      void fetchConversationList();
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : tChorui("unableToProcess");
      setError(message);
      setMessages((prev) => [...prev, createMessage("ai", tChorui("fallbackReply"), true)]);
      clearNavigationState();
    } finally {
      setLoading(false);
    }
  }, [
    clearNavigationState,
    contextMode,
    conversationId,
    fetchConversationList,
    input,
    loading,
    messages,
    patientId,
    roleContext,
    locale,
    tChorui,
  ]);

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
      setSaveState(tChorui("doctorSaveDisabled"));
      return;
    }

    if (!patientId) {
      setSaveState(tChorui("patientNotReady"));
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

      setSaveState(tChorui("saveSuccess"));
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : tChorui("saveFailed");
      setSaveState(message);
    } finally {
      setSaving(false);
    }
  }, [patientId, roleContext, structuredData, tChorui]);

  return {
    messages,
    input,
    setInput,
    patientId,
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
    navigationAction,
    suggestedRoutes,
    navigationMemory,
    navigationMeta,
    clearNavigationState,
    disclaimer: CHORUI_DISCLAIMER,
  };
}
