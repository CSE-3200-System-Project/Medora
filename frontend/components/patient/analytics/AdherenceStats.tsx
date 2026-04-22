import { Activity, Flame, Pill, Sparkles } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/i18n/client";

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
  const tCommon = useT("common");

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tCommon("analytics.adherenceStats.adherenceScore")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{adherenceScore}%</p>
              <p className="mt-1 text-xs text-success-muted">{tCommon("analytics.adherenceStats.fromLastWeek")}</p>
            </div>
            <Activity className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tCommon("analytics.adherenceStats.perfectDays")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{perfectDays}</p>
              <p className="mt-1 text-xs text-success-muted">{tCommon("analytics.adherenceStats.last30Days")}</p>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tCommon("analytics.adherenceStats.activeMedications")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{activeMedications}</p>
              <p className="mt-1 text-xs text-muted-foreground">{tCommon("analytics.adherenceStats.scheduledForToday")}</p>
            </div>
            <Pill className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{tCommon("analytics.adherenceStats.currentStreak")}</p>
              <p className="mt-2 text-3xl font-bold text-foreground">{tCommon("analytics.adherenceStats.currentStreakDays", { count: currentStreak })}</p>
              <p className="mt-1 text-xs text-primary">{tCommon("analytics.adherenceStats.keepMomentum")}</p>
            </div>
            <Flame className="h-5 w-5 text-primary" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
