import { Card, CardContent } from "@/components/ui/card";
import type { PatientStatsSummary } from "@/components/admin/patients/types";

type PatientStatsProps = {
  stats: PatientStatsSummary;
  labels: {
    total: string;
    active: string;
    incomplete: string;
    banned: string;
  };
};

export function PatientStats({ stats, labels }: PatientStatsProps) {
  const items = [
    { label: labels.total, value: stats.total },
    { label: labels.active, value: stats.active },
    { label: labels.incomplete, value: stats.incomplete },
    { label: labels.banned, value: stats.banned },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="rounded-2xl border-border/60">
          <CardContent className="space-y-1 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
            <p className="text-2xl font-semibold text-foreground">{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
