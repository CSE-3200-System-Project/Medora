"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Calendar, Clock, User, FileText, CheckCircle2, XCircle, AlertCircle, Phone, Activity, Filter, ExternalLink } from "lucide-react";
import { cn, parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface Appointment {
  id: string;
  patient_id?: string;
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
  const router = useRouter();
  const listRef = React.useRef<HTMLDivElement>(null);
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'approve' | 'reject' | 'cancel';
    appointmentId: string;
    patientName: string;
  }>({
    isOpen: false,
    type: 'cancel',
    appointmentId: '',
    patientName: ''
  });

  // Handle confirmation dialog actions
  const handleConfirmAction = () => {
    const { type, appointmentId } = confirmDialog;
    if (type === 'approve' && onApproveAppointment) {
      onApproveAppointment(appointmentId);
    } else if (type === 'reject' && onRejectAppointment) {
      onRejectAppointment(appointmentId);
    } else if (type === 'cancel' && onCancelAppointment) {
      onCancelAppointment(appointmentId);
    }
    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
  };

  const openConfirmDialog = (type: 'approve' | 'reject' | 'cancel', appointmentId: string, patientName: string) => {
    setConfirmDialog({ isOpen: true, type, appointmentId, patientName });
  };

  // Deduplicate appointments by id
  const uniqueAppointments = appointments.filter(
    (appt, index, self) => index === self.findIndex(a => a.id === appt.id)
  );

  // Filter by status
  const filteredAppointments = statusFilter === 'all' 
    ? uniqueAppointments 
    : uniqueAppointments.filter(appt => appt.status.toUpperCase() === statusFilter.toUpperCase());

  // Count appointments by status for filter badges
  const statusCounts = {
    all: uniqueAppointments.length,
    pending: uniqueAppointments.filter(a => a.status.toUpperCase() === 'PENDING').length,
    confirmed: uniqueAppointments.filter(a => a.status.toUpperCase() === 'CONFIRMED').length,
    cancelled: uniqueAppointments.filter(a => a.status.toUpperCase() === 'CANCELLED').length,
    completed: uniqueAppointments.filter(a => a.status.toUpperCase() === 'COMPLETED').length,
  };

  // Separate recent and past appointments
  const now = new Date();
  const recentAppointments = filteredAppointments.filter(
    appt => new Date(appt.appointment_date) >= now
  ).sort((a, b) => 
    new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
  );

  const pastAppointments = filteredAppointments.filter(
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
            : "border-blue-200 bg-card hover:bg-blue-50",
          isPast && "opacity-75"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              {appointment.patient_id ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/doctor/patient/${appointment.patient_id}`);
                  }}
                  className="font-semibold text-primary hover:underline text-base flex items-center gap-1 text-left"
                >
                  {appointment.patient_name}
                  <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <h4 className="font-semibold text-foreground text-base">{appointment.patient_name}</h4>
              )}
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
          
          {/* Reason for Visit (structured) */}
          <div className="flex items-start gap-2 text-foreground bg-muted/50 p-2 rounded">
            <FileText className="w-4 h-4 mt-0.5 text-primary" />
            <div className="flex-1">
              <span className="text-xs font-medium text-muted-foreground">Reason for visit:</span>
              {(() => {
                const { consultationType, appointmentType } = parseCompositeReason(appointment.reason)
                const ct = humanizeConsultationType(consultationType)
                const at = humanizeAppointmentType(appointmentType)

                return (
                  <>
                    <p className="mt-0.5 text-sm text-foreground">{ct}{at ? ` • ${at}` : ''}</p>
                    {appointment.notes && <p className="text-xs text-muted-foreground mt-1">{appointment.notes}</p>}
                  </>
                )
              })()}
            </div>
          </div>
          
          {/* Action Buttons */}
          {isPending && onApproveAppointment && onRejectAppointment && (
            <div className="mt-3 pt-3 border-t border-border flex gap-2">
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  openConfirmDialog('approve', appointment.id, appointment.patient_name);
                }}
                className="flex-1 bg-success text-primary-foreground hover:bg-success-muted"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  openConfirmDialog('reject', appointment.id, appointment.patient_name);
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
                  openConfirmDialog('cancel', appointment.id, appointment.patient_name);
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

  // Get dialog content based on type
  const getDialogContent = () => {
    const { type, patientName } = confirmDialog;
    switch (type) {
      case 'approve':
        return {
          title: 'Approve Appointment',
          description: `Are you sure you want to approve the appointment with ${patientName}? They will be notified about the confirmation.`,
          confirmText: 'Approve',
          variant: 'success' as const
        };
      case 'reject':
        return {
          title: 'Reject Appointment',
          description: `Are you sure you want to reject the appointment with ${patientName}? This action cannot be undone.`,
          confirmText: 'Reject',
          variant: 'danger' as const
        };
      case 'cancel':
        return {
          title: 'Cancel Appointment',
          description: `Are you sure you want to cancel this appointment with ${patientName}? The patient will be notified.`,
          confirmText: 'Cancel Appointment',
          variant: 'danger' as const
        };
    }
  };

  return (
    <Card className="rounded-2xl shadow-lg h-full flex flex-col bg-card border-blue-200">
      <CardHeader className="border-b border-blue-200 pb-4 shrink-0">
        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
          <Calendar className="w-5 h-5 text-primary" />
          Appointments
        </CardTitle>
        
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="text-xs h-7"
          >
            All ({statusCounts.all})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
            className={cn("text-xs h-7", statusFilter === 'pending' && "bg-yellow-500 hover:bg-yellow-600")}
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending ({statusCounts.pending})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('confirmed')}
            className={cn("text-xs h-7", statusFilter === 'confirmed' && "bg-blue-500 hover:bg-blue-600")}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirmed ({statusCounts.confirmed})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('cancelled')}
            className={cn("text-xs h-7", statusFilter === 'cancelled' && "bg-red-500 hover:bg-red-600")}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled ({statusCounts.cancelled})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('completed')}
            className={cn("text-xs h-7", statusFilter === 'completed' && "bg-green-500 hover:bg-green-600")}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed ({statusCounts.completed})
          </Button>
        </div>
        
        <div className="flex gap-4 text-sm mt-2">
          <span className="text-muted-foreground">
            Upcoming: <span className="font-semibold text-foreground">{recentAppointments.length}</span>
          </span>
          <span className="text-muted-foreground">
            Past: <span className="font-semibold text-foreground">{pastAppointments.length}</span>
          </span>
        </div>
      </CardHeader>

      <CardContent 
        ref={listRef}
        className="p-4 space-y-6 overflow-y-auto flex-1 bg-card"
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

        {filteredAppointments.length === 0 && (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {statusFilter === 'all' ? 'No appointments found' : `No ${statusFilter} appointments`}
            </p>
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmAction}
        title={getDialogContent().title}
        description={getDialogContent().description}
        confirmText={getDialogContent().confirmText}
        variant={getDialogContent().variant}
      />
    </Card>
  );
}

