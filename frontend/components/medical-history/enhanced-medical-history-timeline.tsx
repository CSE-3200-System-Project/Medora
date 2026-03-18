/**
 * Enhanced Medical History Timeline Component
 * Displays aggregated medical events in a vertical centered timeline with filtering
 */

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import {
  aggregateTimelineEvents,
  groupTimelineEventsByYear,
} from "./timeline-utils";
import { TimelineYearGroup } from "./timeline-year-group";
import { TimelineFilters } from "./timeline-filters";
import type { Medication } from "@/components/medicine";
import type { Surgery } from "./surgery-manager";
import type { Hospitalization } from "./hospitalization-manager";
import type { Vaccination } from "./vaccination-manager";
import type { Prescription } from "@/lib/prescription-actions";

interface EnhancedMedicalHistoryTimelineProps {
  surgeries: Surgery[];
  hospitalizations: Hospitalization[];
  vaccinations: Vaccination[];
  medications: Medication[];
  appointments: any[];
  medicalTests?: Array<{
    test_name: string;
    test_date: string;
    result: string;
    status: string;
    prescribing_doctor: string;
    hospital_lab: string;
    notes: string;
  }>;
  doctorPrescriptions?: Prescription[];
  title?: string;
  description?: string;
}

export const EnhancedMedicalHistoryTimeline = React.memo(
  function EnhancedMedicalHistoryTimeline({
    surgeries,
    hospitalizations,
    vaccinations,
    medications,
    appointments,
    medicalTests = [],
    doctorPrescriptions = [],
    title = "Medical Timeline",
    description = "Chronological view of your medical history",
  }: EnhancedMedicalHistoryTimelineProps) {
    const [selectedYear, setSelectedYear] = useState<string>("all");
    const [upcomingOnly, setUpcomingOnly] = useState(false);

    // Aggregate all events
    const allEvents = useMemo(() => {
      const events = aggregateTimelineEvents({
        surgeries,
        hospitalizations,
        vaccinations,
        medications,
        appointments,
        medicalTests,
        doctorPrescriptions,
      });
      return events;
    }, [surgeries, hospitalizations, vaccinations, medications, appointments, medicalTests, doctorPrescriptions]);

    const years = useMemo(() => {
      return Array.from(new Set(allEvents.map((event) => new Date(event.date).getFullYear().toString())))
        .sort((a, b) => parseInt(b) - parseInt(a));
    }, [allEvents]);

    const selectedYearEventCount = useMemo(() => {
      if (selectedYear === "all") {
        return allEvents.length;
      }
      return allEvents.filter(
        (event) => new Date(event.date).getFullYear().toString() === selectedYear
      ).length;
    }, [allEvents, selectedYear]);

    // Combined filters: year + upcoming
    const filteredEvents = useMemo(() => {
      const now = new Date();
      return allEvents.filter((event) => {
        const eventDate = new Date(event.date);
        const yearMatch = selectedYear === "all" || eventDate.getFullYear().toString() === selectedYear;
        const upcomingMatch = !upcomingOnly || eventDate.getTime() > now.getTime();
        return yearMatch && upcomingMatch;
      });
    }, [allEvents, selectedYear, upcomingOnly]);

    // Group events by year
    const eventsByYear = useMemo(() => {
      const grouped = groupTimelineEventsByYear(filteredEvents);
      // Sort years in descending order (newest first)
      const sorted = Object.entries(grouped).sort(([a], [b]) => parseInt(b) - parseInt(a));
      return Object.fromEntries(sorted);
    }, [filteredEvents]);

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <TimelineFilters
          selectedYear={selectedYear}
          years={years}
          selectedYearEventCount={selectedYearEventCount}
          upcomingOnly={upcomingOnly}
          onYearChange={setSelectedYear}
          onUpcomingChange={setUpcomingOnly}
        />

        {filteredEvents.length > 0 ? (
          <div className="space-y-8">
            {Object.entries(eventsByYear).map(([year, yearEvents]) => (
              <TimelineYearGroup key={year} year={year} events={yearEvents} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <div className="mb-4 flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
              </div>
              <p className="font-medium text-foreground">No medical events found for this filter.</p>
            </CardContent>
          </Card>
        )}
        </div>
    );
  }
);

EnhancedMedicalHistoryTimeline.displayName = "EnhancedMedicalHistoryTimeline";

export const MedicalTimeline = EnhancedMedicalHistoryTimeline;
