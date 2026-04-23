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
  const recentActivity = Array.isArray(insights?.recentActivity) ? insights.recentActivity : [];
  const todaysRegistrations = insights?.todaysRegistrations ?? 0;
  const pendingReviews = insights?.pendingReviews ?? 0;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.todaysRegistrations}</p>
          <p className="text-2xl font-semibold text-foreground">{todaysRegistrations}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.pendingReviews}</p>
          <p className="text-2xl font-semibold text-foreground">{pendingReviews}</p>
        </CardContent>
      </Card>
      <Card className="rounded-2xl border-border/60">
        <CardContent className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{labels.recentActivity}</p>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.emptyActivity}</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {recentActivity.slice(0, 4).map((entry, index) => (
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
