"use client";

import { memo } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

import type { AnalyticsMetric } from "@/components/doctor/analytics/types";
import { changeClass, glassCardClass, metricFillClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type MetricsGridProps = {
  metrics: AnalyticsMetric[];
  isLoading?: boolean;
};

function MetricCardSkeleton() {
  return (
    <div className={cn(glassCardClass, "animate-pulse p-6") }>
      <div className="mb-4 flex items-start justify-between">
        <div className="h-4 w-28 rounded bg-muted" />
        <div className="h-5 w-16 rounded-full bg-muted" />
      </div>
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="h-8 w-24 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
        <div className="h-10 w-20 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

const MetricCard = memo(function MetricCard({ metric }: { metric: AnalyticsMetric }) {
  const chartData = metric.sparkline.map((value, index) => ({ index, value }));

  return (
    <article className={cn(glassCardClass, "group p-6 transition-all hover:border-primary/40")}>
      <div className="mb-4 flex items-start justify-between">
        <span className="font-medium text-muted-foreground">{metric.label}</span>
        <span className={cn("rounded-full px-2 py-1 text-xs font-bold", changeClass(metric.changeDirection))}>
          {metric.changeLabel}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold text-foreground">{metric.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{metric.subtitle}</p>
        </div>

        <div className="h-10 w-20 rounded-lg bg-muted/70 p-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                strokeWidth={2}
                dot={false}
                stroke={metric.accent === "error" ? "#B91C1C" : metric.accent === "tertiary" ? "#1379B1" : "#0360D9"}
                className={cn("drop-shadow-sm", metricFillClass(metric.accent))}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </article>
  );
});

export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return (
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <MetricCardSkeleton key={`metric-skeleton-${index}`} />
        ))}
      </section>
    );
  }

  if (metrics.length === 0) {
    return (
      <section className={cn(glassCardClass, "p-8 text-center") }>
        <p className="text-sm text-muted-foreground">No metric data available for this period.</p>
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  );
}
