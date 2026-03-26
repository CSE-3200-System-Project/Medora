"use client";

import { memo } from "react";
import { AlertTriangle, Boxes, DollarSign, Sparkles, Stethoscope } from "lucide-react";

import type { ActionableInsightCard } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
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
  if (kind === "warning") return "bg-destructive/15 text-destructive";
  if (kind === "primary") return "bg-primary/15 text-primary";
  if (kind === "tertiary") return "bg-primary-muted/15 text-primary-muted";
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
    return <section className={cn(glassCardClass, "h-85 animate-pulse p-8")} />;
  }

  return (
    <section className={cn(glassCardClass, "group relative overflow-hidden p-8")}>
      <div className="absolute inset-0 bg-linear-to-br from-primary/5 to-transparent" />

      <div className="relative z-10 flex flex-col items-center gap-12 md:flex-row">
        <div className="space-y-4 md:w-1/3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold tracking-wide text-primary uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Actionable Insights
          </div>

          <h2 className="text-4xl leading-tight font-extrabold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>

          <button type="button" className="rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary-muted active:scale-95">
            {ctaLabel}
          </button>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:w-2/3 md:grid-cols-2">
          {cards.map((card) => {
            const Icon = insightIcon(card.kind);
            return (
              <article key={card.id} className={cn(glassCardClass, "p-6")}>
                <div className="mb-4 flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-full", insightColors(card.kind))}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-bold text-foreground">{card.title}</span>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{card.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
});
