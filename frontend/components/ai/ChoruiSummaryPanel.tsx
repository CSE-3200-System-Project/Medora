"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, PencilLine, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { Textarea } from "@/components/ui/textarea";
import type { ChoruiRoleContext, ChoruiStructuredData } from "@/types/ai";

interface ChoruiSummaryPanelProps {
  data: ChoruiStructuredData;
  loading: boolean;
  saving: boolean;
  saveState: string | null;
  roleContext?: ChoruiRoleContext;
  onDataChange: (next: ChoruiStructuredData) => void;
  onConfirmSave: () => Promise<void> | void;
}

function toCommaSeparated(items: string[]) {
  return items.join(", ");
}

function fromCommaSeparated(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ChoruiSummaryPanel({
  data,
  loading,
  saving,
  saveState,
  roleContext = "patient",
  onDataChange,
  onConfirmSave,
}: ChoruiSummaryPanelProps) {
  const isDoctorMode = roleContext === "doctor";
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ChoruiStructuredData>(data);

  React.useEffect(() => {
    setDraft(data);
  }, [data]);

  const applyDraft = React.useCallback(() => {
    onDataChange(draft);
    setIsEditing(false);
  }, [draft, onDataChange]);

  return (
    <aside className="rounded-3xl border border-border/70 bg-card/75 p-5 md:p-6 shadow-surface backdrop-blur-md">
      <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p className="text-xs leading-relaxed">
          Assistant-generated draft. Verify each statement against the source record before using it clinically. The assistant cannot update the medical record automatically.
        </p>
      </div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
            Intake draft
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-inter)" }}>
            {isDoctorMode ? "Assistant context for review" : "Review and correct every extracted field before saving"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => {
            if (isEditing) {
              applyDraft();
              return;
            }
            setDraft(data);
            setIsEditing(true);
          }}
          disabled={loading || saving}
        >
          {isEditing ? <CheckCircle2 className="h-4 w-4" /> : <PencilLine className="h-4 w-4" />}
          {isEditing ? "Apply" : "Edit Data"}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-center py-1">
            <MedoraLoader size="sm" label="Loading summary..." />
          </div>
          <CardSkeleton className="h-10 rounded-xl" />
          <CardSkeleton className="h-10 rounded-xl" />
          <CardSkeleton className="h-10 rounded-xl" />
          <CardSkeleton className="h-3 rounded-full" />
        </div>
      ) : (
        <div className="space-y-5">
          <section>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Symptoms</p>
            {isEditing ? (
              <Textarea
                value={toCommaSeparated(draft.symptoms)}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    symptoms: fromCommaSeparated(event.target.value),
                  }))
                }
                className="min-h-22 rounded-2xl"
                placeholder="Example: Sharp abdominal pain, nausea"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.symptoms.length > 0 ? (
                  data.symptoms.map((symptom) => (
                    <span
                      key={symptom}
                      className="rounded-full bg-secondary/70 px-3 py-1.5 text-xs font-medium text-secondary-foreground"
                    >
                      {symptom}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No symptoms captured yet.</span>
                )}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Contextual Conditions</p>
            {isEditing ? (
              <Input
                value={toCommaSeparated(draft.conditions)}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    conditions: fromCommaSeparated(event.target.value),
                  }))
                }
                className="rounded-2xl"
                placeholder="Example: Post-prandial escalation, no fever"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {data.conditions.length > 0 ? (
                  data.conditions.map((condition) => (
                    <span
                      key={condition}
                      className="rounded-full bg-accent/90 px-3 py-1.5 text-xs font-medium text-accent-foreground"
                    >
                      {condition}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No contextual conditions yet.</span>
                )}
              </div>
            )}
          </section>

          <section>
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Duration</p>
            {isEditing ? (
              <Input
                value={draft.duration}
                onChange={(event) => setDraft((prev) => ({ ...prev, duration: event.target.value }))}
                className="rounded-2xl"
                placeholder="Example: 3 days"
              />
            ) : (
              <p className="text-lg font-medium text-foreground">{data.duration || "Not specified"}</p>
            )}
          </section>
        </div>
      )}

      <div className="mt-7 space-y-3">
        <Button
          variant="medical"
          className="w-full rounded-2xl text-sm font-semibold"
          disabled={loading || saving}
          onClick={() => {
            if (isEditing) {
              applyDraft();
            }
            void onConfirmSave();
          }}
        >
          <Save className="h-4 w-4" />
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <ButtonLoader className="h-4 w-4" />
              Saving...
            </span>
          ) : isDoctorMode ? "Apply Summary" : "Confirm & Save"}
        </Button>

        {saveState ? (
          <p className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">{saveState}</p>
        ) : null}
      </div>
    </aside>
  );
}
