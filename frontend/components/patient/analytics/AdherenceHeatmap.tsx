import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/i18n/client";

export type HeatmapLevel = "perfect" | "partial" | "missed" | "future";

export type HeatmapDay = {
  id: string;
  weekday: string;
  dayNumber: number;
  displayDate: string;
  level: HeatmapLevel;
};

type AdherenceHeatmapProps = {
  days: HeatmapDay[];
};

const LEVEL_STYLES: Record<HeatmapLevel, string> = {
  perfect: "bg-emerald-500 text-white",
  partial: "bg-amber-400 text-amber-950",
  missed: "bg-rose-500 text-white",
  future: "bg-muted text-muted-foreground",
};

export function AdherenceHeatmap({ days }: AdherenceHeatmapProps) {
  const tCommon = useT("common");
  const weekdayLabels = [
    tCommon("analytics.weekdays.mon"),
    tCommon("analytics.weekdays.tue"),
    tCommon("analytics.weekdays.wed"),
    tCommon("analytics.weekdays.thu"),
    tCommon("analytics.weekdays.fri"),
    tCommon("analytics.weekdays.sat"),
    tCommon("analytics.weekdays.sun"),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl">{tCommon("analytics.adherenceHeatmap.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:gap-3">
          {weekdayLabels.map((weekday) => (
            <span key={weekday} className="text-center">
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {days.map((day) => {
            const label = tCommon(`analytics.adherenceHeatmap.levelLabels.${day.level}`);
            return (
              <div key={day.id} className="group relative">
                <div
                  title={`${day.displayDate} - ${label}`}
                  className={`flex aspect-square min-h-12 items-center justify-center rounded-xl border border-border/50 text-sm font-semibold transition-transform duration-150 group-hover:scale-[1.02] sm:min-h-14 ${LEVEL_STYLES[day.level]}`}
                >
                  {day.dayNumber}
                </div>
                <div className="pointer-events-none absolute -top-12 left-1/2 hidden w-max -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md group-hover:block">
                  <p>{day.displayDate}</p>
                  <p>{label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <LegendDot className="bg-emerald-500" label={tCommon("analytics.adherenceHeatmap.legend.perfect")} />
          <LegendDot className="bg-amber-400" label={tCommon("analytics.adherenceHeatmap.legend.partial")} />
          <LegendDot className="bg-rose-500" label={tCommon("analytics.adherenceHeatmap.legend.missed")} />
          <LegendDot className="bg-muted" label={tCommon("analytics.adherenceHeatmap.legend.future")} />
        </div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  );
}
