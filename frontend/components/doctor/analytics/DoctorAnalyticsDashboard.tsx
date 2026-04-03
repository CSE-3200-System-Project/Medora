"use client";

import { memo, useState } from "react";
import dynamic from "next/dynamic";

import { AnalyticsHeader } from "@/components/doctor/analytics/AnalyticsHeader";
import { AIInsightCard } from "@/components/doctor/analytics/AIInsightCard";
import { ClinicalConditionsCard } from "@/components/doctor/analytics/ClinicalConditionsCard";
import { AIPerformanceCard } from "@/components/doctor/analytics/AIPerformanceCard";
import { PatientOutcomesCard } from "@/components/doctor/analytics/PatientOutcomesCard";
import { ActionableInsightsSection } from "@/components/doctor/analytics/ActionableInsightsSection";
import { HeatmapCard } from "@/components/doctor/analytics/HeatmapCard";
import type { DateRangeOption, DoctorAnalyticsData } from "@/components/doctor/analytics/types";
import { glassCardClass } from "@/components/doctor/analytics/shared";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { cn } from "@/lib/utils";

const ChartSkeleton = ({ className }: { className?: string }) => (
  <div className={cn(glassCardClass, "animate-pulse", className)} />
);

const MetricsGrid = dynamic(
  () => import("@/components/doctor/analytics/MetricsGrid").then((m) => m.MetricsGrid),
  { ssr: false, loading: () => <ChartSkeleton className="h-64 p-4 sm:p-6" /> },
);

const WorkloadAnalyticsSection = dynamic(
  () => import("@/components/doctor/analytics/WorkloadAnalyticsSection").then((m) => m.WorkloadAnalyticsSection),
  { ssr: false, loading: () => <ChartSkeleton className="h-96 p-4 sm:p-6" /> },
);

const DemographicsSection = dynamic(
  () => import("@/components/doctor/analytics/DemographicsSection").then((m) => m.DemographicsSection),
  { ssr: false, loading: () => <ChartSkeleton className="h-80 p-4 sm:p-6" /> },
);

const RevenueChartCard = dynamic(
  () => import("@/components/doctor/analytics/RevenueChartCard").then((m) => m.RevenueChartCard),
  { ssr: false, loading: () => <ChartSkeleton className="h-96 p-4 sm:p-6" /> },
);

const PrescriptionSafetyCard = dynamic(
  () => import("@/components/doctor/analytics/PrescriptionSafetyCard").then((m) => m.PrescriptionSafetyCard),
  { ssr: false, loading: () => <ChartSkeleton className="h-40" /> },
);

type DoctorAnalyticsDashboardProps = {
  initialData: DoctorAnalyticsData | null;
  initialError?: string | null;
  className?: string;
};

export const DoctorAnalyticsDashboard = memo(function DoctorAnalyticsDashboard({
  initialData,
  initialError = null,
  className,
}: DoctorAnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRangeOption>(initialData?.dateRange ?? "30d");
  const [comparePeriod, setComparePeriod] = useState<boolean>(initialData?.comparePeriod ?? false);
  const resolvedData = initialData;
  const error = initialError ?? (resolvedData ? null : "Unable to load analytics data at this moment.");
  const isLoading = false;

  return (
    <AppBackground className={cn("animate-page-enter", className)}>
      <Navbar />

      <main className="page-main max-w-6xl space-y-8 pb-12 sm:space-y-10">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : null}

        <AnalyticsHeader
          dateRange={dateRange}
          comparePeriod={comparePeriod}
          onDateRangeChange={setDateRange}
          onComparePeriodChange={setComparePeriod}
        />

        {/* ── Section 1: Key Metrics ── */}
        <section className="space-y-5">
          <SectionLabel title="Key Metrics" description="Core operational signals for immediate planning." />
          <MetricsGrid metrics={resolvedData?.metrics ?? []} isLoading={isLoading} />
        </section>

        {/* ── Section 2: Workload & AI Insight ── */}
        <section className="space-y-5">
          <SectionLabel title="Workload Overview" description="Scheduling patterns and AI-generated recommendations." />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
            <div className="lg:col-span-2">
              <WorkloadAnalyticsSection
                chart={resolvedData?.workload.chart ?? []}
                peakWindow={resolvedData?.workload.peakWindow ?? "09:00 - 11:30"}
                averagePatientsPerDay={resolvedData?.workload.averagePatientsPerDay ?? "28 / day"}
                burnoutRisk={resolvedData?.workload.burnoutRisk ?? "Moderate"}
                isLoading={isLoading}
              />
            </div>
            <div className="flex flex-col gap-5">
              <AIInsightCard
                insight={
                  resolvedData?.aiInsight ?? {
                    badge: "AI-generated",
                    title: "AI Insight",
                    description: "No insight data",
                    ctaLabel: "Review",
                  }
                }
                isLoading={isLoading}
              />
              <PatientOutcomesCard
                data={
                  resolvedData?.outcomes ?? {
                    recoveryProgress: 0,
                    recoveryTrendLabel: "No data",
                    repeatVisitProgress: 0,
                    repeatVisitLabel: "No data",
                    averageRecoveryTime: "-",
                    satisfaction: "-",
                  }
                }
                isLoading={isLoading}
              />
            </div>
          </div>
        </section>

        {/* ── Section 3: Revenue & Demographics ── */}
        <section className="space-y-5">
          <SectionLabel title="Revenue & Demographics" description="Financial trends, patient mix, and appointment volume." />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
            <RevenueChartCard
              data={
                resolvedData?.revenue ?? {
                  series: [],
                  total: 0,
                  pending: 0,
                  avgPerVisit: 0,
                }
              }
              isLoading={isLoading}
            />
            <DemographicsSection
              data={
                resolvedData?.demographics ?? {
                  highlightedLabel: "35-50 yrs",
                  highlightedValue: 0,
                  segments: [],
                  newPatients: 0,
                  returningPatients: 0,
                  trendLabel: "No trend data",
                }
              }
              isLoading={isLoading}
            />
          </div>
          <HeatmapCard data={resolvedData?.heatmap ?? { hours: [], days: [], values: [] }} isLoading={isLoading} />
        </section>

        {/* ── Section 4: Deep Dive ── */}
        <section className="space-y-5">
          <DeepDiveSection data={resolvedData} isLoading={isLoading} />
        </section>
      </main>
    </AppBackground>
  );
});

