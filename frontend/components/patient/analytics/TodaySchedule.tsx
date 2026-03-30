import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MedicationItem, MedicationTimelineItem } from "@/components/patient/analytics/MedicationTimelineItem";

type TodayScheduleProps = {
  medications: MedicationItem[];
  onTake: (id: string) => void;
  onSkip: (id: string) => void;
  onRemind: (id: string) => void;
};

export function TodaySchedule({ medications, onTake, onSkip, onRemind }: TodayScheduleProps) {
  const t = useTranslations("patientAnalytics.todaySchedule");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <button type="button" className="rounded-md p-1 hover:bg-accent" aria-label={t("previousDay")}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>{t("today")}</span>
          <button type="button" className="rounded-md p-1 hover:bg-accent" aria-label={t("nextDay")}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {medications.map((medication) => (
          <MedicationTimelineItem
            key={medication.id}
            medication={medication}
            onTake={onTake}
            onSkip={onSkip}
            onRemind={onRemind}
          />
        ))}
      </CardContent>
    </Card>
  );
}
