import { Card, CardContent } from "@/components/ui/card";
import type { PatientChartsPayload } from "@/components/admin/patients/types";

type PatientChartsProps = {
  charts: PatientChartsPayload;
  labels: {
    growthTitle: string;
    statusTitle: string;
    totalLabel: string;
  };
};

export function PatientCharts({ charts, labels }: PatientChartsProps) {
  const totalDistribution = charts.distribution.reduce((sum, item) => sum + item.value, 0);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-foreground">{labels.growthTitle}</h2>
          {charts.growth.length === 0 ? (
            <p className="text-sm text-muted-foreground">-</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {charts.growth.map((point) => (
                <li key={`${point.name}-${point.value}`} className="flex items-center justify-between">
                  <span>{point.name}</span>
                  <span>{point.value}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold text-foreground">{labels.statusTitle}</h2>
          <ul className="space-y-1 text-sm text-foreground">
            {charts.distribution.map((item) => (
              <li key={`${item.name}-${item.value}`} className="flex items-center justify-between">
                <span>{item.name}</span>
                <span>{item.value}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {labels.totalLabel}: {totalDistribution}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
