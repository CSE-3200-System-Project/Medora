"use client";

import { memo } from "react";
import { Line, LineChart } from "recharts";

import type { AnalyticsMetric } from "@/components/doctor/analytics/types";
import { changeClass, glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type MetricsGridProps = {
  metrics: AnalyticsMetric[];
  isLoading?: boolean;
};

function MetricCardSkeleton() {
  return (
    <div className={cn(glassCardClass, "animate-pulse p-4 sm:p-5")}>
      <div className="mb-4 h-4 w-28 rounded bg-muted" />
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <div className="h-8 w-20 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="h-12 w-24 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

const MetricSparkline = memo(function MetricSparkline({
  metric,
  width = 96,
  height = 48,
  className,
}: {
  metric: AnalyticsMetric;
  width?: number;
  height?: number;
  className?: string;
}) {
  const chartData = metric.sparkline.map((value, index) => ({ index, value }));
  const stroke = metric.accent === "error" ? "#B91C1C" : metric.accent === "tertiary" ? "#1379B1" : "#0360D9";

  return (
    <div className={cn("rounded-lg bg-muted/50 p-1.5", className)}>
      <LineChart data={chartData} width={width} height={height}>
        <Line type="monotone" dataKey="value" strokeWidth={2} dot={false} stroke={stroke} />
      </LineChart>
    </div>
  );
});

export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className={cn(glassCardClass, "p-8 text-center")}>
        <p className="text-sm text-muted-foreground">No metric data available for this period.</p>
      </div>
    );
  }

  const primaryMetric = metrics[0];
  const secondaryMetrics = metrics.slice(1);

  return (
    <div className="space-y-5">
      {/* Primary metric — full width highlight card */}
      <article className={cn(glassCardClass, "p-5 sm:p-6")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{primaryMetric.subtitle}</p>
            <div className="flex flex-wrap items-baseline gap-3">
              <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                {primaryMetric.value}
              </p>
              <span className={cn("rounded-full px-2.5 py-0.5 text-sm font-semibold", changeClass(primaryMetric.changeDirection))}>
                {primaryMetric.changeLabel}
              </span>
            </div>
            <p className="text-base font-semibold text-foreground">{primaryMetric.label}</p>
          </div>
          <MetricSparkline metric={primaryMetric} width={160} height={72} className="shrink-0" />
        </div>
      </article>

      {/* Secondary metrics — responsive card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {secondaryMetrics.map((metric) => (
          <article
            key={metric.id}
            className={cn(
              glassCardClass,
              "flex flex-col justify-between p-4 transition-colors duration-150 hover:bg-muted/20 sm:p-5",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", changeClass(metric.changeDirection))}>
                {metric.changeLabel}
              </span>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-2xl font-bold tabular-nums text-foreground">{metric.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{metric.subtitle}</p>
              </div>
              <MetricSparkline metric={metric} width={88} height={48} className="shrink-0" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
