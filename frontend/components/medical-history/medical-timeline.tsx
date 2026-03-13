import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Syringe, Hospital, Shield, Pill, Calendar, Clock, CheckCircle2 } from "lucide-react";
import { Surgery } from "./surgery-manager";
import { Hospitalization } from "./hospitalization-manager";
import { Vaccination } from "./vaccination-manager";
import { Medication } from "@/components/medicine";
import { parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";

interface Appointment {
  appointment_date: string;
  reason: string;
  notes?: string;
  status: string;
  doctor_name?: string | null;
  doctor?: string | null;
  doctor_title?: string | null;
}

interface TimelineEvent {
  id: string;
  type: 'surgery' | 'hospitalization' | 'vaccination' | 'medication' | 'appointment';
  date: string;
  title: string;
  description?: string;
  details?: string;
  icon: React.ReactNode;
  color: string;
}

interface MedicalTimelineProps {
  surgeries: Surgery[];
  hospitalizations: Hospitalization[];
  vaccinations: Vaccination[];
  medications: Medication[];
  appointments: Appointment[];
  title?: string;
  description?: string;
}

/**
 * Medical Timeline Component
 * Shows all medical events in chronological order
 */
export function MedicalTimeline({
  surgeries,
  hospitalizations,
  vaccinations,
  medications,
  appointments,
  title = "Medical Timeline",
  description = "Chronological view of your medical history",
}: MedicalTimelineProps) {
  // Convert all medical data to timeline events
  const events: TimelineEvent[] = [];

  // Add surgeries
  surgeries.forEach((surgery, index) => {
    events.push({
      id: `surgery-${index}`,
      type: 'surgery',
      date: `${surgery.year}-01-01`, // Use January 1st of the year
      title: surgery.name,
      description: surgery.hospital ? `Hospital: ${surgery.hospital}` : undefined,
      details: surgery.notes,
      icon: <Syringe className="h-4 w-4" />,
      color: 'text-primary',
    });
  });

  // Add hospitalizations
  hospitalizations.forEach((hosp, index) => {
    events.push({
      id: `hospitalization-${index}`,
      type: 'hospitalization',
      date: `${hosp.year}-01-01`,
      title: hosp.reason,
      description: hosp.duration ? `Duration: ${hosp.duration}` : undefined,
      details: hosp.hospital ? `Hospital: ${hosp.hospital}` : undefined,
      icon: <Hospital className="h-4 w-4" />,
      color: 'text-amber-600',
    });
  });

  // Add vaccinations
  vaccinations.forEach((vac, index) => {
    events.push({
      id: `vaccination-${index}`,
      type: 'vaccination',
      date: vac.date,
      title: vac.name,
      description: vac.provider ? `Provider: ${vac.provider}` : undefined,
      details: vac.next_due ? `Next due: ${new Date(vac.next_due).toLocaleDateString()}` : undefined,
      icon: <Shield className="h-4 w-4" />,
      color: 'text-blue-600',
    });
  });

  // Add medications (use started_date if available)
  medications.forEach((med, index) => {
    if (med.started_date) {
      events.push({
        id: `medication-${index}`,
        type: 'medication',
        date: med.started_date,
        title: med.display_name,
        description: med.dosage ? `Dosage: ${med.dosage}` : undefined,
        details: med.frequency ? `Frequency: ${med.frequency}` : undefined,
        icon: <Pill className="h-4 w-4" />,
        color: 'text-success',
      });
    }
  });

  // Add appointments (display doctor name as primary, consultation type secondary, notes tertiary)
  appointments.forEach((app, index) => {
    const { consultationType, appointmentType } = parseCompositeReason(app.reason || "");
    const ct = humanizeConsultationType(consultationType);
    const at = humanizeAppointmentType(appointmentType);

    const primaryTitle = `${app.doctor_title ? `${app.doctor_title} ` : 'Dr.'}${app.doctor_name || app.doctor || 'Doctor'}`;
    const secondary = ct ? (at ? `${ct} • ${at}` : ct) : undefined;
    const tertiary = app.notes ? app.notes : `Status: ${app.status}`;

    events.push({
      id: `appointment-${index}`,
      type: 'appointment',
      date: app.appointment_date,
      title: primaryTitle,
      description: secondary || app.reason,
      details: tertiary,
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: 'text-purple-600',
    });
  });

  // Sort events by date (newest first)
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Group events by year
  const eventsByYear = events.reduce((acc, event) => {
    const year = new Date(event.date).getFullYear().toString();
    if (!acc[year]) {
      acc[year] = [];
    }
    acc[year].push(event);
    return acc;
  }, {} as Record<string, TimelineEvent[]>);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'surgery': return 'Surgery';
      case 'hospitalization': return 'Hospitalization';
      case 'vaccination': return 'Vaccination';
      case 'medication': return 'Medication';
      case 'appointment': return 'Appointment';
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'surgery': return 'default';
      case 'hospitalization': return 'destructive';
      case 'vaccination': return 'secondary';
      case 'medication': return 'outline';
      case 'appointment': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {events.length > 0 ? (
        <div className="space-y-8">
          {Object.entries(eventsByYear)
            .sort(([a], [b]) => parseInt(b) - parseInt(a))
            .map(([year, yearEvents]) => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <h4 className="text-xl font-semibold text-foreground">{year}</h4>
                <Badge variant="outline" className="ml-auto">
                  {yearEvents.length} event{yearEvents.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              <div className="ml-11 space-y-3">
                {yearEvents.map((event, index) => (
                  <div key={event.id} className="relative">
                    {/* Timeline line */}
                    {index < yearEvents.length - 1 && (
                      <div className="absolute left-6 top-12 w-px h-8 bg-border" />
                    )}

                    <Card className="bg-surface/30">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Event icon */}
                          <div className={`h-12 w-12 rounded-full bg-surface flex items-center justify-center ${event.color}`}>
                            {event.icon}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-semibold text-foreground">{event.title}</h5>
                              <Badge variant={getTypeBadgeVariant(event.type)} className="text-xs">
                                {getTypeLabel(event.type)}
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground mb-2">
                              {new Date(event.date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </div>

                            {event.description && (
                              <p className="text-sm text-muted-foreground mb-1">
                                {event.description}
                              </p>
                            )}

                            {event.details && (
                              <p className="text-sm text-muted-foreground">
                                {event.details}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No medical events recorded</p>
          <p className="text-sm mt-2">Add surgeries, hospitalizations, vaccinations, or medications to see your timeline</p>
        </div>
      )}
    </div>
  );
}