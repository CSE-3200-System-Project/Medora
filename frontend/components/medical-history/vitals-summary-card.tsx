/**
 * Vitals Summary Card Component
 * Displays latest resting heart rate derived from the patient's own logged
 * health metrics, with a comparison against the previous week's average.
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, ArrowDownRight, ArrowUpRight, Heart, Minus } from "lucide-react";
import { getMetricTrends, type HealthMetricTrendPoint } from "@/lib/health-metrics-actions";

interface VitalsSummaryCardProps {
  patientData?: {
    blood_group?: string;
    height?: number;
    weight?: number;
  };
  medicalTests?: Array<{
    test_name: string;
    test_date: string;
    result: string;
    status: string;
  }>;
}

type VitalState = {
  value: number | null;
  weekDelta: number | null;
  lastMeasured: string | null;
  source: "metrics" | "tests" | null;
};

function extractHeartRateFromTests(
  tests: VitalsSummaryCardProps["medicalTests"],
): { value: number; date: string } | null {
  if (!tests || tests.length === 0) return null;
  const heartRateTests = tests
    .filter((test) => /heart[\s_-]?rate|resting|pulse|bpm/i.test(test.test_name || ""))
    .map((test) => {
      const rawValue = String(test.result || "").replace(/[^0-9.]/g, "");
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric) || numeric <= 0) return null;
      return { value: Math.round(numeric), date: test.test_date || "" };
    })
    .filter((item): item is { value: number; date: string } => item !== null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return heartRateTests[0] ?? null;
}

function computeDeltaPercent(points: HealthMetricTrendPoint[]): number | null {
  if (!points || points.length < 2) return null;
  const latestSlice = points.slice(-3);
  const earlierSlice = points.slice(0, Math.min(3, Math.max(1, points.length - 3)));
  const avg = (list: HealthMetricTrendPoint[]) =>
    list.reduce((sum, point) => sum + point.average_value, 0) / Math.max(1, list.length);
  const recent = avg(latestSlice);
  const baseline = avg(earlierSlice);
  if (!baseline) return null;
  return Number((((recent - baseline) / baseline) * 100).toFixed(1));
}

export const VitalsSummaryCard = React.memo(function VitalsSummaryCard({
  patientData: _patientData = {},
  medicalTests,
}: VitalsSummaryCardProps) {
  const [vital, setVital] = useState<VitalState>({
    value: null,
    weekDelta: null,
    lastMeasured: null,
    source: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const trends = await getMetricTrends({ metric_type: "heart_rate", days: 14 });
        const series = trends.trends.find((item) => item.metric_type === "heart_rate");
        const points = series?.points ?? [];
        if (points.length > 0) {
          const latest = points[points.length - 1];
          if (!cancelled) {
            setVital({
              value: Math.round(latest.average_value),
              weekDelta: computeDeltaPercent(points),
              lastMeasured: latest.date,
              source: "metrics",
            });
          }
          return;
        }
        const fallback = extractHeartRateFromTests(medicalTests);
        if (fallback && !cancelled) {
          setVital({
            value: fallback.value,
            weekDelta: null,
            lastMeasured: fallback.date,
            source: "tests",
          });
        }
      } catch {
        const fallback = extractHeartRateFromTests(medicalTests);
        if (fallback && !cancelled) {
          setVital({
            value: fallback.value,
            weekDelta: null,
            lastMeasured: fallback.date,
            source: "tests",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [medicalTests]);

  const trendDescriptor = useMemo(() => {
    if (vital.weekDelta === null) {
      return { icon: Minus, label: "Log more readings for a trend" };
    }
    if (Math.abs(vital.weekDelta) < 1) {
      return { icon: Minus, label: "Steady compared to earlier readings" };
    }
    if (vital.weekDelta < 0) {
      return { icon: ArrowDownRight, label: `${Math.abs(vital.weekDelta)}% lower than earlier` };
    }
    return { icon: ArrowUpRight, label: `${Math.abs(vital.weekDelta)}% higher than earlier` };
  }, [vital.weekDelta]);

  const lastMeasuredLabel = useMemo(() => {
    if (!vital.lastMeasured) return "No readings yet";
    const parsed = new Date(vital.lastMeasured);
    if (Number.isNaN(parsed.getTime())) return vital.lastMeasured;
    return `Last measured: ${parsed.toLocaleDateString()}`;
  }, [vital.lastMeasured]);

  const TrendIcon = trendDescriptor.icon;

  return (
    <Card className="rounded-2xl p-6 border border-border dark:border-border shadow-sm hover:shadow-md transition-shadow bg-linear-to-br from-primary to-blue-700 text-white">
      <CardHeader className="p-0 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="h-10 w-10 rounded-xl bg-card/20 flex items-center justify-center">
            <Heart className="h-5 w-5" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">{lastMeasuredLabel}</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <CardTitle className="text-base text-blue-50 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Resting Heart Rate
        </CardTitle>
        <div className="mt-3 flex items-end gap-2">
          <div className="text-5xl font-bold leading-none">
            {loading ? "--" : vital.value ?? "--"}
          </div>
          <span className="text-lg font-semibold text-blue-100 pb-1">BPM</span>
        </div>
        <div className="mt-4 flex items-center gap-2 text-sm text-blue-100">
          <TrendIcon className="h-4 w-4" />
          <span>
            {vital.value === null && !loading
              ? "Log heart rate in Analytics to see your resting BPM"
              : trendDescriptor.label}
          </span>
        </div>
        {vital.source === "tests" && vital.value !== null ? (
          <p className="mt-2 text-[11px] text-blue-100/80">Derived from latest lab test record</p>
        ) : null}
      </CardContent>
    </Card>
  );
});

VitalsSummaryCard.displayName = "VitalsSummaryCard";
