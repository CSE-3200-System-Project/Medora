"use client";

import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PatientChartsPayload } from "./types";

type PatientChartsProps = {
  charts: PatientChartsPayload;
  labels: {
    growthTitle: string;
    statusTitle: string;
    totalLabel: string;
  };
};

export function PatientCharts({ charts, labels }: PatientChartsProps) {
  const total = charts.distribution.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{labels.growthTitle}</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={charts.growth} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="registrations"
                stroke="hsl(var(--primary))"
                strokeWidth={4}
                dot={false}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm transition-shadow hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{labels.statusTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3">
          <div className="mx-auto h-48 w-full max-w-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts.distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {charts.distribution.map((item) => (
                    <Cell key={item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-border/60 p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{total.toLocaleString()}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{labels.totalLabel}</p>
          </div>

          <ul className="space-y-2 text-sm">
            {charts.distribution.map((item) => (
              <li key={item.name} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-foreground">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-semibold text-muted-foreground">{item.value}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}
