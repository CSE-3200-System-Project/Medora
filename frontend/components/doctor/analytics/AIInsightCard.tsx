"use client";

import { memo } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

import type { AIInsight } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type AIInsightCardProps = {
  insight: AIInsight;
  isLoading?: boolean;
};

export const AIInsightCard = memo(function AIInsightCard({ insight, isLoading = false }: AIInsightCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-40 animate-pulse")} />;
  }

  return (
    <article className="rounded-xl border border-primary/20 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-primary">{insight.title}</span>
        <span className="ml-auto rounded-full bg-primary/12 px-2 py-0.5 text-xs font-medium text-primary">
          {insight.badge}
        </span>
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground">{insight.description}</p>

      <button type="button" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        {insight.ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
});
