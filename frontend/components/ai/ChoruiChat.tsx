"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Brain, Menu, SendHorizontal, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { ChoruiSummaryPanel } from "@/components/ai/ChoruiSummaryPanel";
import { ChoruiVapiVoiceControl } from "@/components/ai/chorui-vapi-voice-control";
import { useChoruiChat } from "@/hooks/useChoruiChat";
import type { ChoruiNavigationAction, ChoruiRoleContext, ChoruiSuggestedRoute } from "@/types/ai";
import { useT } from "@/i18n/client";

const AUTO_NAVIGATION_CONFIDENCE = 0.85;
const CONFIRM_NAVIGATION_CONFIDENCE = 0.6;
const MIN_NAVIGATION_DELAY_MS = 300;
const MAX_NAVIGATION_DELAY_MS = 800;
const DEFAULT_NAVIGATION_DELAY_MS = 450;

const SHARED_ALLOWED_ROUTES = new Set<string>(["/settings", "/notifications"]);

type NavigationChoice = {
  key: string;
  label: string;
  route: string;
  canonicalIntent: string;
};

type NavigationValidationResult = {
  isValid: boolean;
  route: string | null;
  reason: string;
};

function extractRoutePath(route: string): string {
  return route.split("?")[0].split("#")[0] || route;
}

