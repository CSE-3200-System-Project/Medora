"use client";

import { memo } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";

import type { AnalyticsMetric } from "@/components/doctor/analytics/types";
import { changeClass, glassCardClass, metricFillClass } from "@/components/doctor/analytics/shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

type MetricsGridProps = {
  metrics: AnalyticsMetric[];
  isLoading?: boolean;
};

const detailAccordionTriggerClass =
  "rounded-md px-2 py-3 transition-colors duration-200 hover:bg-muted/40 hover:no-underline motion-reduce:transition-none";

function MetricCardSkeleton() {
  return (
    <div className={cn(glassCardClass, "animate-pulse p-6")}>
      <div className="mb-5 flex items-start justify-between">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="h-6 w-20 rounded-full bg-muted" />
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="h-10 w-28 rounded bg-muted" />
          <div className="h-3 w-32 rounded bg-muted" />
        </div>
        <div className="h-16 w-32 rounded-lg bg-muted" />
      </div>
    </div>
  );
}

const MetricSparkline = memo(function MetricSparkline({
  metric,
  className,
}: {
  metric: AnalyticsMetric;
  className?: string;
}) {
  const chartData = metric.sparkline.map((value, index) => ({ index, value }));

  return (
    <div className={cn("rounded-lg bg-muted/70 p-2", className)}>
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
  );
});

export function MetricsGrid({ metrics, isLoading = false }: MetricsGridProps) {
  if (isLoading) {
    return (
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
        <div className={cn(glassCardClass, "h-56 animate-pulse")} />
      </section>
    );
  }

  if (metrics.length === 0) {
    return (
      <section className={cn(glassCardClass, "p-8 text-center")}>
        <p className="text-sm text-muted-foreground">No metric data available for this period.</p>
      </section>
    );
  }

  const primaryMetric = metrics[0];
  const contextualMetrics = metrics.slice(1, 6);

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <article className={cn(glassCardClass, "space-y-6 p-6 lg:p-7")}>
          <div className="space-y-2">
            <p className="text-sm font-semibold text-primary">Primary decision panel</p>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">{primaryMetric.label}</p>
                <p className="text-sm text-muted-foreground">{primaryMetric.subtitle}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-sm font-semibold", changeClass(primaryMetric.changeDirection))}>
                {primaryMetric.changeLabel}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr] sm:items-end">
            <div>
              <p className="text-4xl font-bold tracking-tight tabular-nums text-foreground lg:text-5xl">{primaryMetric.value}</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {primaryMetric.changeDirection === "down"
                  ? "Declining trajectory detected. Review schedules and intervention priority."
                  : "Current trend is favorable. Continue monitoring to sustain care quality and throughput."}
              </p>
            </div>
            <MetricSparkline metric={primaryMetric} className="h-20 sm:h-24" />
          </div>
        </article>

        <aside className={cn(glassCardClass, "space-y-4 p-6")}>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-primary">Secondary trend context</p>
            <p className="text-sm text-muted-foreground">Cross-signal metrics for short-term pattern tracking.</p>
          </div>

          <div className="space-y-3">
            {contextualMetrics.map((metric) => (
              <article
                key={metric.id}
                className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 transition-colors duration-200 hover:bg-muted/45 motion-reduce:transition-none"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">{metric.label}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none font-bold tabular-nums text-foreground">{metric.value}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-sm font-semibold", changeClass(metric.changeDirection))}>
                      {metric.changeLabel}
                    </span>
                  </div>
                </div>
                <MetricSparkline metric={metric} className="h-14 w-full" />
              </article>
            ))}
          </div>
        </aside>
      </div>

      <section className={cn(glassCardClass, "p-4 sm:p-6")}>
        <div className="mb-3">
          <p className="text-sm font-semibold text-primary">Tertiary expandable details</p>
          <p className="mt-1 text-sm text-muted-foreground">Deep metric diagnostics and raw trend traces.</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {metrics.map((metric) => (
            <AccordionItem key={metric.id} value={metric.id} className="border-border/60">
              <AccordionTrigger className={detailAccordionTriggerClass}>
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pr-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{metric.label}</p>
                    <p className="truncate text-sm text-muted-foreground">{metric.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tabular-nums text-foreground">{metric.value}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-sm font-semibold", changeClass(metric.changeDirection))}>
                      {metric.changeLabel}
                    </span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <MetricSparkline metric={metric} className="h-24" />
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">Trend points</p>
                    <div className="flex flex-wrap gap-1.5">
                      {metric.sparkline.map((point, index) => (
                        <span key={`${metric.id}-point-${index}`} className="rounded-md bg-muted px-2 py-1 text-sm font-medium tabular-nums text-muted-foreground">
                          {point}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </section>
  );
}
