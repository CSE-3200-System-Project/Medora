"use client";

import { memo } from "react";
import { Cell, Pie, PieChart } from "recharts";

import { SafeChartContainer } from "@/components/doctor/analytics/SafeChartContainer";
import type { DemographicsData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type DemographicsSectionProps = {
  data: DemographicsData;
  isLoading?: boolean;
};

export const DemographicsSection = memo(function DemographicsSection({ data, isLoading = false }: DemographicsSectionProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-80 animate-pulse p-4 sm:p-6")} />;
  }

  return (
    <section className={cn(glassCardClass, "flex h-full flex-col p-5 sm:p-6")}>
      <h3 className="mb-5 text-lg font-semibold text-foreground">Demographics</h3>

      <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:gap-8">
        {/* Age distribution — chart side */}
        <div className="flex shrink-0 flex-col items-center gap-3">
          <div className="relative h-40 w-40">
            <SafeChartContainer
              className="h-full w-full"
              minHeight={160}
              render={({ width, height }) => (
                <PieChart width={width} height={height}>
                  <Pie
                    data={data.segments}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={48}
                    outerRadius={72}
                    stroke="none"
                    paddingAngle={2}
                  >
                    {data.segments.map((segment) => (
                      <Cell key={segment.label} fill={segment.color} />
                    ))}
                  </Pie>
                </PieChart>
              )}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-bold tabular-nums text-foreground">{data.highlightedValue}%</span>
              <span className="text-xs font-medium text-muted-foreground">{data.highlightedLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {data.segments.map((segment) => (
              <span key={segment.label} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
                {segment.label}
              </span>
            ))}
          </div>
        </div>

        {/* Retention side */}
        <div className="flex flex-1 flex-col justify-center space-y-5">
          <h4 className="text-sm font-semibold text-foreground">Patient Retention</h4>

          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">New Patients</span>
              <span className="font-semibold tabular-nums text-primary">{data.newPatients}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.newPatients}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex justify-between text-sm">
              <span className="text-muted-foreground">Returning Patients</span>
              <span className="font-semibold tabular-nums text-primary-muted">{data.returningPatients}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary-muted transition-all" style={{ width: `${data.returningPatients}%` }} />
            </div>
          </div>

          <div className="border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">Retention trend</p>
            <p className="mt-0.5 text-base font-semibold text-foreground">{data.trendLabel}</p>
          </div>
        </div>
      </div>
    </section>
  );
});
