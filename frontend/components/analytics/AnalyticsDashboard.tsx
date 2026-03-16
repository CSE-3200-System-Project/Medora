"use client";

import * as React from "react";
import { BellRing } from "lucide-react";

import { AdherenceHeatmap, HeatmapDay } from "@/components/analytics/AdherenceHeatmap";
import { AdherenceStats } from "@/components/analytics/AdherenceStats";
import { MedicationItem } from "@/components/analytics/MedicationTimelineItem";
import { MissedDoseChart, MissedDosePoint } from "@/components/analytics/MissedDoseChart";
import { SmartInsight } from "@/components/analytics/SmartInsight";
import { TodaySchedule } from "@/components/analytics/TodaySchedule";
import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/ui/navbar";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DailyDoseSummary = {
  date: Date;
  taken: number;
  total: number;
};

const INITIAL_MEDICATIONS: MedicationItem[] = [
  { id: 1, name: "Lisinopril", dose: "10mg", time: "08:04 AM", status: "taken" },
  { id: 2, name: "Metformin", dose: "500mg", time: "01:00 PM", status: "due" },
  { id: 3, name: "Atorvastatin", dose: "20mg", time: "09:00 PM", status: "upcoming" },
];

export default function AnalyticsDashboard() {
  const [medications, setMedications] = React.useState<MedicationItem[]>(INITIAL_MEDICATIONS);
  const [hideDueAlert, setHideDueAlert] = React.useState(false);

  const dueMedication = React.useMemo(
    () => medications.find((item) => item.status === "due" || item.status === "snoozed") ?? null,
    [medications],
  );

  const dailySummaries = React.useMemo<DailyDoseSummary[]>(() => {
    const now = new Date();
    const generated = Array.from({ length: 30 }, (_, index) => {
      const dayOffset = 29 - index;
      const date = addDays(now, -dayOffset);
      const total = 3 + ((index + 1) % 2);
      const baselineMissed = index % 9 === 0 ? 2 : index % 4 === 0 ? 1 : 0;
      const taken = Math.max(0, total - baselineMissed);
      return { date, taken, total };
    });

    const todayTaken = medications.filter((item) => item.status === "taken").length;
    generated[generated.length - 1] = {
      date: now,
      taken: todayTaken,
      total: medications.length,
    };

    return generated;
  }, [medications]);

  const adherenceScore = React.useMemo(() => {
    const totals = dailySummaries.reduce(
      (acc, item) => {
        acc.taken += item.taken;
        acc.total += item.total;
        return acc;
      },
      { taken: 0, total: 0 },
    );

    if (totals.total === 0) {
      return 0;
    }

    return Math.round((totals.taken / totals.total) * 100);
  }, [dailySummaries]);

  const perfectDays = React.useMemo(
    () => dailySummaries.filter((item) => item.total > 0 && item.taken === item.total).length,
    [dailySummaries],
  );

  const currentStreak = React.useMemo(() => {
    let streak = 0;

    for (let index = dailySummaries.length - 1; index >= 0; index -= 1) {
      const day = dailySummaries[index];
      if (day.total > 0 && day.taken === day.total) {
        streak += 1;
      } else {
        break;
      }
    }

    return streak;
  }, [dailySummaries]);

  const heatmapDays = React.useMemo<HeatmapDay[]>(() => {
    const recentDays = dailySummaries.slice(-13).map((item) => ({
      id: formatDateId(item.date),
      dayNumber: item.date.getDate(),
      weekday: WEEKDAY_SHORT[item.date.getDay()],
      displayDate: formatDisplayDate(item.date),
      level: getHeatLevel(item),
    }));

    const futureDate = addDays(new Date(), 1);
    recentDays.push({
      id: `${formatDateId(futureDate)}-future`,
      dayNumber: futureDate.getDate(),
      weekday: WEEKDAY_SHORT[futureDate.getDay()],
      displayDate: formatDisplayDate(futureDate),
      level: "future",
    });

    return recentDays;
  }, [dailySummaries]);

  const missedDoseData = React.useMemo<MissedDosePoint[]>(() => {
    return dailySummaries.map((item) => ({
      label: `${item.date.getDate()} ${WEEKDAY_SHORT[item.date.getDay()]}`,
      missed: Math.max(0, item.total - item.taken),
    }));
  }, [dailySummaries]);

  const takeMedication = (id: number) => {
    setMedications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "taken",
            }
          : item,
      ),
    );
  };

  const skipMedication = (id: number) => {
    setMedications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "skipped",
            }
          : item,
      ),
    );
  };

  const remindMedication = (id: number) => {
    setMedications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "due",
            }
          : item,
      ),
    );

    setHideDueAlert(false);
  };

  const snoozeMedication = (id: number) => {
    setMedications((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "snoozed",
            }
          : item,
      ),
    );

    setHideDueAlert(true);
  };

  React.useEffect(() => {
    if (!dueMedication) {
      setHideDueAlert(false);
    }
  }, [dueMedication]);

  return (
    <AppBackground>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="space-y-8">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">Patient / Reminders</p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Medication &amp; Reminder Analytics
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Real-time adherence summary and performance indicators.
            </p>
          </section>

          <AdherenceStats
            adherenceScore={adherenceScore}
            perfectDays={perfectDays}
            activeMedications={medications.length}
            currentStreak={currentStreak}
          />

          <AdherenceHeatmap days={heatmapDays} />

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <MissedDoseChart data={missedDoseData} />
            <TodaySchedule
              medications={medications}
              onTake={takeMedication}
              onSkip={skipMedication}
              onRemind={remindMedication}
            />
          </section>

          <SmartInsight message="You tend to miss midday doses more often on weekends. Consider setting a weekend reminder for your afternoon medication." />
        </div>
      </main>

      {dueMedication && !hideDueAlert ? (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm rounded-2xl border border-primary/30 bg-background/95 p-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <BellRing className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Medication Due</p>
              <p className="mt-1 text-sm text-foreground">
                {dueMedication.name} {dueMedication.dose}
              </p>
              <p className="text-xs text-muted-foreground">Take now</p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={() => takeMedication(dueMedication.id)}>
                  Take
                </Button>
                <Button size="sm" variant="outline" onClick={() => snoozeMedication(dueMedication.id)}>
                  Snooze
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppBackground>
  );
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
}

function formatDateId(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDisplayDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getHeatLevel(day: DailyDoseSummary): HeatmapDay["level"] {
  if (day.total === 0) {
    return "future";
  }

  const adherence = day.taken / day.total;

  if (adherence >= 1) {
    return "perfect";
  }

  if (adherence >= 0.5) {
    return "partial";
  }

  return "missed";
}
