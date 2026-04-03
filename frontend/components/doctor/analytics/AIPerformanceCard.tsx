"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

import type { AIPerformanceData } from "@/components/doctor/analytics/types";

type AIPerformanceCardProps = {
  data: AIPerformanceData;
  isLoading?: boolean;
};

export const AIPerformanceCard = memo(function AIPerformanceCard({ data, isLoading = false }: AIPerformanceCardProps) {
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  const suggestionsLabel = data.suggestions >= 1000
    ? `${(data.suggestions / 1000).toFixed(1)}k`
    : String(data.suggestions);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{suggestionsLabel}</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Suggestions</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-primary">{data.accepted}%</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Accepted</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-foreground">{data.modified}%</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Modified</p>
        </div>
        <div className="rounded-lg bg-muted/40 p-3 text-center">
          <p className="text-xl font-bold tabular-nums text-destructive">{data.rejected}%</p>
          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Rejected</p>
        </div>
      </div>

      <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {data.insightTitle}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{data.insightBody}</p>
      </div>
    </div>
  );
});
