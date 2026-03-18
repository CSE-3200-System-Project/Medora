"use client";

import * as React from "react";
import { AlertCircle, BellRing } from "lucide-react";

import { AdherenceHeatmap, HeatmapDay } from "@/components/analytics/AdherenceHeatmap";
import { AdherenceStats } from "@/components/analytics/AdherenceStats";
import { MedicationItem, MedicationStatus } from "@/components/analytics/MedicationTimelineItem";
import { MissedDoseChart, MissedDosePoint } from "@/components/analytics/MissedDoseChart";
import { SmartInsight } from "@/components/analytics/SmartInsight";
import { TodaySchedule } from "@/components/analytics/TodaySchedule";
import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/ui/navbar";
import { getReminders } from "@/lib/reminder-actions";

const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DailyDoseSummary = {
  date: Date;
  taken: number;
  total: number;
};

export type AnalyticsReminder = {
  id: string;
  item_name: string;
  reminder_times: string[];
  days_of_week: number[];
  notes?: string;
};

type AnalyticsDashboardProps = {
  initialReminders?: AnalyticsReminder[];
  initialLoadError?: string | null;
};

export default function AnalyticsDashboard({
  initialReminders = [],
  initialLoadError = null,
}: AnalyticsDashboardProps) {
  const [reminders, setReminders] = React.useState<AnalyticsReminder[]>(initialReminders);
  const [loadError, setLoadError] = React.useState<string | null>(initialLoadError);
  const [statusOverrides, setStatusOverrides] = React.useState<Record<string, MedicationStatus>>({});
  const [clock, setClock] = React.useState(() => new Date());
  const [hideDueAlert, setHideDueAlert] = React.useState(false);

  React.useEffect(() => {
    let isDisposed = false;

    const syncReminders = async () => {
      try {
        const data = await getReminders({ type_filter: "medication", active_only: true });
        if (isDisposed) {
          return;
        }

        const nextReminders: AnalyticsReminder[] = data.reminders.map((reminder) => ({
          id: reminder.id,
          item_name: reminder.item_name,
          reminder_times: reminder.reminder_times ?? [],
          days_of_week: reminder.days_of_week ?? [0, 1, 2, 3, 4, 5, 6],
          notes: reminder.notes,
        }));

        setReminders(nextReminders);
        setLoadError(null);
      } catch {
        if (!isDisposed) {
          setLoadError("Unable to refresh live reminders right now.");
        }
      }
    };

    const reminderInterval = window.setInterval(syncReminders, 60_000);
    const clockInterval = window.setInterval(() => setClock(new Date()), 30_000);
    void syncReminders();

    return () => {
      isDisposed = true;
      window.clearInterval(reminderInterval);
      window.clearInterval(clockInterval);
    };
  }, []);

  const medications = React.useMemo(() => {
    const currentDate = new Date(clock);
    const activeDayIndex = getMondayBasedDayIndex(currentDate);
    const currentMinutes = currentDate.getHours() * 60 + currentDate.getMinutes();

    const schedule: Array<{ item: MedicationItem; timeMinutes: number }> = [];

    for (const reminder of reminders) {
      const days = reminder.days_of_week.length > 0 ? reminder.days_of_week : [0, 1, 2, 3, 4, 5, 6];
      if (!days.includes(activeDayIndex)) {
        continue;
      }

      reminder.reminder_times.forEach((rawTime, index) => {
        const parsedMinutes = parseHHMMToMinutes(rawTime);
        if (parsedMinutes === null) {
          return;
        }

        const doseId = `${reminder.id}-${rawTime}-${index}`;
        const computedStatus = getComputedStatus(parsedMinutes, currentMinutes);

        schedule.push({
          item: {
            id: doseId,
            name: reminder.item_name,
            dose: reminder.notes,
            time: formatTimeFromHHMM(rawTime),
            status: statusOverrides[doseId] ?? computedStatus,
          },
          timeMinutes: parsedMinutes,
        });
      });
    }

    return schedule.sort((left, right) => left.timeMinutes - right.timeMinutes).map((entry) => entry.item);
  }, [clock, reminders, statusOverrides]);

  const dueMedication = React.useMemo(
    () => medications.find((item) => item.status === "due" || item.status === "snoozed") ?? null,
    [medications],
  );

  const dailySummaries = React.useMemo<DailyDoseSummary[]>(() => {
    const now = new Date(clock);
    const baseline = Array.from({ length: 30 }, (_, index) => {
      const dayOffset = 29 - index;
      const date = addDays(now, -dayOffset);
      return { date, taken: 0, total: 0 };
    });

    baseline[baseline.length - 1] = {
      date: now,
      taken: medications.filter((item) => item.status === "taken").length,
      total: medications.length,
    };

    return baseline;
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

  const takeMedication = (id: string) => {
    setStatusOverrides((current) => ({
      ...current,
      [id]: "taken",
    }));
  };

  const skipMedication = (id: string) => {
    setStatusOverrides((current) => ({
      ...current,
      [id]: "skipped",
    }));
  };

  const remindMedication = (id: string) => {
    setStatusOverrides((current) => ({
      ...current,
      [id]: "due",
    }));

    setHideDueAlert(false);
  };

  const snoozeMedication = (id: string) => {
    setStatusOverrides((current) => ({
      ...current,
      [id]: "snoozed",
    }));

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

          {loadError ? (
            <Card className="border-destructive/30">
              <CardContent className="flex items-start gap-3 pt-4">
                <AlertCircle className="mt-0.5 h-5 w-5 text-destructive" />
                <p className="text-sm text-destructive">{loadError}</p>
              </CardContent>
            </Card>
          ) : null}

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

          <SmartInsight
            message={buildInsightMessage({
              total: medications.length,
              due: medications.filter((item) => item.status === "due" || item.status === "snoozed").length,
              skipped: medications.filter((item) => item.status === "skipped").length,
            })}
          />
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

function parseHHMMToMinutes(value: string): number | null {
  const [hourString, minuteString] = value.split(":");
  const hour = Number(hourString);
  const minute = Number(minuteString);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return hour * 60 + minute;
}

function formatTimeFromHHMM(value: string): string {
  const parsed = parseHHMMToMinutes(value);
  if (parsed === null) {
    return value;
  }

  const hours = Math.floor(parsed / 60);
  const minutes = parsed % 60;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getComputedStatus(scheduledMinutes: number, nowMinutes: number): MedicationStatus {
  if (nowMinutes >= scheduledMinutes && nowMinutes < scheduledMinutes + 60) {
    return "due";
  }

  if (nowMinutes >= scheduledMinutes + 60) {
    return "skipped";
  }

  return "upcoming";
}

function getMondayBasedDayIndex(currentDate: Date): number {
  return currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
}

function buildInsightMessage({ total, due, skipped }: { total: number; due: number; skipped: number }): string {
  if (total === 0) {
    return "No active medication reminders for today yet. Add reminders from Medical History to start live analytics tracking.";
  }

  if (skipped > 0) {
    return `${skipped} reminder${skipped > 1 ? "s" : ""} already missed today. Consider adjusting reminder times for better adherence.`;
  }

  if (due > 0) {
    return `${due} dose${due > 1 ? "s are" : " is"} due right now. Complete them to improve today's adherence score.`;
  }

  return "Great progress. All upcoming reminders are on track for today.";
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
