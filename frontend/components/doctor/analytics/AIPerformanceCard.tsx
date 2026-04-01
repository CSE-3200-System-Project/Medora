"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

import type { AIPerformanceData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type AIPerformanceCardProps = {
  data: AIPerformanceData;
  isLoading?: boolean;
};

export const AIPerformanceCard = memo(function AIPerformanceCard({ data, isLoading = false }: AIPerformanceCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-80 animate-pulse p-8")} />;
  }

  return (
    <section className={cn(glassCardClass, "p-8")}>
      <div className="mb-8 flex items-center justify-between gap-4">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          AI Performance Metrics
        </h3>
        <span className="rounded bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
          Real-time sync
        </span>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-6 md:grid-cols-4">
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums text-foreground">{(data.suggestions / 1000).toFixed(1)}k</p>
          <p className="text-sm font-medium text-muted-foreground">Suggestions</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums text-primary">{data.accepted}%</p>
          <p className="text-sm font-medium text-muted-foreground">Accepted</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums text-foreground">{data.modified}%</p>
          <p className="text-sm font-medium text-muted-foreground">Modified</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold tabular-nums text-destructive">{data.rejected}%</p>
          <p className="text-sm font-medium text-muted-foreground">Rejected</p>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
        <p className="mb-1 text-base font-semibold text-foreground">{data.insightTitle}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{data.insightBody}</p>
      </div>
    </section>
  );
});
