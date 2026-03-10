"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ChevronLeft, User, Phone, Activity, CheckCircle2 } from "lucide-react";
import { cn, parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { completeAppointment } from "@/lib/appointment-actions";

interface TimeSlot {
  time: string;
  appointmentId: string | null;
  patientName: string | null;
  reason: string | null;
  status: string | null;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  bloodGroup?: string;
  chronicConditions?: string[];
  appointmentDate?: string;
  notes?: string;
}

interface TimeSlotGridProps {
  selectedDate: string;
  slots: TimeSlot[];
  onSlotClick: (appointmentId: string) => void;
  onBack: () => void;
}

export function TimeSlotGrid({ 
  selectedDate, 
  slots, 
  onSlotClick,
  onBack 
}: TimeSlotGridProps) {
  const [selectedSlot, setSelectedSlot] = React.useState<TimeSlot | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  const [serverCanComplete, setServerCanComplete] = React.useState<boolean | null>(null);
  const [checkingCanComplete, setCheckingCanComplete] = React.useState(false);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  // Check if a slot is in the past
  const isSlotPast = (slotTime: string) => {
    const now = new Date();
    const slotDate = new Date(selectedDate);
    
    // Parse slot time
    const timeParts = slotTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!timeParts) return false;
    
    let hours = parseInt(timeParts[1]);
    const minutes = parseInt(timeParts[2]);
    const isPM = timeParts[3].toUpperCase() === 'PM';
    
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    
    slotDate.setHours(hours, minutes, 0, 0);
    return slotDate < now;
  };

  // Check if appointment can be completed (prefer server check if available)
  const canCompleteAppointment = (slot: TimeSlot | null) => {
    if (!slot || !slot.appointmentId) return false;
    if (slot.status?.toUpperCase() !== 'CONFIRMED') return false;

    // If server returned an authoritative value, trust it
    if (serverCanComplete !== null) return serverCanComplete;

    // Otherwise fall back to client-side time checks
    const isPast = isDatePast() || (isToday() && isSlotPast(slot.time));
    return isPast;
  };

  const handleCompleteAppointment = async () => {
    if (!selectedSlot?.appointmentId) return;
    
    setIsCompleting(true);
    try {
      await completeAppointment(selectedSlot.appointmentId);
      setDetailsOpen(false);
      // Refresh the page to show updated status
      window.location.reload();
    } catch (error: any) {
      alert(error.message || "Failed to complete appointment");
    } finally {
      setIsCompleting(false);
    }
  };

  // Check if selected date is today
  const isToday = () => {
    const today = new Date();
    const selected = new Date(selectedDate);
    return today.toDateString() === selected.toDateString();
  };

  // Check if selected date is in the past
  const isDatePast = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(selectedDate);
    selected.setHours(0, 0, 0, 0);
    return selected < today;
  };

  // Reset server can-complete state when dialog closes
  React.useEffect(() => {
    if (!detailsOpen) {
      setServerCanComplete(null);
      setCheckingCanComplete(false);
      // keep selected slot cleared when dialog closed
      setSelectedSlot(null);
    }
  }, [detailsOpen]);

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.appointmentId) {
      setSelectedSlot(slot);
      setDetailsOpen(true);
      setServerCanComplete(null);
      setCheckingCanComplete(true);
      onSlotClick(slot.appointmentId);

      // Fetch server authoritative can-complete flag
      (async () => {
        try {
          const cookies = document.cookie.split(';');
          const tokenCookie = cookies.find(c => c.trim().startsWith('session_token='));
          const token = tokenCookie?.split('=')[1];
          if (!token) return setServerCanComplete(null);

          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/appointment/${slot.appointmentId}/can-complete`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store'
          });

          if (!res.ok) {
            setServerCanComplete(null);
          } else {
            const data = await res.json();
            setServerCanComplete(!!data.can_complete);
          }
        } catch (e) {
          console.error('Failed to fetch can-complete:', e);
          setServerCanComplete(null);
        } finally {
          setCheckingCanComplete(false);
        }
      })();
    }
  };

  // Group slots by time period
  const groupSlotsByPeriod = (slots: TimeSlot[]) => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];
    const evening: TimeSlot[] = [];

    slots.forEach(slot => {
      const hour = parseInt(slot.time.split(':')[0]);
      const isPM = slot.time.toLowerCase().includes('pm');
      const adjustedHour = isPM && hour !== 12 ? hour + 12 : hour;

      if (adjustedHour < 12) {
        morning.push(slot);
      } else if (adjustedHour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    const groups = [];
    if (morning.length > 0) groups.push({ period: 'Morning', slots: morning });
    if (afternoon.length > 0) groups.push({ period: 'Afternoon', slots: afternoon });
    if (evening.length > 0) groups.push({ period: 'Evening', slots: evening });

    return groups;
  };

  const groupedSlots = groupSlotsByPeriod(slots);

  const getSlotStyle = (slot: TimeSlot) => {
    const isPast = isDatePast() || (isToday() && isSlotPast(slot.time));
    const status = slot.status?.toUpperCase();
    
    // Past slots with completed status
    if (status === 'COMPLETED' || (isPast && slot.appointmentId)) {
      return 'bg-green-50 border-green-400 text-green-700 opacity-80';
    }
    
    // Booked slots
    if (slot.appointmentId) {
      switch (status) {
        case 'PENDING':
          return 'bg-yellow-100 border-yellow-400 text-yellow-800';
        case 'CONFIRMED':
          return 'bg-blue-100 border-blue-400 text-blue-800';
        case 'CANCELLED':
          return 'bg-red-100 border-red-400 text-red-800 opacity-50';
        default:
          return 'bg-gray-100 border-gray-400 text-gray-700';
      }
    }
    
    // Past empty slots
    if (isPast) {
      return 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed';
    }
    
    // Available slots
    return 'bg-blue-50 border-blue-200 text-blue-600';
  };

  const getStatusBadge = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return <Badge className="bg-yellow-500">Pending</Badge>;
      case 'CONFIRMED':
        return <Badge className="bg-blue-500">Confirmed</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Cancelled</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
    <Card className="rounded-2xl shadow-lg bg-white border-blue-200">
      <CardHeader className="border-b border-blue-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Time Slots
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(selectedDate)}
              {isDatePast() && (
                <span className="ml-2 text-xs text-gray-500">(Past date)</span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 bg-white">
        <div className="space-y-6">
          {groupedSlots.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h4 className="text-sm font-semibold text-blue-900 mb-3">
                {group.period}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {group.slots.map((slot, slotIndex) => {
                  const isPast = isDatePast() || (isToday() && isSlotPast(slot.time));
                  const isBooked = !!slot.appointmentId;
                  
                  return (
                  <button
                    key={slotIndex}
                    onClick={() => handleSlotClick(slot)}
                    disabled={!isBooked && isPast}
                    className={cn(
                      "py-3 px-2 rounded-lg border-2 text-xs font-medium transition-all relative",
                      isBooked && "hover:scale-105 hover:shadow-md cursor-pointer",
                      getSlotStyle(slot)
                    )}
                  >
                    <span>{slot.time}</span>
                    {isBooked && (
                      <div className="absolute -top-1 -right-1">
                        {slot.status === 'COMPLETED' ? (
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                        ) : slot.status === 'CONFIRMED' ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                        ) : slot.status === 'PENDING' ? (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                        ) : null}
                      </div>
                    )}
                  </button>
                  );
                })}
              </div>
            </div>
          ))}

          {slots.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <p className="text-blue-600">No time slots available for this date</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-blue-200">
          <p className="text-xs font-semibold text-blue-700 mb-2">Status Legend:</p>
          <div className="flex flex-wrap gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-400" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400" />
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-400" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-blue-50 border-2 border-blue-200" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gray-100 border-2 border-gray-300" />
              <span>Past</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Appointment Details Dialog */}
    <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Appointment Details
          </DialogTitle>
          <DialogDescription>
            {selectedSlot?.time} on {formatDate(selectedDate)}
          </DialogDescription>
        </DialogHeader>
        
        {selectedSlot && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{selectedSlot.patientName}</span>
              {getStatusBadge(selectedSlot.status)}
            </div>
            
            <div className="space-y-2 text-sm">
              {selectedSlot.patientPhone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{selectedSlot.patientPhone}</span>
                </div>
              )}
              
              {(selectedSlot.patientAge || selectedSlot.patientGender || selectedSlot.bloodGroup) && (
                <div className="flex items-center gap-4 text-muted-foreground">
                  {selectedSlot.patientAge && <span>{selectedSlot.patientAge} yrs</span>}
                  {selectedSlot.patientGender && <span>{selectedSlot.patientGender}</span>}
                  {selectedSlot.bloodGroup && <span>{selectedSlot.bloodGroup}</span>}
                </div>
              )}
              
              {selectedSlot.reason && (
                <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Consultation</p>
                    {(() => {
                      const { consultationType, appointmentType } = parseCompositeReason(selectedSlot.reason)
                      const ct = humanizeConsultationType(consultationType)
                      const at = humanizeAppointmentType(appointmentType)
                      return (
                        <>
                          <p className="text-foreground">{ct}{at ? ` • ${at}` : ''}</p>
                          {selectedSlot.notes && <p className="text-xs text-muted-foreground mt-1">{selectedSlot.notes}</p>}
                        </>
                      )
                    })()}
                </div>
              )}
              
              {selectedSlot.chronicConditions && selectedSlot.chronicConditions.length > 0 && (
                <div className="flex items-start gap-2">
                  <Activity className="w-4 h-4 text-orange-500 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {selectedSlot.chronicConditions.map((condition, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs bg-orange-50 text-orange-700">
                        {condition}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Complete Appointment Button - Only show for past CONFIRMED appointments */}
            {canCompleteAppointment(selectedSlot) && (
              <div className="pt-4 border-t">
                <Button
                  onClick={handleCompleteAppointment}
                  disabled={isCompleting}
                  className="w-full"
                  variant="transaction"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {isCompleting ? "Completing..." : "Mark as Completed"}
                </Button>
                <p className="text-xs text-muted-foreground text-center mt-2">
                  This will mark the appointment as completed
                </p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
