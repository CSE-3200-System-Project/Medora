"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, FileText, CheckCircle2, XCircle, AlertCircle, User2, Phone, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  patient_name: string;
  appointment_date: string;
  reason: string;
  notes: string | null;
  status: string;
  patient_phone?: string;
  patient_age?: number;
  patient_gender?: string;
  blood_group?: string;
  chronic_conditions?: string[];
}

interface AppointmentListProps {
  appointments: Appointment[];
  highlightedId: string | null;
  onAppointmentClick?: (id: string) => void;
  onCancelAppointment?: (id: string) => void;
  onApproveAppointment?: (id: string) => void;
  onRejectAppointment?: (id: string) => void;
}

export function AppointmentList({ 
  appointments, 
  highlightedId,
  onAppointmentClick,
  onCancelAppointment,
  onApproveAppointment,
  onRejectAppointment
}: AppointmentListProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  // Separate recent and past appointments
  const now = new Date();
  const recentAppointments = appointments.filter(
    appt => new Date(appt.appointment_date) >= now
  ).sort((a, b) => 
    new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
  );

  const pastAppointments = appointments.filter(
    appt => new Date(appt.appointment_date) < now
  ).sort((a, b) => 
    new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
  );

  // Scroll to highlighted appointment
  React.useEffect(() => {
    if (highlightedId && listRef.current) {
      const element = listRef.current.querySelector(`[data-appointment-id="${highlightedId}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [highlightedId]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dateFormatted = `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    const timeFormatted = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    return { date: dateFormatted, time: timeFormatted };
  };

  const getStatusBadge = (status: string) => {
    const statusUpper = status.toUpperCase();
    
    switch (statusUpper) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Pending
          </Badge>
        );
      case 'CONFIRMED':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-blue-500">
            <CheckCircle2 className="w-3 h-3" />
            Confirmed
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const AppointmentCard = ({ appointment, isPast = false }: { appointment: Appointment; isPast?: boolean }) => {
    const { date, time } = formatDateTime(appointment.appointment_date);
    const isHighlighted = highlightedId === appointment.id;
    const isPending = appointment.status.toUpperCase() === 'PENDING';

    // Extract slot time from notes if available (e.g., "Slot: 05:50 PM | Location: ...")
    const extractSlotTime = (notes: string | null): string | null => {
      if (!notes) return null;
      const slotMatch = notes.match(/Slot:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
      return slotMatch ? slotMatch[1] : null;
    };

    const slotTime = extractSlotTime(appointment.notes);
    const displayTime = slotTime || time; // Use slot time if available, otherwise use appointment_date time

    return (
      <div
        data-appointment-id={appointment.id}
        onClick={() => onAppointmentClick?.(appointment.id)}
        className={cn(
          "p-4 rounded-lg border-2 transition-all cursor-pointer",
          "hover:shadow-md hover:scale-[1.02]",
          isHighlighted 
            ? "border-primary bg-blue-50 shadow-lg scale-[1.02]" 
            : "border-blue-200 bg-white hover:bg-blue-50",
          isPast && "opacity-75"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-foreground text-base">{appointment.patient_name}</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {appointment.patient_age && (
                  <span>{appointment.patient_age} yrs</span>
                )}
                {appointment.patient_gender && (
                  <span>• {appointment.patient_gender}</span>
                )}
                {appointment.blood_group && (
                  <span>• {appointment.blood_group}</span>
                )}
              </div>
            </div>
          </div>
          {getStatusBadge(appointment.status)}
        </div>

        <div className="space-y-2.5 text-sm">
          {/* Appointment Time */}
          <div className="flex items-center gap-2 text-foreground bg-blue-50 p-2 rounded">
            <Clock className="w-4 h-4 text-primary" />
            <div>
              <div className="font-medium">{displayTime}</div>
              <div className="text-xs text-muted-foreground">{date}</div>
            </div>
          </div>
          
          {/* Contact Info */}
          {appointment.patient_phone && (
            <div className="flex items-center gap-2 text-foreground">
              <Phone className="w-4 h-4" />
              <span>{appointment.patient_phone}</span>
            </div>
          )}
          
          {/* Chronic Conditions */}
          {appointment.chronic_conditions && appointment.chronic_conditions.length > 0 && (
            <div className="flex items-start gap-2">
              <Activity className="w-4 h-4 mt-0.5 text-orange-600" />
              <div className="flex-1">
                <span className="text-xs font-medium text-orange-600">Chronic Conditions:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {appointment.chronic_conditions.map((condition, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Reason for Visit */}
          <div className="flex items-start gap-2 text-foreground bg-muted/50 p-2 rounded">
            <FileText className="w-4 h-4 mt-0.5 text-primary" />
            <div className="flex-1">
              <span className="text-xs font-medium text-muted-foreground">Reason for visit:</span>
              <p className="mt-0.5">{appointment.reason}</p>
            </div>
          </div>

          {appointment.notes && (
            <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground">
              <span className="font-medium">Notes:</span> {appointment.notes}
            </div>
          )}
          
          {/* Action Buttons */}
          {isPending && onApproveAppointment && onRejectAppointment && (
            <div className="mt-3 pt-3 border-t border-border flex gap-2">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Approve appointment with ${appointment.patient_name}?`)) {
                    onApproveAppointment(appointment.id);
                  }
                }}
                className="flex-1 bg-success text-white hover:bg-success-muted"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Reject appointment with ${appointment.patient_name}?`)) {
                    onRejectAppointment(appointment.id);
                  }
                }}
                className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject
              </Button>
            </div>
          )}
          
          {/* Cancel Button for other statuses */}
          {!isPending && appointment.status !== 'CANCELLED' && appointment.status !== 'COMPLETED' && onCancelAppointment && (
            <div className="mt-3 pt-2 border-t border-border">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Are you sure you want to cancel this appointment?')) {
                    onCancelAppointment(appointment.id);
                  }
                }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Cancel Appointment
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="rounded-2xl shadow-lg h-full flex flex-col bg-white border-blue-200">
      <CardHeader className="border-b border-blue-200 pb-4 shrink-0">
        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
          <Calendar className="w-5 h-5 text-primary" />
          Appointments
        </CardTitle>
        <div className="flex gap-4 text-sm mt-2">
          <span className="text-muted-foreground">
            Recent: <span className="font-semibold text-foreground">{recentAppointments.length}</span>
          </span>
          <span className="text-muted-foreground">
            Past: <span className="font-semibold text-foreground">{pastAppointments.length}</span>
          </span>
        </div>
      </CardHeader>

      <CardContent 
        ref={listRef}
        className="p-4 space-y-6 overflow-y-auto flex-1 bg-white"
      >
        {/* Recent Appointments */}
        {recentAppointments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Recent Appointments
            </h3>
            <div className="space-y-3">
              {recentAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
            </div>
          </div>
        )}

        {/* Past Appointments */}
        {pastAppointments.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              Past Appointments
            </h3>
            <div className="space-y-3">
              {pastAppointments.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} isPast />
              ))}
            </div>
          </div>
        )}

        {appointments.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No appointments found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