function normalizeRoute(route: string | null | undefined): string | null {
  if (typeof route !== "string") {
    return null;
  }

  const trimmed = route.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  if (lowered.includes("://") || lowered.startsWith("javascript:")) {
    return null;
  }

  if (trimmed.includes("..") || /\s/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function isRoleAllowedRoute(pathname: string, roleContext: ChoruiRoleContext): boolean {
  if (pathname.startsWith("/admin")) {
    return false;
  }

  if (SHARED_ALLOWED_ROUTES.has(pathname)) {
    return true;
  }

  if (roleContext === "patient") {
    return pathname === "/patient" || pathname.startsWith("/patient/");
  }

  return pathname === "/doctor" || pathname.startsWith("/doctor/");
}

function hasCompleteDynamicParams(pathname: string): boolean {
  if (
    pathname.includes("[") ||
    pathname.includes("]") ||
    pathname.includes("{") ||
    pathname.includes("}")
  ) {
    return false;
  }

  if (pathname.startsWith("/doctor/patient/")) {
    const patientId = pathname.split("/").filter(Boolean)[2] || "";
    const lowered = patientId.toLowerCase();
    if (!patientId || ["id", "undefined", "null", "unknown"].includes(lowered)) {
      return false;
    }
  }

  return true;
}

function validateNavigationRoute(
  route: string | null | undefined,
  roleContext: ChoruiRoleContext
): NavigationValidationResult {
  const normalized = normalizeRoute(route);
  if (!normalized) {
    return {
      isValid: false,
      route: null,
      reason: "invalid route format",
    };
  }

  const pathname = extractRoutePath(normalized);
  if (!isRoleAllowedRoute(pathname, roleContext)) {
    return {
      isValid: false,
      route: normalized,
      reason: "route blocked for current role",
    };
  }

  if (!hasCompleteDynamicParams(pathname)) {
    return {
      isValid: false,
      route: normalized,
      reason: "route has unresolved dynamic parameters",
    };
  }

  return {
    isValid: true,
    route: normalized,
    reason: "ok",
  };
}

function toNavigationLabel(route: string): string {
  const pathname = extractRoutePath(route);
  if (pathname === "/settings") {
    return "Settings";
  }
  if (pathname === "/notifications") {
    return "Notifications";
  }

  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "page";
  return last
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function clampNavigationDelay(delayMs: number | null | undefined): number {
  const parsed = typeof delayMs === "number" && !Number.isNaN(delayMs) ? Math.round(delayMs) : DEFAULT_NAVIGATION_DELAY_MS;
  return Math.max(MIN_NAVIGATION_DELAY_MS, Math.min(MAX_NAVIGATION_DELAY_MS, parsed));
}

function buildNavigationChoices(
  action: ChoruiNavigationAction | null,
  suggestedRoutes: ChoruiSuggestedRoute[],
  roleContext: ChoruiRoleContext
): NavigationChoice[] {
  const choices: NavigationChoice[] = [];
  const seenRoutes = new Set<string>();

  const pushChoice = (label: string, route: string, canonicalIntent: string) => {
    const validation = validateNavigationRoute(route, roleContext);
    if (!validation.isValid || !validation.route) {
      return;
    }

    if (seenRoutes.has(validation.route)) {
      return;
    }

    seenRoutes.add(validation.route);
    choices.push({
      key: `${canonicalIntent}-${validation.route}`,
      label,
      route: validation.route,
      canonicalIntent,
    });
  };

  for (const option of action?.options ?? []) {
    pushChoice(option.label, option.route, option.canonical_intent);
  }

  for (const suggestion of suggestedRoutes) {
    pushChoice(suggestion.label, suggestion.route, suggestion.canonical_intent);
  }

  return choices;
}

function formatChatTime(timestamp: string): string {
  return formatMeridiemTime(timestamp);
}

function formatConversationTimestamp(timestamp: string): string {
  return formatShortDateTime(timestamp);
}

type ChoruiChatProps = {
  roleContext?: ChoruiRoleContext;
  defaultPatientId?: string;
};

export function ChoruiChat({ roleContext = "patient", defaultPatientId }: ChoruiChatProps) {
  const tChorui = useT("chorui");
  const {
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
    contextMode,
    navigationAction,
    suggestedRoutes,
    navigationMemory,
    navigationMeta,
    clearNavigationState,
  } = useChoruiChat({ roleContext, defaultPatientId });

  const router = useRouter();
  const pathname = usePathname();

  const isDoctorMode = roleContext === "doctor";
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [navigationStatus, setNavigationStatus] = React.useState<string | null>(null);
  const [navigationIssue, setNavigationIssue] = React.useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const [pendingConfirmation, setPendingConfirmation] = React.useState<{
    route: string;
    label: string;
  } | null>(null);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const navigationTimerRef = React.useRef<number | null>(null);
  const previousRouteRef = React.useRef<string | null>(null);
  const lastNavigationRouteRef = React.useRef<string | null>(null);

  const navigationChoices = React.useMemo(
    () => buildNavigationChoices(navigationAction, suggestedRoutes, roleContext),
    [navigationAction, roleContext, suggestedRoutes]
  );

  const cancelPendingNavigation = React.useCallback((statusMessage?: string | null) => {
    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
      navigationTimerRef.current = null;
    }

    setIsTransitioning(false);
    setPendingConfirmation(null);

    if (typeof statusMessage !== "undefined") {
      setNavigationStatus(statusMessage);
    }
  }, []);

  const executeNavigation = React.useCallback(
    (
      route: string,
      options?: {
        delayMs?: number;
        statusMessage?: string;
      }
    ) => {
      const validation = validateNavigationRoute(route, roleContext);
      if (!validation.isValid || !validation.route) {
        setNavigationIssue(`Navigation blocked: ${validation.reason}.`);
        setIsTransitioning(false);
        return false;
      }

      const safeRoute = validation.route;
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }

      setNavigationIssue(null);
      setPendingConfirmation(null);

      const delayMs = options?.delayMs ?? 0;
      const navigateNow = () => {
        navigationTimerRef.current = null;
        setIsTransitioning(false);
        setNavigationStatus(null);
        clearNavigationState();

        const currentPath = pathname || null;
        if (currentPath && currentPath !== safeRoute) {
          previousRouteRef.current = currentPath;
        }
        lastNavigationRouteRef.current = safeRoute;
        router.push(safeRoute);
      };

      if (delayMs > 0) {
        setIsTransitioning(true);
        setNavigationStatus(options?.statusMessage ?? tChorui("takingYouTo", { label: toNavigationLabel(safeRoute) }));
        navigationTimerRef.current = window.setTimeout(navigateNow, delayMs);
        return true;
      }

      setNavigationStatus(options?.statusMessage ?? tChorui("opening", { label: toNavigationLabel(safeRoute) }));
      navigateNow();
      return true;
    },
    [clearNavigationState, pathname, roleContext, router, tChorui]
  );

  const handleChoiceNavigation = React.useCallback(
    (choice: NavigationChoice) => {
      void executeNavigation(choice.route, {
        delayMs: 0,
        statusMessage: tChorui("opening", { label: choice.label }),
      });
    },
    [executeNavigation, tChorui]
  );

  React.useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  React.useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
        navigationTimerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    const previousRouteValidation = validateNavigationRoute(navigationMeta?.previous_route, roleContext);
    if (previousRouteValidation.isValid && previousRouteValidation.route) {
      previousRouteRef.current = previousRouteValidation.route;
    }

    const lastRouteValidation = validateNavigationRoute(navigationMeta?.last_navigation_route, roleContext);
    if (lastRouteValidation.isValid && lastRouteValidation.route) {
      lastNavigationRouteRef.current = lastRouteValidation.route;
    }
  }, [navigationMeta, roleContext]);

  React.useEffect(() => {
    if (!navigationAction) {
      return;
    }

    if (navigationAction.reason === "navigation_correction_detected") {
      cancelPendingNavigation(tChorui("navigationCancelled"));
      setNavigationIssue(null);
      clearNavigationState();
      return;
    }

    if (navigationAction.type === "undo") {
      const undoCandidate =
        navigationAction.route ||
        navigationMeta?.previous_route ||
        previousRouteRef.current ||
        lastNavigationRouteRef.current;
      const undoValidation = validateNavigationRoute(undoCandidate, roleContext);

      if (!undoValidation.isValid || !undoValidation.route) {
        setNavigationIssue("Unable to safely go back from this context. Please choose a safe destination below.");
        setNavigationStatus(tChorui("safeOptions"));
        setPendingConfirmation(null);
        setIsTransitioning(false);
        return;
      }

      setNavigationIssue(null);
      setIsTransitioning(false);
      setPendingConfirmation({
        route: undoValidation.route,
        label: toNavigationLabel(undoValidation.route),
      });
      setNavigationStatus("Do you want to go back to your previous page?");
      return;
    }

    if (navigationAction.type === "clarify" || navigationAction.type === "suggest") {
      const missingParamsText =
        navigationAction.type === "clarify" && navigationAction.missing_params.length > 0
          ? ` ${tChorui("iNeed", { value: navigationAction.missing_params.join(", ") })}`
          : "";

      setNavigationIssue(null);
      setPendingConfirmation(null);
      setIsTransitioning(false);
      setNavigationStatus(
        navigationAction.type === "clarify"
          ? `${tChorui("needOneDetail")}${missingParamsText}`
          : tChorui("safeOptions")
      );
      return;
    }

    if (navigationAction.type === "navigate") {
      const routeValidation = validateNavigationRoute(navigationAction.route, roleContext);
      if (!routeValidation.isValid || !routeValidation.route) {
        setNavigationIssue(`I could not open that destination safely (${routeValidation.reason}).`);
        setNavigationStatus(tChorui("safeOptions"));
        setPendingConfirmation(null);
        setIsTransitioning(false);
        return;
      }

      const confidence = Number(navigationAction.confidence || 0);
      const destinationLabel = toNavigationLabel(routeValidation.route);
      const requiresConfirmation =
        navigationAction.requires_confirmation ||
        (confidence >= CONFIRM_NAVIGATION_CONFIDENCE && confidence < AUTO_NAVIGATION_CONFIDENCE);

      if (confidence < CONFIRM_NAVIGATION_CONFIDENCE) {
        setNavigationIssue(null);
        setPendingConfirmation(null);
        setIsTransitioning(false);
        setNavigationStatus(tChorui("safeOptions"));
        return;
      }

      if (requiresConfirmation) {
        cancelPendingNavigation();
        setNavigationIssue(null);
        setPendingConfirmation({
          route: routeValidation.route,
          label: destinationLabel,
        });
        setNavigationStatus(`I can open ${destinationLabel}. Do you want me to continue?`);
        return;
      }

      void executeNavigation(routeValidation.route, {
        delayMs: clampNavigationDelay(navigationAction.delay_ms),
        statusMessage: tChorui("takingYouTo", { label: destinationLabel }),
      });
      return;
    }

    if (navigationAction.type === "none") {
      setNavigationIssue(null);
      setPendingConfirmation(null);
      setIsTransitioning(false);
      if (navigationChoices.length > 0) {
        setNavigationStatus(tChorui("chooseNext"));
      } else if (navigationMemory?.pending_intent && navigationMemory.missing_params.length > 0) {
        setNavigationStatus(tChorui("iNeed", { value: navigationMemory.missing_params.join(", ") }));
      } else {
        setNavigationStatus(null);
      }
    }
  }, [
    cancelPendingNavigation,
    clearNavigationState,
    executeNavigation,
    navigationAction,
    navigationChoices.length,
    navigationMemory,
    navigationMeta?.previous_route,
    roleContext,
    tChorui,
  ]);

  return (
    <section className="relative rounded-3xl border border-border/70 bg-card/70 p-3 shadow-surface backdrop-blur-md md:p-4">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br from-primary/10 via-transparent to-accent/20" />

      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-border/60 bg-background/35 p-3 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[clamp(1.4rem,2.4vw,2rem)] font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                {isDoctorMode ? tChorui("titleDoctor") : tChorui("titlePatient")}
              </h1>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-inter)" }}>
                {isDoctorMode
                  ? tChorui("subtitleDoctor")
                  : tChorui("subtitlePatient")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground/90">{tChorui("mode", { mode: contextMode })}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={() => setHistoryOpen(true)}
              aria-label={tChorui("openConversationHistory")}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          <ChoruiVapiVoiceControl roleContext={roleContext} patientId={patientId || defaultPatientId} />

          {historyOpen ? (
            <div className="absolute inset-0 z-20 rounded-3xl border border-border/70 bg-background/95 p-3 backdrop-blur-sm md:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">{tChorui("conversationHistory")}</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setHistoryOpen(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">{tChorui("closeHistory")}</span>
                </Button>
              </div>

              <div className="mb-3">
                <Button
                  type="button"
                  variant="medical"
                  size="sm"
                  onClick={() => {
                    startNewConversation();
                    setHistoryOpen(false);
                  }}
                >
                  New Conversation
                </Button>
              </div>

              <div className="no-scrollbar max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {conversationsLoading ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center py-2">
                      <MedoraLoader size="sm" label="Loading conversations..." />
                    </div>
                    <CardSkeleton className="h-16" />
                    <CardSkeleton className="h-16" />
                  </div>
                ) : conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved conversations yet.</p>
                ) : (
                  conversations.map((conversation) => (
                    <div
                      key={conversation.conversation_id}
                      className="w-full rounded-xl border border-border/60 bg-card/70 p-3 hover:border-primary/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => {
                            void openConversation(conversation.conversation_id);
                            setHistoryOpen(false);
                          }}
                        >
                          <p className="mb-1 text-xs text-muted-foreground" suppressHydrationWarning>
                            {formatConversationTimestamp(conversation.updated_at)}
                          </p>
                          <p className="line-clamp-2 text-sm text-foreground">
                            {conversation.last_message || "No preview available"}
                          </p>
                          {conversation.patient_ref ? (
                            <p className="mt-1 text-xs text-primary">Patient ID: {conversation.patient_ref}</p>
                          ) : null}
                        </button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={deletingConversationId === conversation.conversation_id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteConversation(conversation.conversation_id);
                          }}
                          aria-label="Delete conversation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div
            ref={scrollRef}
            className="no-scrollbar h-96 overflow-y-auto rounded-2xl border border-border/60 bg-background/40 p-3 md:h-112 md:p-4"
          >
            <div className="space-y-3">
              {messages.map((message) => {
                const isUser = message.role === "user";
                return (
                  <div key={message.id} className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
                    {!isUser ? (
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Brain className="h-4 w-4" />
                      </div>
                    ) : null}

                    <div
                      className={[
                        "max-w-[85%] rounded-2xl px-4 py-3",
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-card/85 text-foreground border border-border/60",
                      ].join(" ")}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                      {!isUser && message.navigation && message.navigation.length > 0 ? (
                        <div className="mt-3 flex flex-col gap-2">
                          {message.navigation.map((suggestion) => (
                            <Link
                              key={`${message.id}-${suggestion.path}`}
                              href={suggestion.path}
                              className="group flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-left transition-colors hover:border-primary/60 hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-primary">
                                  {suggestion.label}
                                </p>
                                {suggestion.description ? (
                                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                                    {suggestion.description}
                                  </p>
                                ) : null}
                              </div>
                              <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          ))}
                        </div>
                      ) : null}

                      <div className={`mt-2 flex items-center gap-1 text-[0.68rem] ${isUser ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {message.failed ? <AlertTriangle className="h-3 w-3" /> : null}
                        <span suppressHydrationWarning>{formatChatTime(message.timestamp)}</span>
                      </div>
                    </div>

                    {isUser ? (
                      <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <UserRound className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {loading ? (
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ButtonLoader className="h-4 w-4 text-primary" />
                      Thinking...
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form
            className="mt-4"
            onSubmit={(event) => {
              event.preventDefault();
              cancelPendingNavigation(null);
              setNavigationIssue(null);
              void submitMessage();
            }}
          >
            <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-background/70 p-2">
              <Input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Type your response here..."
                disabled={loading}
                className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
                style={{ fontFamily: "var(--font-inter)" }}
              />
              <Button
                type="submit"
                size="icon"
                variant="medical"
                disabled={loading || !input.trim()}
                className="h-10 w-10 rounded-xl"
              >
                <SendHorizontal className="h-4 w-4" />
                <span className="sr-only">Send message</span>
              </Button>
            </div>
          </form>

          {navigationStatus || navigationIssue || pendingConfirmation || navigationChoices.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-border/60 bg-background/65 p-3">
              {navigationStatus ? (
                <p className="text-xs text-foreground">{navigationStatus}</p>
              ) : null}

              {isTransitioning ? (
                <p className="mt-1 text-[0.72rem] text-muted-foreground">Preparing safe navigation...</p>
              ) : null}

              {navigationIssue ? (
                <p className="mt-2 text-xs text-destructive">{navigationIssue}</p>
              ) : null}

              {pendingConfirmation ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="medical"
                    onClick={() => {
                      void executeNavigation(pendingConfirmation.route, {
                        delayMs: 0,
                        statusMessage: tChorui("opening", { label: pendingConfirmation.label }),
                      });
                    }}
                  >
                    Yes, continue
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => cancelPendingNavigation("Navigation paused. Tell me where to go next.")}
                  >
                    Cancel
                  </Button>
                </div>
              ) : null}

              {navigationChoices.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {navigationChoices.map((choice) => (
                    <Button
                      key={choice.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleChoiceNavigation(choice)}
                    >
                      {choice.label}
                    </Button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-foreground">
              <p>{error}</p>
              <Button variant="ghost" size="sm" onClick={() => void retryLastMessage()}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>

        <div className="lg:col-span-5">
          <ChoruiSummaryPanel
            data={structuredData}
            loading={loading}
            saving={saving}
            saveState={saveState}
            roleContext={roleContext}
            onDataChange={updateStructuredData}
            onConfirmSave={confirmAndSave}
          />
        </div>
      </div>
    </section>
  );
}
