"use client";

import { memo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { DemographicsData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type DemographicsSectionProps = {
  data: DemographicsData;
  isLoading?: boolean;
};

export const DemographicsSection = memo(function DemographicsSection({ data, isLoading = false }: DemographicsSectionProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-90 animate-pulse p-6")} />;
  }

  return (
    <section className={cn(glassCardClass, "grid grid-cols-1 gap-8 p-6 lg:grid-cols-2")}>
      <div className="space-y-6">
        <h3 className="font-bold text-foreground">Age Distribution</h3>

        <div className="mx-auto h-44 w-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.segments}
                dataKey="value"
                nameKey="label"
                innerRadius={55}
                outerRadius={82}
                stroke="none"
                paddingAngle={2}
              >
                {data.segments.map((segment) => (
                  <Cell key={segment.label} fill={segment.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{data.highlightedValue}%</p>
          <p className="text-[10px] tracking-widest text-muted-foreground uppercase">{data.highlightedLabel}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          {data.segments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="font-bold text-foreground">Patient Retention</h3>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">New Patients</span>
            <span className="font-bold text-primary">{data.newPatients}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${data.newPatients}%` }} />
          </div>
        </div>

        <div>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">Returning Patients</span>
            <span className="font-bold text-primary-muted">{data.returningPatients}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary-muted" style={{ width: `${data.returningPatients}%` }} />
          </div>
        </div>

        <div className="border-t border-border/80 pt-4">
          <p className="mb-1 text-xs text-muted-foreground">Retention Trend</p>
          <p className="text-lg font-semibold text-foreground">{data.trendLabel}</p>
        </div>
      </div>
    </section>
  );
});
