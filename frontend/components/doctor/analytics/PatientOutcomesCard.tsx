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
    return <div className={cn(glassCardClass, "h-80 animate-pulse p-8")} />;
  }

  return (
    <section className={cn(glassCardClass, "p-8")}>
      <h3 className="mb-8 text-lg font-semibold text-foreground">Patient Outcomes</h3>

      <div className="space-y-6">
        <div className="flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-end justify-between">
              <span className="font-semibold text-foreground">Recovery Tracking</span>
              <span className="font-semibold text-primary">{data.recoveryTrendLabel}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-linear-to-r from-primary to-primary-light" style={{ width: `${data.recoveryProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
            <Repeat2 className="h-8 w-8 text-primary-muted" />
          </div>
          <div className="flex-1">
            <div className="mb-1 flex items-end justify-between">
              <span className="font-semibold text-foreground">Repeat Visit Frequency</span>
              <span className="font-semibold text-primary-muted">{data.repeatVisitLabel}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary-muted" style={{ width: `${data.repeatVisitProgress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="rounded-xl bg-surface/40 p-4">
            <p className="mb-1 text-sm font-medium text-muted-foreground">Average recovery time</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{data.averageRecoveryTime}</p>
          </div>
          <div className="rounded-xl bg-surface/40 p-4">
            <p className="mb-1 text-sm font-medium text-muted-foreground">Patient satisfaction</p>
            <p className="text-2xl font-bold tabular-nums text-foreground">{data.satisfaction}</p>
          </div>
        </div>
      </div>
    </section>
  );
});
