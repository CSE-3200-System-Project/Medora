"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, Clock, User, Calendar, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { getDoctorBookedSlots } from "@/lib/appointment-actions";

interface RescheduleAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: {
    id: string;
    doctor_id?: string;
    doctor_name?: string;
    doctor_title?: string;
    patient_name?: string;
    appointment_date: string;
    slot_time?: string | null;
    reason?: string;
  } | null;
  onConfirm: (appointmentId: string, newDate: string, slotTime: string, notes?: string) => Promise<void>;
  userRole?: 'patient' | 'doctor';
}

interface TimeSlot {
  time: string;
  is_booked: boolean;
  is_past: boolean;
  patient_name?: string | null;
}

export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  userRole = 'patient',
}: RescheduleAppointmentDialogProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [slots, setSlots] = React.useState<TimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedDate(null);
      setSelectedSlot(null);
      setNotes("");
      setSlots([]);
      setCurrentMonth(new Date());
    }
  }, [open]);

  const fetchSlots = React.useCallback(async (date: Date) => {
    if (!appointment?.doctor_id) return;
    
    setLoadingSlots(true);
    setSelectedSlot(null);
    
    try {
      const dateStr = date.toISOString().split('T')[0];
      const data = await getDoctorBookedSlots(appointment.doctor_id, dateStr);
      setSlots(data.slots || []);
    } catch (error) {
      console.error("Failed to fetch slots:", error);
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [appointment?.doctor_id]);

  // Fetch slots when date is selected
  React.useEffect(() => {
    if (selectedDate && appointment?.doctor_id) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, appointment?.doctor_id, fetchSlots]);

  const handleConfirm = async () => {
    if (!appointment || !selectedDate || !selectedSlot) return;

    setLoading(true);
    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      await onConfirm(appointment.id, dateStr, selectedSlot, notes || undefined);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to reschedule appointment:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const displayName = userRole === 'patient' 
    ? `${appointment?.doctor_title || 'Dr.'} ${appointment?.doctor_name || 'Doctor'}`
    : appointment?.patient_name || 'Patient';

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDay = firstDay.getDay();
    return { daysInMonth, startDay };
  };

  const { daysInMonth, startDay } = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const renderCalendar = () => {
    const cells = [];
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    // Day headers
    dayNames.forEach((day, i) => {
      cells.push(
        <div key={`header-${i}`} className="text-center text-xs font-medium text-muted-foreground py-1">
          {day}
        </div>
      );
    });

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
      cells.push(<div key={`empty-${i}`} className="p-1" />);
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const isPast = date < today;
      const isSelected = selectedDate && 
        date.getDate() === selectedDate.getDate() &&
        date.getMonth() === selectedDate.getMonth() &&
        date.getFullYear() === selectedDate.getFullYear();

      cells.push(
        <button
          key={day}
          onClick={() => !isPast && setSelectedDate(date)}
          disabled={isPast}
          className={`
            p-1 text-sm rounded-full w-8 h-8 flex items-center justify-center
            ${isPast ? 'text-muted-foreground/50 cursor-not-allowed' : 'hover:bg-primary/10 cursor-pointer'}
            ${isSelected ? 'bg-primary text-white hover:bg-primary' : ''}
          `}
        >
          {day}
        </button>
      );
    }

    return cells;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <RefreshCw className="w-5 h-5" />
            Reschedule Appointment
          </DialogTitle>
          <DialogDescription>
            Select a new date and time for your appointment.
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="space-y-4">
            {/* Current Appointment Summary */}
            <div className="bg-accent/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Current appointment</p>
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <p className="font-medium text-sm text-foreground">{displayName}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(appointment.appointment_date)}
                </span>
                {appointment.slot_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {appointment.slot_time}
                  </span>
                )}
              </div>
            </div>

            {/* Date Selection Calendar */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="p-1 hover:bg-accent rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium text-sm">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-1 hover:bg-accent rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {renderCalendar()}
              </div>
            </div>

            {/* Time Slots */}
            {selectedDate && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Select a time slot for {formatDate(selectedDate.toISOString())}
                </Label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No available slots for this date
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                    {slots.map((slot) => {
                      const isAvailable = !slot.is_booked && !slot.is_past;
                      const isSelected = selectedSlot === slot.time;
                      
                      return (
                        <button
                          key={slot.time}
                          onClick={() => isAvailable && setSelectedSlot(slot.time)}
                          disabled={!isAvailable}
                          className={`
                            p-2 text-sm rounded-lg border transition-colors
                            ${!isAvailable ? 'bg-gray-100 text-muted-foreground/50 cursor-not-allowed border-gray-200' : ''}
                            ${isAvailable && !isSelected ? 'hover:border-primary hover:bg-primary/5 border-border' : ''}
                            ${isSelected ? 'bg-primary text-white border-primary' : ''}
                          `}
                        >
                          {slot.time}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="reschedule-notes" className="text-sm font-medium">
                Additional notes (optional)
              </Label>
              <Textarea
                id="reschedule-notes"
                placeholder="Any notes about the reschedule..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading || !selectedDate || !selectedSlot}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rescheduling...
              </>
            ) : (
              "Confirm Reschedule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
