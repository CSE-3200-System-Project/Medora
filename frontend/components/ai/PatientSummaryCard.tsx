"use client";

import React from "react";
import { AlertTriangle, Info, Pill } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { getAIPatientSummary, type PatientSummaryResponse } from "@/lib/ai-consultation-actions";

interface PatientSummaryCardProps {
  patientId: string;
  fallbackData?: {
    chronic_conditions?: string[];
    medications?: Array<{ name?: string; dosage?: string; frequency?: string }>;
    drug_allergies?: Array<{ drug_name?: string; reaction?: string }>;
    allergies?: string;
  };
}

interface SummaryState {
  loading: boolean;
  error: string | null;
  data: PatientSummaryResponse | null;
}

function buildFallbackRaw(fallbackData?: PatientSummaryCardProps["fallbackData"]) {
  const conditions = fallbackData?.chronic_conditions ?? [];
  const medications =
    fallbackData?.medications?.map((item) => {
      const name = item.name ?? "Unknown medication";
      const dose = item.dosage ? ` ${item.dosage}` : "";
      const frequency = item.frequency ? ` (${item.frequency})` : "";
      return `${name}${dose}${frequency}`;
    }) ?? [];

  const allergies = [
    ...(fallbackData?.drug_allergies?.map((item) => {
      if (!item.drug_name) return null;
      return item.reaction ? `${item.drug_name} (${item.reaction})` : item.drug_name;
    }) ?? []),
    fallbackData?.allergies || null,
  ].filter((value): value is string => Boolean(value));

  return {
    conditions,
    medications,
    allergies,
    risk_flags: [],
  };
}

export function PatientSummaryCard({ patientId, fallbackData }: PatientSummaryCardProps) {
  const [state, setState] = React.useState<SummaryState>({
    loading: true,
    error: null,
    data: null,
  });
  const [showRawData, setShowRawData] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const result = await getAIPatientSummary(patientId);
        if (!isMounted) return;
        setState({ loading: false, error: null, data: result });
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : "Failed to load AI summary";
        setState({ loading: false, error: message, data: null });
      }
    }

    loadSummary();
    return () => {
      isMounted = false;
    };
  }, [patientId]);

  const fallbackRaw = buildFallbackRaw(fallbackData);
  const raw = state.data?.raw_data ?? { ...fallbackRaw, patient_id: patientId };
  const summary = state.data?.summary;

  const conditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  const medications = Array.isArray(raw.medications) ? raw.medications : [];
  const allergies = Array.isArray(raw.allergies) ? raw.allergies : [];
  const riskFlags = Array.isArray(raw.risk_flags) ? raw.risk_flags : [];

  return (
    <Card className="rounded-2xl border-border/70 bg-card/90 shadow-surface backdrop-blur-sm">
      <CardHeader className="card-padding pb-4">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-xl text-foreground">Patient Summary</CardTitle>
          <Badge className="bg-primary/20 text-primary border-primary/30">AI-generated</Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span title="AI-generated summary. Verify before use.">
            <Info className="h-3.5 w-3.5" />
          </span>
          <span>AI-generated summary. Verify before use.</span>
        </div>
      </CardHeader>

      <CardContent className="card-padding pt-0 space-y-5">
        {state.loading ? (
          <div className="space-y-4">
            <div className="skeleton h-5 w-32" />
            <div className="skeleton h-10 w-full rounded-xl" />
            <div className="skeleton h-10 w-full rounded-xl" />
            <div className="skeleton h-10 w-full rounded-xl" />
          </div>
        ) : (
          <>
            {state.error ? (
              <p className="text-sm text-muted-foreground">
                AI summary unavailable. Showing patient data fallback.
              </p>
            ) : null}

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Conditions</p>
              <div className="flex flex-wrap gap-2">
                {conditions.length > 0 ? (
                  conditions.map((condition) => (
                    <Badge key={condition} variant="secondary" className="bg-secondary/60">
                      {condition}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No conditions listed</span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Medications</p>
              <div className="space-y-2">
                {medications.length > 0 ? (
                  medications.map((medication) => (
                    <div
                      key={medication}
                      className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm"
                    >
                      <Pill className="h-4 w-4 text-primary" />
                      <span>{medication}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No medication data</span>
                )}
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Allergies</p>
              {allergies.length > 0 ? (
                <div className="space-y-2">
                  {allergies.map((allergy) => (
                    <div
                      key={allergy}
                      className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <AlertTriangle className="h-4 w-4" />
                      <span>{allergy}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No known allergies</span>
              )}
            </section>

            <section className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Risk Flags</p>
              {riskFlags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {riskFlags.map((risk) => (
                    <Badge key={risk} className="bg-warning/20 text-warning-foreground border-warning/40">
                      {risk}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">No high-risk flags detected</span>
              )}
            </section>

            {showRawData ? (
              <section className="rounded-xl border border-border/60 bg-background/70 p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">Raw Data</p>
                <pre className="max-h-44 overflow-auto text-xs text-foreground/90">
                  {JSON.stringify(summary ?? raw, null, 2)}
                </pre>
              </section>
            ) : null}
          </>
        )}

        <div className="flex items-center justify-between border-t border-border/60 pt-3">
          <span className="text-sm text-muted-foreground">View Raw Data</span>
          <Switch checked={showRawData} onCheckedChange={setShowRawData} />
        </div>
      </CardContent>
    </Card>
  );
}
