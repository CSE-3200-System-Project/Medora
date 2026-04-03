"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

import type { ClinicalCondition } from "@/components/doctor/analytics/types";

type ClinicalConditionsCardProps = {
  alert: string;
  conditions: ClinicalCondition[];
  isLoading?: boolean;
};

export const ClinicalConditionsCard = memo(function ClinicalConditionsCard({
  alert,
  conditions,
  isLoading = false,
}: ClinicalConditionsCardProps) {
  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
        <Sparkles className="h-3 w-3" />
        {alert}
      </div>

      {conditions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No clinical condition data available.</p>
      ) : (
        <div className="space-y-3">
          {conditions.map((item) => (
            <div key={item.name} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-sm text-muted-foreground">{item.name}</span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-primary/80 transition-all"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
              <span className="w-8 text-right text-sm font-semibold tabular-nums text-foreground">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
