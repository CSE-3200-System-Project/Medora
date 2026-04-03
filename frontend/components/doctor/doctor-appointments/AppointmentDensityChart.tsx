"use client";

import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { SafeChartContainer } from "@/components/doctor/analytics/SafeChartContainer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AppointmentDensityChartProps = {
  data: Array<{ time: string; density: number }>;
  deltaLabel: string;
};

export function AppointmentDensityChart({ data, deltaLabel }: AppointmentDensityChartProps) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Appointment Density</CardTitle>
        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{deltaLabel}</p>
      </CardHeader>
      <CardContent>
        <SafeChartContainer
          className="h-56 w-full"
          minHeight={224}
          render={({ width, height }) => (
            <LineChart data={data} width={width} height={height} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
              <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis hide domain={[0, "dataMax + 3"]} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: "1px solid rgba(148,163,184,0.3)" }}
                cursor={{ stroke: "rgba(3,96,217,0.2)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="density"
                stroke="var(--primary)"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 4, fill: "var(--primary)" }}
              />
            </LineChart>
          )}
        />
      </CardContent>
    </Card>
  );
}
