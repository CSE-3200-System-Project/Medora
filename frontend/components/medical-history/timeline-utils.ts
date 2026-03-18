/**
 * Timeline utilities for aggregating and processing medical events
 */

import type { Medication } from "@/components/medicine";
import type { Surgery } from "./surgery-manager";
import type { Hospitalization } from "./hospitalization-manager";
import type { Vaccination } from "./vaccination-manager";
import type { Prescription } from "@/lib/prescription-actions";
import { parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";

export type TimelineEventType = 'consultation' | 'prescription' | 'lab-test' | 'imaging' | 'follow-up' | 'surgery' | 'hospitalization' | 'vaccination' | 'appointment';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  date: string; // ISO date string
  title: string;
  doctorName?: string;
  items?: string[]; // list of item names to show under "Show details"
  icon: string; // lucide icon name
  color: TimelineEventColor;
  badge?: string; // e.g., "Active", "Completed", "Pending"
}

export interface TimelineEventColor {
  bg: string; // Background color class
  text: string; // Text color class
  border?: string; // Border color class
}

// Color mapping for different event types
export const EVENT_COLOR_MAP: Record<TimelineEventType, TimelineEventColor> = {
  'consultation': {
    bg: 'bg-[#0360D9]/10',
    text: 'text-[#0360D9]',
    border: 'border-[#0360D9]/25'
  },
  'prescription': {
    bg: 'bg-[#10B981]/10',
    text: 'text-[#10B981]',
    border: 'border-[#10B981]/25'
  },
  'lab-test': {
    bg: 'bg-[#F43F5E]/10',
    text: 'text-[#F43F5E]',
    border: 'border-[#F43F5E]/25'
  },
  'imaging': {
    bg: 'bg-[#8B5CF6]/10',
    text: 'text-[#8B5CF6]',
    border: 'border-[#8B5CF6]/25'
  },
  'follow-up': {
    bg: 'bg-[#F59E0B]/10',
    text: 'text-[#F59E0B]',
    border: 'border-[#F59E0B]/25'
  },
  'surgery': {
    bg: 'bg-[#F59E0B]/10',
    text: 'text-[#F59E0B]',
    border: 'border-[#F59E0B]/25'
  },
  'hospitalization': {
    bg: 'bg-[#6366F1]/10',
    text: 'text-[#6366F1]',
    border: 'border-[#6366F1]/25'
  },
  'vaccination': {
    bg: 'bg-[#14B8A6]/10',
    text: 'text-[#14B8A6]',
    border: 'border-[#14B8A6]/25'
  },
  'appointment': {
    bg: 'bg-[#0360D9]/10',
    text: 'text-[#0360D9]',
    border: 'border-[#0360D9]/25'
  }
};

interface TimelineSourceData {
  surgeries: Surgery[];
  hospitalizations: Hospitalization[];
  vaccinations: Vaccination[];
  medications: Medication[];
  appointments: any[];
  medicalTests?: Array<{
    test_name: string;
    test_date: string;
    result?: string;
    status?: string;
    prescribing_doctor?: string;
    hospital_lab?: string;
    notes?: string;
  }>;
  doctorPrescriptions?: Prescription[];
}

/**
 * Aggregate all medical data sources into timeline events
 */
