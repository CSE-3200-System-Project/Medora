"use client";

import dynamic from "next/dynamic";
import { memo, useMemo } from "react";
import type { EChartsOption } from "echarts";

import type { DemographicsData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

const ReactECharts = dynamic(() => import("@/components/charts/echarts-core"), { ssr: false });

type DemographicsSectionProps = {
  data: DemographicsData;
  isLoading?: boolean;
};

export const DemographicsSection = memo(function DemographicsSection({ data, isLoading = false }: DemographicsSectionProps) {
  const pieOption = useMemo<EChartsOption>(
    () => ({
      series: [
        {
          type: "pie",
          radius: ["60%", "90%"],
          center: ["50%", "50%"],
          padAngle: 2,
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: { borderWidth: 0 },
          data: data.segments.map((segment) => ({
            value: segment.value,
            name: segment.label,
            itemStyle: { color: segment.color },
          })),
          animationDuration: 600,
        },
      ],
    }),
    [data.segments],
  );

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
            <ReactECharts option={pieOption} style={{ height: "100%", width: "100%" }} />
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
