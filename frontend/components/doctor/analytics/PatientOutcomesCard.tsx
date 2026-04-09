"use client";

import { memo } from "react";
import { Activity, Repeat2 } from "lucide-react";

import type { PatientOutcomeData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type PatientOutcomesCardProps = {
  data: PatientOutcomeData;
  isLoading?: boolean;
};

export const PatientOutcomesCard = memo(function PatientOutcomesCard({ data, isLoading = false }: PatientOutcomesCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-64 animate-pulse p-4 sm:p-5")} />;
  }

  return (
    <section className={cn(glassCardClass, "flex h-full flex-col p-5 sm:p-6")}>
      <h3 className="mb-4 text-lg font-semibold text-foreground">Patient Outcomes</h3>

      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Recovery Tracking</span>
                <span className="font-semibold tabular-nums text-primary">{data.recoveryTrendLabel}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.recoveryProgress}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
              <Repeat2 className="h-5 w-5 text-primary-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Repeat Visits</span>
                <span className="font-semibold tabular-nums text-primary-muted">{data.repeatVisitLabel}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary-muted transition-all" style={{ width: `${data.repeatVisitProgress}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Avg recovery time</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{data.averageRecoveryTime}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Satisfaction</p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{data.satisfaction}</p>
          </div>
        </div>
      </div>
    </section>
  );
});
