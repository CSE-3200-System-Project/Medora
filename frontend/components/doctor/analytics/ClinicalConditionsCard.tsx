"use client";

import { memo } from "react";
import { Sparkles } from "lucide-react";

import type { ClinicalCondition } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

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
    return <div className={cn(glassCardClass, "h-82.5 animate-pulse p-6")} />;
  }

  return (
    <section className={cn(glassCardClass, "space-y-6 p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-foreground">Clinical Conditions</h3>

        <div className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          {alert}
        </div>
      </div>

      <div className="space-y-4">
        {conditions.map((item) => (
          <div key={item.name} className="flex items-center gap-4">
            <span className="w-32 text-sm text-muted-foreground">{item.name}</span>
            <div className="h-8 flex-1 overflow-hidden rounded-lg bg-muted">
              <div className="h-full bg-linear-to-r from-primary to-primary-light" style={{ width: `${item.percentage}%` }} />
            </div>
            <span className="w-12 text-lg font-semibold tabular-nums text-foreground">{item.count}</span>
          </div>
        ))}
      </div>
    </section>
  );
});
