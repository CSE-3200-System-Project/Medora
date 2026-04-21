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
import { ButtonLoader } from "@/components/ui/medora-loader";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RefreshCw, Clock, User, Calendar, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { localDateKey } from "@/lib/utils";
import { getAvailableSlots } from "@/lib/auth-actions";
import { useRealtimeSlots } from "@/lib/use-realtime-slots";
import { useAppI18n, useT } from "@/i18n/client";

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
  available?: boolean;
  is_available?: boolean;
  is_past?: boolean;
}

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

export function RescheduleAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onConfirm,
  userRole = 'patient',
}: RescheduleAppointmentDialogProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [slots, setSlots] = React.useState<TimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedDate(null);
      setSelectedSlot(null);
      setNotes("");
      setSlots([]);
      setCurrentMonth(new Date());
      setSubmitError(null);
    }
  }, [open]);

  const fetchSlots = React.useCallback(async (date: Date) => {
    if (!appointment?.doctor_id) return;
    
    setLoadingSlots(true);
    setSelectedSlot(null);
    setSubmitError(null);
    
    try {
      const dateStr = localDateKey(date);
      const data = await getAvailableSlots(appointment.doctor_id, dateStr);
      const nextSlots: TimeSlot[] = (data?.slots || [])
        .flatMap((group: { slots?: TimeSlot[] }) => group.slots || []);
      setSlots(nextSlots);
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

  // Realtime: auto-refresh slots when availability changes
  const realtimeDateKey = selectedDate ? localDateKey(selectedDate) : null;
  useRealtimeSlots(
    appointment?.doctor_id,
    realtimeDateKey,
    () => { if (selectedDate) fetchSlots(selectedDate); },
  );

  const handleConfirm = async () => {
    if (!appointment || !selectedDate || !selectedSlot) return;

    setLoading(true);
    setSubmitError(null);
    try {
      const dateStr = localDateKey(selectedDate);
      await onConfirm(appointment.id, dateStr, selectedSlot, notes || undefined);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to reschedule appointment:", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : tCommon("patientAppointments.dialogs.reschedule.failed"),
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: string | Date) => {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString(toIntlLocale(locale), {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const displayName = userRole === 'patient' 
    ? `${appointment?.doctor_title || tCommon("patientAppointments.dialogs.reschedule.fallbackDoctorPrefix")} ${appointment?.doctor_name || tCommon("patientAppointments.dialogs.reschedule.fallbackDoctorName")}`.trim()
    : appointment?.patient_name || tCommon("patientAppointments.dialogs.reschedule.fallbackPatientName");

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
  const dayNames = React.useMemo(
    () => [
      tCommon("patientAppointments.dialogs.reschedule.dayShort.sun"),
      tCommon("patientAppointments.dialogs.reschedule.dayShort.mon"),
      tCommon("patientAppointments.dialogs.reschedule.dayShort.tue"),
      tCommon("patientAppointments.dialogs.reschedule.dayShort.wed"),
      tCommon("patientAppointments.dialogs.reschedule.dayShort.thu"),
      tCommon("patientAppointments.dialogs.reschedule.dayShort.fri"),
      tCommon("patientAppointments.dialogs.reschedule.dayShort.sat"),
    ],
    [tCommon],
  );
  const monthNames = React.useMemo(
    () => [
      tCommon("patientAppointments.dialogs.reschedule.monthNames.january"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.february"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.march"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.april"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.may"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.june"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.july"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.august"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.september"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.october"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.november"),
      tCommon("patientAppointments.dialogs.reschedule.monthNames.december"),
    ],
    [tCommon],
  );

  const renderCalendar = () => {
    const cells = [];

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
            ${isSelected ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}
          `}
        >
          {day}
        </button>
      );
    }

    return cells;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <RefreshCw className="w-5 h-5" />
            {tCommon("patientAppointments.dialogs.reschedule.title")}
          </DialogTitle>
          <DialogDescription>
            {tCommon("patientAppointments.dialogs.reschedule.description")}
          </DialogDescription>
        </DialogHeader>

        {appointment && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-xs text-orange-700 dark:text-orange-300">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                An administrator will review your proposed time first. Once approved, the other party will be notified to confirm or decline.
              </p>
            </div>

            {/* Current Appointment Summary */}
            <div className="bg-accent/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{tCommon("patientAppointments.dialogs.reschedule.currentAppointment")}</p>
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
                  aria-label={tCommon("patientAppointments.calendar.previousMonth")}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium text-sm">
                  {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                </span>
                <button
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="p-1 hover:bg-accent rounded"
                  aria-label={tCommon("patientAppointments.calendar.nextMonth")}
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
                  {tCommon("patientAppointments.dialogs.reschedule.selectSlotFor", {
                    date: formatDate(selectedDate),
                  })}
                </Label>
                {loadingSlots ? (
                  <div className="flex items-center justify-center py-4">
                    <ButtonLoader className="w-5 h-5 text-primary" />
                  </div>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {tCommon("patientAppointments.dialogs.reschedule.noSlots")}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
                    {slots.map((slot) => {
                      const isAvailable = slot.available ?? slot.is_available ?? false;
                      const isPast = Boolean(slot.is_past);
                      const isUnavailable = !isAvailable;
                      const isSelected = selectedSlot === slot.time;
                      
                      return (
                        <button
                          key={slot.time}
                          onClick={() => isAvailable && setSelectedSlot(slot.time)}
                          disabled={isUnavailable}
                          title={
                            isPast
                              ? tCommon("patientAppointments.dialogs.reschedule.pastSlotTitle")
                              : isUnavailable
                                ? tCommon("patientAppointments.dialogs.reschedule.unavailableSlotTitle")
                                : ""
                          }
                          className={`
                            p-2 text-sm rounded-lg border transition-colors
                            ${isUnavailable ? 'border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60' : ''}
                            ${isAvailable && !isSelected ? 'hover:border-primary hover:bg-primary/5 border-border' : ''}
                            ${isSelected ? 'bg-primary text-primary-foreground border-primary' : ''}
                          `}
                        >
                          <span>{slot.time}</span>
                          {isPast ? (
                            <span className="block text-[10px] uppercase tracking-wide">{tCommon("patientAppointments.dialogs.reschedule.past")}</span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {submitError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {submitError}
              </div>
            ) : null}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="reschedule-notes" className="text-sm font-medium">
                {tCommon("patientAppointments.dialogs.reschedule.additionalNotes")}
              </Label>
              <Textarea
                id="reschedule-notes"
                placeholder={tCommon("patientAppointments.dialogs.reschedule.additionalPlaceholder")}
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
            {tCommon("patientAppointments.dialogs.reschedule.cancel")}
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={loading || !selectedDate || !selectedSlot}
          >
            {loading ? (
              <>
                <ButtonLoader className="w-4 h-4 mr-2" />
                {tCommon("patientAppointments.dialogs.reschedule.rescheduling")}
              </>
            ) : (
              tCommon("patientAppointments.dialogs.reschedule.confirm")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

