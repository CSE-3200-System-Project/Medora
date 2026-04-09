"use client";

import * as React from "react";
import { CheckCircle2, PencilLine, Save } from "lucide-react";

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

  const severityPercent = Math.max(0, Math.min(100, (data.severity / 10) * 100));

  const applyDraft = React.useCallback(() => {
    onDataChange({
      ...draft,
      severity: Math.max(0, Math.min(10, Math.round(draft.severity))),
    });
    setIsEditing(false);
  }, [draft, onDataChange]);

  return (
    <aside className="rounded-3xl border border-border/70 bg-card/75 p-5 md:p-6 shadow-surface backdrop-blur-md">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground" style={{ fontFamily: "var(--font-manrope)" }}>
            Clinical Summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground" style={{ fontFamily: "var(--font-inter)" }}>
            {isDoctorMode ? "Editable assistant context fields" : "Editable AI-extracted intake fields"}
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

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Severity Index</p>
              <span className="text-sm font-semibold text-foreground">{data.severity}/10</span>
            </div>
            {isEditing ? (
              <Input
                type="range"
                min={0}
                max={10}
                step={1}
                value={draft.severity}
                onChange={(event) => setDraft((prev) => ({ ...prev, severity: Number(event.target.value) }))}
                className="h-10 min-h-0 rounded-xl border-0 px-0 shadow-none"
              />
            ) : (
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted/70">
                <div className="h-full rounded-full bg-primary transition-[width] duration-(--motion-duration-base) ease-(--motion-ease-standard)" style={{ width: `${severityPercent}%` }} />
              </div>
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
