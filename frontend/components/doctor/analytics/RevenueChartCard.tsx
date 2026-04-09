"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { SafeChartContainer } from "@/components/doctor/analytics/SafeChartContainer";
import type { RevenueData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { cn } from "@/lib/utils";

type RevenueChartCardProps = {
  data: RevenueData;
  isLoading?: boolean;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export const RevenueChartCard = memo(function RevenueChartCard({ data, isLoading = false }: RevenueChartCardProps) {
  if (isLoading) {
    return <div className={cn(glassCardClass, "h-96 animate-pulse p-4 sm:p-6")} />;
  }

  const hasSeries = data.series.length > 0;

  return (
    <section className={cn(glassCardClass, "flex h-full flex-col p-5 sm:p-6")}>
      <h3 className="mb-5 text-lg font-semibold text-foreground">Revenue Analysis</h3>

      <div className="mb-5 h-52 sm:h-56">
        {hasSeries ? (
          <SafeChartContainer
            className="h-full"
            minHeight={208}
            render={({ width, height }) => (
              <AreaChart data={data.series} width={width} height={height} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0360D9" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0360D9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="rgba(140,144,160,0.18)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "#8c90a0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#8c90a0", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  formatter={(value) => (typeof value === "number" ? formatCurrency(value) : String(value ?? ""))}
                  contentStyle={{
                    background: "#161f34",
                    border: "1px solid rgba(176,198,255,0.25)",
                    borderRadius: "12px",
                    color: "#d9e2fe",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="value" stroke="#0360D9" strokeWidth={2.5} fill="url(#revenueFill)" />
              </AreaChart>
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl border border-border/60 bg-muted/25 text-sm text-muted-foreground">
            No revenue trend data available yet.
          </div>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(data.total)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Pending</p>
          <p className="text-lg font-bold tabular-nums text-primary-muted">{formatCurrency(data.pending)}</p>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Avg / visit</p>
          <p className="text-lg font-bold tabular-nums text-foreground">{formatCurrency(data.avgPerVisit)}</p>
        </div>
      </div>
    </section>
  );
});
