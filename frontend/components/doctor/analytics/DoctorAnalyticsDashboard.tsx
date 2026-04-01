"use client";

import { memo, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

import { AnalyticsHeader } from "@/components/doctor/analytics/AnalyticsHeader";
import { MetricsGrid } from "@/components/doctor/analytics/MetricsGrid";
import { AIInsightCard } from "@/components/doctor/analytics/AIInsightCard";
import { ClinicalConditionsCard } from "@/components/doctor/analytics/ClinicalConditionsCard";
import { AIPerformanceCard } from "@/components/doctor/analytics/AIPerformanceCard";
import { PatientOutcomesCard } from "@/components/doctor/analytics/PatientOutcomesCard";
import { ActionableInsightsSection } from "@/components/doctor/analytics/ActionableInsightsSection";
import type { DateRangeOption, DoctorAnalyticsData } from "@/components/doctor/analytics/types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { cn } from "@/lib/utils";

const WorkloadAnalyticsSection = dynamic(
  () => import("@/components/doctor/analytics/WorkloadAnalyticsSection").then((module) => module.WorkloadAnalyticsSection),
  { ssr: false },
);
const HeatmapCard = dynamic(
  () => import("@/components/doctor/analytics/HeatmapCard").then((module) => module.HeatmapCard),
  { ssr: false },
);
const DemographicsSection = dynamic(
  () => import("@/components/doctor/analytics/DemographicsSection").then((module) => module.DemographicsSection),
  { ssr: false },
);
const PrescriptionSafetyCard = dynamic(
  () => import("@/components/doctor/analytics/PrescriptionSafetyCard").then((module) => module.PrescriptionSafetyCard),
  { ssr: false },
);
const RevenueChartCard = dynamic(
  () => import("@/components/doctor/analytics/RevenueChartCard").then((module) => module.RevenueChartCard),
  { ssr: false },
);

function SectionReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

type DoctorAnalyticsDashboardProps = {
  initialData: DoctorAnalyticsData | null;
  initialError?: string | null;
  className?: string;
};

const tertiaryAccordionTriggerClass =
  "rounded-md px-2 py-3 text-left transition-colors duration-200 hover:bg-muted/40 hover:no-underline motion-reduce:transition-none";

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
    <AppBackground className={cn("container-padding animate-page-enter", className)}>
      <Navbar />

      <main className="mx-auto max-w-6xl space-y-8 container-padding py-8 pt-(--nav-content-offset)">
        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
        ) : null}

        <SectionReveal delay={0.05}>
          <AnalyticsHeader
            dateRange={dateRange}
            comparePeriod={comparePeriod}
            onDateRangeChange={setDateRange}
            onComparePeriodChange={setComparePeriod}
          />
        </SectionReveal>

        <SectionReveal delay={0.1}>
          <section className="space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">Primary decision layer</p>
              <p className="text-sm text-muted-foreground">
                Operational signals for immediate planning and intervention decisions.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div className="space-y-6">
                <WorkloadAnalyticsSection
                  chart={resolvedData?.workload.chart ?? []}
                  peakWindow={resolvedData?.workload.peakWindow ?? "09:00 - 11:30"}
                  averagePatientsPerDay={resolvedData?.workload.averagePatientsPerDay ?? "28 / day"}
                  burnoutRisk={resolvedData?.workload.burnoutRisk ?? "Moderate"}
                  isLoading={isLoading}
                />
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
              </div>
              <MetricsGrid metrics={resolvedData?.metrics ?? []} isLoading={isLoading} />
            </div>
          </section>
        </SectionReveal>

        <SectionReveal delay={0.2}>
          <section className="space-y-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-primary">Secondary trend context</p>
              <p className="text-sm text-muted-foreground">
                Mid-term movement across patient mix, revenue flow, and appointment timing.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <div className="space-y-6">
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

              <div className="space-y-6">
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
                <HeatmapCard data={resolvedData?.heatmap ?? { hours: [], days: [], values: [] }} isLoading={isLoading} />
              </div>
            </div>
          </section>
        </SectionReveal>

        <SectionReveal delay={0.25}>
          <section className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-primary">Tertiary expandable details</p>
              <p className="text-sm text-muted-foreground">
                Drill into risk, AI utilization, and recommendations only when deeper review is needed.
              </p>
            </div>

            <Accordion
              type="single"
              collapsible
              className="rounded-xl border border-border/60 bg-background/80 px-3 py-1"
            >
              <AccordionItem value="clinical-conditions" className="border-border/60">
                <AccordionTrigger className={tertiaryAccordionTriggerClass}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-base font-semibold text-foreground">Clinical Conditions</p>
                    <p className="text-sm text-muted-foreground">Case concentration and condition-level alerts.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ClinicalConditionsCard
                    alert={resolvedData?.conditions.alert ?? "AI Alert"}
                    conditions={resolvedData?.conditions.items ?? []}
                    isLoading={isLoading}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="prescription-safety" className="border-border/60">
                <AccordionTrigger className={tertiaryAccordionTriggerClass}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-base font-semibold text-foreground">Prescription Safety</p>
                    <p className="text-sm text-muted-foreground">Warning rates, blocked scripts, and override pressure.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <PrescriptionSafetyCard
                    data={
                      resolvedData?.prescriptionSafety ?? {
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="ai-performance" className="border-border/60">
                <AccordionTrigger className={tertiaryAccordionTriggerClass}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-base font-semibold text-foreground">AI Performance</p>
                    <p className="text-sm text-muted-foreground">Acceptance behavior and documentation productivity impact.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <AIPerformanceCard
                    data={
                      resolvedData?.aiPerformance ?? {
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="actionable-insights" className="border-border/60">
                <AccordionTrigger className={tertiaryAccordionTriggerClass}>
                  <div className="space-y-0.5 text-left">
                    <p className="text-base font-semibold text-foreground">Actionable Insights</p>
                    <p className="text-sm text-muted-foreground">System recommendations for scheduling, revenue, and care outcomes.</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <ActionableInsightsSection
                    title={resolvedData?.actionableInsights.title ?? "Smart Performance Optimization"}
                    subtitle={resolvedData?.actionableInsights.subtitle ?? "No actionable insight data available yet."}
                    ctaLabel={resolvedData?.actionableInsights.ctaLabel ?? "Apply Recommendations"}
                    cards={resolvedData?.actionableInsights.cards ?? []}
                    isLoading={isLoading}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </SectionReveal>

      </main>

    </AppBackground>
  );
});
