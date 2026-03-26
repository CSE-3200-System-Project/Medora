import { Activity, Flame, Pill, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type AdherenceStatsProps = {
  adherenceScore: number;
  perfectDays: number;
  activeMedications: number;
  currentStreak: number;
};

export function AdherenceStats({
  adherenceScore,
  perfectDays,
  activeMedications,
  currentStreak,
}: AdherenceStatsProps) {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Adherence Score</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{adherenceScore}%</p>
              <p className="mt-1 text-xs text-success-muted">+2.5% from last week</p>
            </div>
            <Activity className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Perfect Days</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{perfectDays}</p>
              <p className="mt-1 text-xs text-success-muted">Last 30 days</p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Active Medications</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{activeMedications}</p>
              <p className="mt-1 text-xs text-muted-foreground">Scheduled for today</p>
            </div>
            <Pill className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Streak</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{currentStreak} days</p>
              <p className="mt-1 text-xs text-primary">Keep the momentum</p>
            </div>
            <Flame className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
