"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PatientInsightsPayload } from "./types";

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
    <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="rounded-2xl bg-primary text-primary-foreground shadow-sm">
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-[0.12em]">{labels.todaysRegistrations}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{insights.todaysRegistrations}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl bg-amber-700 text-white shadow-sm">
        <CardHeader>
          <CardTitle className="text-xs uppercase tracking-[0.12em]">{labels.pendingReviews}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold">{insights.pendingReviews}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{labels.recentActivity}</CardTitle>
        </CardHeader>
        <CardContent>
          {insights.recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{labels.emptyActivity}</p>
          ) : (
            <ul className="space-y-3">
              {insights.recentActivity.slice(0, 5).map((entry) => (
                <li key={entry.id} className="text-sm">
                  <p className="text-foreground">{entry.message}</p>
                  <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
