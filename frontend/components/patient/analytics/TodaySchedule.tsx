import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MedicationItem, MedicationTimelineItem } from "@/components/patient/analytics/MedicationTimelineItem";

type TodayScheduleProps = {
  medications: MedicationItem[];
  onTake: (id: string) => void;
  onSkip: (id: string) => void;
  onRemind: (id: string) => void;
};

export function TodaySchedule({ medications, onTake, onSkip, onRemind }: TodayScheduleProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle className="text-xl">Today&apos;s Schedule</CardTitle>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <button type="button" className="rounded-md p-1 hover:bg-accent" aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span>Today</span>
          <button type="button" className="rounded-md p-1 hover:bg-accent" aria-label="Next day">
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
