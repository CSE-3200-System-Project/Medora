"use client";

import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    return <div className={cn(glassCardClass, "h-95 animate-pulse p-8")} />;
  }

  return (
    <section className={cn(glassCardClass, "relative flex h-full flex-col overflow-hidden p-8")}>
      <div className="mb-8 flex items-center justify-between">
        <h3 className="font-bold text-foreground">Revenue Analysis</h3>
      </div>

      <div className="min-h-50 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data.series} margin={{ top: 12, right: 6, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0360D9" stopOpacity={0.4} />
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
            <Area type="monotone" dataKey="value" stroke="#b0c6ff" strokeWidth={3} fill="url(#revenueFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
          <p className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Total</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(data.total)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
          <p className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Pending</p>
          <p className="text-xl font-bold text-primary-muted">{formatCurrency(data.pending)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-surface/40 p-4">
          <p className="mb-1 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Avg/Visit</p>
          <p className="text-xl font-bold text-foreground">{formatCurrency(data.avgPerVisit)}</p>
        </div>
      </div>
    </section>
  );
});
