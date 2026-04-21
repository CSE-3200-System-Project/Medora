import { BellRing, CheckCircle2, Clock3, MinusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/i18n/client";

export type MedicationStatus = "taken" | "due" | "upcoming" | "skipped" | "snoozed";

export type MedicationItem = {
  id: string;
  name: string;
  dose?: string;
  time: string;
  status: MedicationStatus;
};

type MedicationTimelineItemProps = {
  medication: MedicationItem;
  onTake: (id: string) => void;
  onSkip: (id: string) => void;
  onRemind: (id: string) => void;
};

export function MedicationTimelineItem({
  medication,
  onTake,
  onSkip,
  onRemind,
}: MedicationTimelineItemProps) {
  const tCommon = useT("common");

  return (
    <Card className="rounded-xl border-border/70 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <StatusIcon status={medication.status} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {medication.name}
              {medication.dose ? ` ${medication.dose}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">{getStatusText(medication, tCommon)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground">
            {medication.time}
          </span>

          {medication.status === "taken" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {tCommon("analytics.medicationItem.taken")}
            </span>
          ) : null}

          {medication.status === "skipped" ? (
            <Button size="sm" variant="outline" onClick={() => onTake(medication.id)}>
              {tCommon("analytics.medicationItem.markTaken")}
            </Button>
          ) : null}

          {medication.status === "due" || medication.status === "snoozed" ? (
            <>
              <Button size="sm" onClick={() => onTake(medication.id)}>
                {tCommon("analytics.medicationItem.take")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onSkip(medication.id)}>
                {tCommon("analytics.medicationItem.skip")}
              </Button>
            </>
          ) : null}

          {medication.status === "upcoming" ? (
            <Button size="sm" variant="outline" onClick={() => onRemind(medication.id)}>
              {tCommon("analytics.medicationItem.remind")}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function getStatusText(medication: MedicationItem, tCommon: ReturnType<typeof useT>) {
  if (medication.status === "taken") {
    return tCommon("analytics.medicationItem.takenAt", { time: medication.time });
  }

  if (medication.status === "due") {
    return tCommon("analytics.medicationItem.dueNow");
  }

  if (medication.status === "snoozed") {
    return tCommon("analytics.medicationItem.snoozed");
  }

  if (medication.status === "skipped") {
    return tCommon("analytics.medicationItem.skippedDose");
  }

  return tCommon("analytics.medicationItem.upcoming");
}

function StatusIcon({ status }: { status: MedicationStatus }) {
  if (status === "taken") {
    return <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />;
  }

  if (status === "due" || status === "snoozed") {
    return <BellRing className="mt-0.5 h-5 w-5 text-primary" />;
  }

  if (status === "skipped") {
    return <MinusCircle className="mt-0.5 h-5 w-5 text-rose-500" />;
  }

  return <Clock3 className="mt-0.5 h-5 w-5 text-muted-foreground" />;
}
