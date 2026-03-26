"use client";

import React from "react";
import { Plus, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAIClinicalInfo, type ClinicalInfoResponse } from "@/lib/ai-consultation-actions";

type SuggestionType = "condition" | "test" | "medication";

interface AIAssistantPanelProps {
  patientId: string;
  notes: string;
  clinicalContext: string;
  onInsertSuggestion: (suggestion: {
    type: SuggestionType;
    text: string;
    confidence: number;
  }) => void;
}

function confidenceTone(confidence: number) {
  if (confidence >= 0.8) {
    return "bg-success/20 text-success-muted border-success/30";
  }
  if (confidence >= 0.6) {
    return "bg-warning/20 text-warning-foreground border-warning/40";
  }
  return "bg-muted text-muted-foreground border-border/60";
}

export function AIAssistantPanel({ patientId, notes, clinicalContext, onInsertSuggestion }: AIAssistantPanelProps) {
  const [data, setData] = React.useState<ClinicalInfoResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [triggerCount, setTriggerCount] = React.useState(0);

  const normalizedContext = clinicalContext.trim();
  const hasEnoughInput = normalizedContext.length >= 15;

  const fetchSuggestions = React.useCallback(async () => {
    if (!hasEnoughInput) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getAIClinicalInfo({
        patient_id: patientId,
        query: normalizedContext.slice(0, 2000),
        notes,
      });
      setData(response);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load AI assistant insights";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [hasEnoughInput, normalizedContext, patientId, notes]);

  React.useEffect(() => {
    if (!hasEnoughInput) return;
    const timer = setTimeout(() => {
      void fetchSuggestions();
    }, 800);
    return () => clearTimeout(timer);
  }, [hasEnoughInput, fetchSuggestions, triggerCount, normalizedContext]);

  const conditions = data?.suggested_conditions ?? [];
  const tests = data?.suggested_tests ?? [];
  const medications = data?.suggested_medications ?? [];

  return (
    <Card className="rounded-2xl border-border/70 bg-card/90 shadow-surface backdrop-blur-sm">
      <CardHeader className="card-padding pb-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xl text-foreground flex items-center gap-2">
            AI Assistant
            <span className="h-2 w-2 rounded-full bg-primary" />
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTriggerCount((prev) => prev + 1)}
            disabled={loading || !hasEnoughInput}
          >
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="card-padding pt-0 space-y-5">
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-20 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
          </div>
        ) : null}

        {!hasEnoughInput && !loading ? (
          <p className="text-sm text-muted-foreground">
            Add at least a short chief complaint, diagnosis, or note (15+ characters) to generate suggestions.
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!loading && hasEnoughInput ? (
          <>
            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Clinical Summary</p>
              <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="text-sm whitespace-pre-line text-foreground">{data?.answer || "No summary generated yet."}</p>
              </div>
            </section>

            {data?.cautions?.length ? (
              <section className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Helpful Notes</p>
                <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                  <ul className="space-y-1 text-sm text-foreground">
                    {data.cautions.map((caution) => (
                      <li key={caution}>- {caution}</li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Suggested Conditions</p>
              <div className="space-y-2">
                {conditions.length > 0 ? (
                  conditions.map((condition) => (
                    <div key={condition.name} className="rounded-xl border border-border/60 bg-background/70 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{condition.name}</p>
                        <Badge className={confidenceTone(condition.confidence)}>
                          {Math.round(condition.confidence * 100)}%
                        </Badge>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onInsertSuggestion({
                            type: "condition",
                            text: `Possible condition: ${condition.name}`,
                            confidence: condition.confidence,
                          })
                        }
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No condition suggestions yet.</p>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Suggested Tests</p>
              <div className="space-y-2">
                {tests.length > 0 ? (
                  tests.map((test) => (
                    <div key={test.name} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <p className="text-sm text-foreground">{test.name}</p>
                        <Badge className={confidenceTone(test.confidence)}>
                          {Math.round(test.confidence * 100)}%
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          onInsertSuggestion({
                            type: "test",
                            text: `Suggested test: ${test.name}`,
                            confidence: test.confidence,
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No test suggestions yet.</p>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Suggested Medications</p>
              <div className="space-y-2">
                {medications.length > 0 ? (
                  medications.map((medication) => (
                    <div key={medication.name} className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2">
                      <div>
                        <p className="text-sm text-foreground">{medication.name}</p>
                        <Badge className={confidenceTone(medication.confidence)}>
                          {Math.round(medication.confidence * 100)}%
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          onInsertSuggestion({
                            type: "medication",
                            text: `Suggested medication: ${medication.name}`,
                            confidence: medication.confidence,
                          })
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No medication suggestions yet.</p>
                )}
              </div>
            </section>
          </>
        ) : null}

        <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>AI suggestions are assistive only. Doctor must verify.</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