export function aggregateTimelineEvents(data: TimelineSourceData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Add appointments as consultations
  if (data.appointments && Array.isArray(data.appointments)) {
    data.appointments.forEach((app, index) => {
      const eventType: TimelineEventType = (app.reason || "").toLowerCase().includes("follow") ? 'follow-up' : 'consultation';
      const { consultationType, appointmentType } = parseCompositeReason(app.reason || "");
      const ct = humanizeConsultationType(consultationType);
      const at = humanizeAppointmentType(appointmentType);

      const primaryTitle = `${app.doctor_title ? `${app.doctor_title} ` : 'Dr.'}${app.doctor_name || app.doctor || 'Doctor'}`;
      const secondary = ct ? (at ? `${ct} • ${at}` : ct) : undefined;

      events.push({
        id: `appointment-${index}`,
        type: eventType,
        date: app.appointment_date,
        title: eventType === 'follow-up' ? 'Follow-up' : 'Consultation',
        doctorName: primaryTitle,
        icon: 'CheckCircle2',
        color: EVENT_COLOR_MAP[eventType],
        badge: app.status === 'COMPLETED' ? 'Completed' : 'Scheduled',
      });
    });
  }

  // Add doctor prescriptions (medications)
  if (data.doctorPrescriptions && Array.isArray(data.doctorPrescriptions)) {
    data.doctorPrescriptions.forEach((prescription) => {
      if (prescription.medications && prescription.medications.length > 0) {
        events.push({
          id: `doctor-med-${prescription.id}`,
          type: 'prescription',
          date: prescription.created_at,
          title: 'Medication Prescribed',
          doctorName: `Dr. ${prescription.doctor_name}`,
          items: prescription.medications.map((med: any) => med.medicine_name).filter(Boolean),
          icon: 'Pill',
          color: EVENT_COLOR_MAP.prescription,
          badge: 'Active',
        });
      }
    });
  }

  // Add doctor prescribed tests
  if (data.doctorPrescriptions && Array.isArray(data.doctorPrescriptions)) {
    data.doctorPrescriptions.forEach((prescription) => {
      if (prescription.tests && prescription.tests.length > 0) {
        events.push({
          id: `doctor-test-${prescription.id}`,
          type: 'lab-test',
          date: prescription.created_at,
          title: 'Lab Test Ordered',
          doctorName: `Dr. ${prescription.doctor_name}`,
          items: prescription.tests.map((test: any) => test.test_name).filter(Boolean),
          icon: 'FlaskConical',
          color: EVENT_COLOR_MAP['lab-test'],
          badge: prescription.tests.some((test: any) => test.urgency === 'urgent') ? 'Urgent' : 'Pending',
        });
      }
    });
  }

  // Add surgeries
  data.surgeries.forEach((surgery, index) => {
    events.push({
      id: `surgery-${index}`,
      type: 'surgery',
      date: `${surgery.year}-01-01`,
      title: 'Surgery',
      icon: 'Syringe',
      color: EVENT_COLOR_MAP.surgery,
      badge: 'Completed',
    });
  });

  // Add hospitalizations
  data.hospitalizations.forEach((hosp, index) => {
    events.push({
      id: `hospitalization-${index}`,
      type: 'hospitalization',
      date: `${hosp.year}-01-01`,
      title: 'Hospitalization',
      icon: 'Hospital',
      color: EVENT_COLOR_MAP.hospitalization,
      badge: 'Recorded',
    });
  });

  // Add vaccinations
  data.vaccinations.forEach((vac, index) => {
    events.push({
      id: `vaccination-${index}`,
      type: 'vaccination',
      date: vac.date,
      title: 'Vaccination',
      icon: 'Shield',
      color: EVENT_COLOR_MAP.vaccination,
      badge: 'Completed',
    });
  });

  // Add self-reported medications
  data.medications.forEach((med, index) => {
    if (med.started_date) {
      events.push({
        id: `medication-${index}`,
        type: 'prescription',
        date: med.started_date,
        title: 'Medication Prescribed',
        items: med.display_name ? [med.display_name] : undefined,
        icon: 'Pill',
        color: EVENT_COLOR_MAP.prescription,
        badge: med.status === 'current' ? 'Current' : 'Past',
      });
    }
  });

  // Add self-reported medical tests
  if (data.medicalTests && Array.isArray(data.medicalTests)) {
    data.medicalTests.forEach((test, index) => {
      if (!test.test_date) {
        return;
      }
      const isImaging = /(x-ray|xray|ct|mri|ultrasound|imaging)/i.test(test.test_name || "");
      const eventType: TimelineEventType = isImaging ? 'imaging' : 'lab-test';
      events.push({
        id: `self-test-${index}`,
        type: eventType,
        date: test.test_date,
        title: 'Lab Test Ordered',
        items: test.test_name ? [test.test_name] : undefined,
        doctorName: test.prescribing_doctor ? `Dr. ${test.prescribing_doctor}` : undefined,
        icon: isImaging ? 'Clock' : 'FlaskConical',
        color: EVENT_COLOR_MAP[eventType],
        badge: test.status ? test.status : 'Completed',
      });
    });
  }

  // Remove duplicates and sort by date (newest first)
  const uniqueEvents = Array.from(
    new Map(events.map((event) => [event.id, event])).values()
  );

  uniqueEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return uniqueEvents;
}

/**
 * Filter timeline events by type
 */
export function filterTimelineEvents(
  events: TimelineEvent[],
  types: TimelineEventType[] | null
): TimelineEvent[] {
  if (!types || types.length === 0) {
    return events;
  }
  return events.filter((event) => types.includes(event.type));
}

/**
 * Group timeline events by year
 */
export function groupTimelineEventsByYear(
  events: TimelineEvent[]
): Record<string, TimelineEvent[]> {
  const grouped: Record<string, TimelineEvent[]> = {};

  events.forEach((event) => {
    const year = new Date(event.date).getFullYear().toString();
    if (!grouped[year]) {
      grouped[year] = [];
    }
    grouped[year].push(event);
  });

  return grouped;
}

/**
 * Get icon component name for lucide-react
 */
export function getIconComponent(iconName: string) {
  const iconMap: Record<string, string> = {
    'CheckCircle2': 'CheckCircle2',
    'Pill': 'Pill',
    'FlaskConical': 'FlaskConical',
    'Syringe': 'Syringe',
    'Hospital': 'Hospital',
    'Shield': 'Shield',
    'Calendar': 'Calendar',
    'Clock': 'Clock'
  };
  return iconMap[iconName] || 'Clock';
}

/**
 * Format date for display
 */
export function formatTimelineDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