/* ── Shared sub-components ── */

function SectionLabel({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-lg font-bold tracking-tight text-foreground">{title}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

const DeepDiveSection = memo(function DeepDiveSection({
  data,
  isLoading,
}: {
  data: DoctorAnalyticsData | null;
  isLoading: boolean;
}) {
  const [expandedTertiarySection, setExpandedTertiarySection] = useState<string>("");

  return (
    <>
      <SectionLabel title="Deep Dive" description="Drill into clinical, safety, AI, and actionable details." />

      <div className="space-y-3">
        <Accordion
          type="single"
          collapsible
          value={expandedTertiarySection}
          onValueChange={(value) => setExpandedTertiarySection(value || "")}
          className="space-y-3"
        >
          <AccordionCard
            value="clinical-conditions"
            title="Clinical Conditions"
            description="Case concentration and condition-level alerts."
            isExpanded={expandedTertiarySection === "clinical-conditions"}
          >
            <ClinicalConditionsCard
              alert={data?.conditions.alert ?? "AI Alert"}
              conditions={data?.conditions.items ?? []}
              isLoading={isLoading}
            />
          </AccordionCard>

          <AccordionCard
            value="prescription-safety"
            title="Prescription Safety"
            description="Warning rates, blocked scripts, and override pressure."
            isExpanded={expandedTertiarySection === "prescription-safety"}
          >
            <PrescriptionSafetyCard
              data={
                data?.prescriptionSafety ?? {
                  score: 0,
                  safe: 0,
                  warning: 0,
                  blocked: 0,
                  overrideRate: 0,
                  status: "Unknown",
                }
              }
              isLoading={isLoading}
            />
          </AccordionCard>

          <AccordionCard
            value="ai-performance"
            title="AI Performance"
            description="Acceptance behavior and documentation productivity impact."
            isExpanded={expandedTertiarySection === "ai-performance"}
          >
            <AIPerformanceCard
              data={
                data?.aiPerformance ?? {
                  suggestions: 0,
                  accepted: 0,
                  modified: 0,
                  rejected: 0,
                  insightTitle: "No AI insight",
                  insightBody: "No data available.",
                }
              }
              isLoading={isLoading}
            />
          </AccordionCard>

          <AccordionCard
            value="actionable-insights"
            title="Actionable Insights"
            description="System recommendations for scheduling, revenue, and care outcomes."
            isExpanded={expandedTertiarySection === "actionable-insights"}
          >
            <ActionableInsightsSection
              title={data?.actionableInsights.title ?? "Smart Performance Optimization"}
              subtitle={data?.actionableInsights.subtitle ?? "No actionable insight data available yet."}
              ctaLabel={data?.actionableInsights.ctaLabel ?? "Apply Recommendations"}
              cards={data?.actionableInsights.cards ?? []}
              isLoading={isLoading}
            />
          </AccordionCard>
        </Accordion>
      </div>
    </>
  );
});

function AccordionCard({
  value,
  title,
  description,
  isExpanded,
  children,
}: {
  value: string;
  title: string;
  description: string;
  isExpanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm dark:bg-card"
    >
      <AccordionTrigger className="px-4 py-4 hover:bg-muted/30 hover:no-underline sm:px-6">
        <div className="text-left">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
        {isExpanded ? children : null}
      </AccordionContent>
    </AccordionItem>
  );
}
