"use client";

import * as React from "react";
import { AlertTriangle, Brain, Menu, SendHorizontal, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { ChoruiSummaryPanel } from "@/components/ai/ChoruiSummaryPanel";
import { useChoruiChat } from "@/hooks/useChoruiChat";
import type { ChoruiRoleContext } from "@/types/ai";

function formatChatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type ChoruiChatProps = {
  roleContext?: ChoruiRoleContext;
  defaultPatientId?: string;
};

export function ChoruiChat({ roleContext = "patient", defaultPatientId }: ChoruiChatProps) {
  const {
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
    contextMode,
  } = useChoruiChat({ roleContext, defaultPatientId });

  const isDoctorMode = roleContext === "doctor";
  const [historyOpen, setHistoryOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  return (
    <section className="relative rounded-3xl border border-border/70 bg-card/70 p-3 shadow-surface backdrop-blur-md md:p-4">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-linear-to-br from-primary/10 via-transparent to-accent/20" />

      <div className="relative grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-border/60 bg-background/35 p-3 md:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[clamp(1.4rem,2.4vw,2rem)] font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
                {isDoctorMode ? "Chorui AI for Clinical Workflow" : "Tell us about your health"}
              </h1>
              <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-inter)" }}>
                {isDoctorMode
                  ? "Summaries, context insights, and evidence-aware assistance for faster care coordination."
                  : "We will organize it for your doctor."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground/90">Mode: {contextMode}</p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl"
              onClick={() => setHistoryOpen(true)}
              aria-label="Open conversation history"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {historyOpen ? (
            <div className="absolute inset-0 z-20 rounded-3xl border border-border/70 bg-background/95 p-3 backdrop-blur-sm md:p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Conversation History</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setHistoryOpen(false)}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close history</span>
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
                          <p className="mb-1 text-xs text-muted-foreground">
                            {new Date(conversation.updated_at).toLocaleString([], {
                              year: "numeric",
                              month: "short",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
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
                      <div className={`mt-2 flex items-center gap-1 text-[0.68rem] ${isUser ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {message.failed ? <AlertTriangle className="h-3 w-3" /> : null}
                        <span>{formatChatTime(message.timestamp)}</span>
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
