"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DailyWorkloadChartProps = {
  data: Array<{ day: string; patients: number }>;
  averageLabel: string;
};

export function DailyWorkloadChart({ data, averageLabel }: DailyWorkloadChartProps) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Daily Workload Distribution</CardTitle>
        <p className="text-xs text-muted-foreground">{averageLabel}</p>
      </CardHeader>
      <CardContent>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="4 4" stroke="rgba(148,163,184,0.25)" />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={24} />
              <Tooltip
                cursor={{ fill: "rgba(3,96,217,0.08)" }}
                contentStyle={{ borderRadius: 10, border: "1px solid rgba(148,163,184,0.3)" }}
              />
              <Bar dataKey="patients" radius={[10, 10, 0, 0]} fill="var(--primary)" maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
