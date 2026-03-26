import { CalendarCheck2, Clock3, RefreshCcw, UserPlus2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { MetricCard } from "@/components/doctor/doctor-appointments/types";

const ICONS = [CalendarCheck2, UserPlus2, Clock3, RefreshCcw] as const;

type ScheduleMetricsProps = {
  metrics: MetricCard[];
};

export function ScheduleMetrics({ metrics }: ScheduleMetricsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric, index) => {
        const Icon = ICONS[index];

        return (
          <Card key={metric.title} className="border-border/60 bg-card/95">
            <CardContent className="pt-5">
              <div className="flex items-start justify-between gap-3">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${metric.accentClass}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${metric.trendUp ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"}`}
                >
                  {metric.trend}
                </span>
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {metric.title}
              </p>
              <p className="mt-2 text-3xl font-bold text-foreground">{metric.value}</p>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
