import { Card, CardContent } from "@/components/ui/card";
import type { PatientInsightsPayload } from "@/components/admin/patients/types";

type InsightsPanelProps = {
  insights: PatientInsightsPayload;
  labels: {
    todaysRegistrations: string;
    pendingReviews: string;
    recentActivity: string;
    emptyActivity: string;
  };
};

export function InsightsPanel({ insights, labels }: InsightsPanelProps) {
  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.todaysRegistrations}</p>
          <p className="text-2xl font-semibold text-foreground">{insights.todaysRegistrations}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.pendingReviews}</p>
          <p className="text-2xl font-semibold text-foreground">{insights.pendingReviews}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.recentActivity}</p>
          {insights.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.emptyActivity}</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {insights.recentActivity.slice(0, 4).map((entry, index) => (
                <li key={entry.id || `${entry.message || "activity"}-${index}`}>
                  {entry.message || "-"}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
