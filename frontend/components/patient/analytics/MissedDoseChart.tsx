"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/client";

export type MissedDosePoint = {
  label: string;
  missed: number;
};

type MissedDoseChartProps = {
  data: MissedDosePoint[];
};

export function MissedDoseChart({ data }: MissedDoseChartProps) {
  const tCommon = useT("common");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-xl">{tCommon("analytics.missedDoseChart.title")}</CardTitle>
        <Badge variant="secondary" className="rounded-full">
          {tCommon("analytics.missedDoseChart.last30Days")}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 8, left: -24, bottom: 2 }}>
              <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148, 163, 184, 0.25)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={24} />
              <Tooltip
                cursor={{ fill: "rgba(3, 96, 217, 0.08)" }}
                contentStyle={{ borderRadius: 12, border: "1px solid rgba(148, 163, 184, 0.35)" }}
              />
              <Bar dataKey="missed" radius={[10, 10, 0, 0]} fill="var(--primary)" maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
