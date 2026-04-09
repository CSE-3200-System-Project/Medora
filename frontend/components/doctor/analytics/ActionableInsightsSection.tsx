"use client";

import { memo } from "react";
import { AlertTriangle, Boxes, DollarSign, Sparkles, Stethoscope } from "lucide-react";

import type { ActionableInsightCard } from "@/components/doctor/analytics/types";
import { cn } from "@/lib/utils";

type ActionableInsightsSectionProps = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  cards: ActionableInsightCard[];
  isLoading?: boolean;
};

function insightIcon(kind: ActionableInsightCard["kind"]) {
  if (kind === "warning") return AlertTriangle;
  if (kind === "primary") return DollarSign;
  if (kind === "tertiary") return Stethoscope;
  return Boxes;
}

function insightColors(kind: ActionableInsightCard["kind"]) {
  if (kind === "warning") return "bg-destructive/12 text-destructive";
  if (kind === "primary") return "bg-primary/12 text-primary";
  if (kind === "tertiary") return "bg-primary-muted/12 text-primary-muted";
  return "bg-muted text-muted-foreground";
}

export const ActionableInsightsSection = memo(function ActionableInsightsSection({
  title,
  subtitle,
  ctaLabel,
  cards,
  isLoading = false,
}: ActionableInsightsSectionProps) {
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary-muted"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {ctaLabel}
        </button>
      </div>

      {cards.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = insightIcon(card.kind);
            return (
              <article key={card.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="mb-2 flex items-center gap-2.5">
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", insightColors(card.kind))}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{card.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No actionable insights available yet.</p>
      )}
    </div>
  );
});
