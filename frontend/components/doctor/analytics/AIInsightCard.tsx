"use client";

import { memo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import type { AIInsight } from "@/components/doctor/analytics/types";
import { tertiaryCardClass } from "@/components/doctor/analytics/shared";

type AIInsightCardProps = {
  insight: AIInsight;
  isLoading?: boolean;
};

export const AIInsightCard = memo(function AIInsightCard({ insight, isLoading = false }: AIInsightCardProps) {
  if (isLoading) {
    return <div className={`${tertiaryCardClass} h-52 animate-pulse p-6`} />;
  }

  return (
    <article className={`${tertiaryCardClass} p-6`}>
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-base font-semibold text-primary">{insight.title}</span>
        <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
          {insight.badge}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{insight.description}</p>

      <button type="button" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        {insight.ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
});
