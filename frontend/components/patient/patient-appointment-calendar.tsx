"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, User, MapPin, Clock } from "lucide-react";
import { cn, localDateKey, parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLocale, useTranslations } from "next-intl";

interface CalendarAppointment {
  id: string;
  date: string;
  appointment_date: string;
  slot_time: string | null;
  status: string;
  reason: string;
  notes: string | null;
  doctor_id: string;
  doctor_name: string | null;
  doctor_title: string | null;
  doctor_specialization: string | null;
  doctor_photo_url: string | null;
  hospital_name: string | null;
}

interface PatientAppointmentCalendarProps {
  appointments: CalendarAppointment[];
  onAppointmentClick?: (appointment: CalendarAppointment) => void;
}

export function PatientAppointmentCalendar({ 
  appointments,
  onAppointmentClick
}: PatientAppointmentCalendarProps) {
  const t = useTranslations("patientAppointmentCalendar");
  const locale = useLocale();
  const uiLocale = locale === "bn" ? "bn-BD" : "en-US";
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedAppointment, setSelectedAppointment] = React.useState<CalendarAppointment | null>(null);

  const monthFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(uiLocale, { month: "long", year: "numeric" }),
    [uiLocale]
  );

  const longDateFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(uiLocale, { weekday: "long", month: "short", day: "numeric", year: "numeric" }),
    [uiLocale]
  );

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek };
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const getDateString = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return localDateKey(date);
  };

  const getAppointmentsForDate = (day: number) => {
    const dateStr = getDateString(day);
    return appointments.filter(a => {
      const apptDate = localDateKey(a.date ?? a.appointment_date);
      return apptDate === dateStr;
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isPast = (day: number) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return date < today;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED':
        return 'bg-blue-500';
      case 'PENDING':
        return 'bg-yellow-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'CANCELLED':
        return 'bg-red-500';
      case 'PENDING_ADMIN_REVIEW':
        return 'bg-orange-500';
      case 'PENDING_DOCTOR_CONFIRMATION':
        return 'bg-amber-500';
      case 'PENDING_PATIENT_CONFIRMATION':
        return 'bg-amber-500';
      case 'RESCHEDULE_REQUESTED':
        return 'bg-purple-500';
      case 'CANCEL_REQUESTED':
        return 'bg-rose-400';
      case 'NO_SHOW':
        return 'bg-muted';
      default:
        return 'bg-primary';
    }
  };

  const handleDayClick = (day: number) => {
    const dateAppts = getAppointmentsForDate(day);
    if (dateAppts.length === 1) {
      // Show single appointment directly
      setSelectedAppointment(dateAppts[0]);
      setDetailsOpen(true);
    } else if (dateAppts.length > 1) {
      // Set selected date to show list
      setSelectedDate(getDateString(day));
    }
  };

  const handleAppointmentClick = (appointment: CalendarAppointment) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
    onAppointmentClick?.(appointment);
  };

  const formatDateTime = (dateStr: string, slotTime?: string | null) => {
    const date = new Date(dateStr);
    
    return {
      date: longDateFormatter.format(date),
      time: slotTime || date.toLocaleTimeString(uiLocale, { hour: 'numeric', minute: '2-digit', hour12: true })
    };
  };

  const getStatusLabel = (status: string) => {
    switch (status?.toUpperCase()) {
      case "CONFIRMED":
        return t("statuses.confirmed");
      case "PENDING":
        return t("statuses.pending");
      case "COMPLETED":
        return t("statuses.completed");
      case "CANCELLED":
        return t("statuses.cancelled");
      case "PENDING_ADMIN_REVIEW":
        return t("statuses.pendingAdminReview");
      case "PENDING_DOCTOR_CONFIRMATION":
        return t("statuses.pendingDoctorConfirmation");
      case "PENDING_PATIENT_CONFIRMATION":
        return t("statuses.pendingPatientConfirmation");
      case "RESCHEDULE_REQUESTED":
        return t("statuses.rescheduleRequested");
      case "CANCEL_REQUESTED":
        return t("statuses.cancelRequested");
      case "NO_SHOW":
        return t("statuses.noShow");
      default:
        return status;
    }
  };

  // Generate calendar grid
  const calendarDays = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const isCurrentDay = isToday(day);
    const isSelected = selectedDate === getDateString(day);
    const dayAppts = getAppointmentsForDate(day);
    const dayIsPast = isPast(day);

    calendarDays.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        className={cn(
          "aspect-square rounded-lg text-sm font-medium transition-all relative border p-1 min-h-[40px] md:min-h-[44px] touch-manipulation",
          isSelected && "bg-primary text-primary-foreground shadow-md scale-105 border-primary",
          !isSelected && isCurrentDay && "bg-primary-light border-2 border-primary text-foreground",
          !isSelected && !isCurrentDay && dayIsPast && "bg-muted text-muted-foreground",
          !isSelected && !isCurrentDay && !dayIsPast && "bg-[var(--calendar-cell-bg)] text-foreground hover:text-primary active:bg-primary/10",
          dayAppts.length > 0 && "font-bold hover:scale-105 active:scale-95",
          !isSelected && !isCurrentDay && "hover:bg-[var(--calendar-cell-hover)]"
        )}
        style={!isSelected && !isCurrentDay ? { borderColor: 'var(--calendar-border)' } : undefined}
      >
        <span className={cn(
          isSelected ? 'text-white' : dayIsPast ? 'text-muted-foreground' : 'text-[var(--calendar-date-foreground)]',
          'relative z-10 text-xs md:text-sm'
        )}>
          {day}
        </span>
        {dayAppts.length > 0 && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
            {dayAppts.slice(0, 3).map((appt, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "w-1 h-1 md:w-1.5 md:h-1.5 rounded-full",
                  isSelected ? "bg-[var(--calendar-cell-bg)]" : getStatusColor(appt.status)
                )} 
              />
            ))}
          </div>
        )}
        {dayAppts.length > 3 && !isSelected && (
          <div className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 w-3 h-3 md:w-4 md:h-4 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center font-bold">
            {dayAppts.length}
          </div>
        )}
      </button>
    );
  }

  const selectedDateAppts = selectedDate ? appointments.filter(a => a.date === selectedDate) : [];

  return (
    <>
      <Card className="rounded-2xl bg-[var(--calendar-card-bg)] border-primary/20 p-3 md:p-6">
        <div className="rounded-2xl bg-card shadow-md overflow-hidden">
          <CardHeader className="border-b border-primary/10 bg-primary-more-light/50 p-3 md:p-6">
          <div className="flex items-center justify-between flex-wrap gap-2 md:gap-3">
            <CardTitle className="text-base md:text-lg flex items-center gap-2 text-foreground whitespace-nowrap">
              <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <span className="hidden sm:inline">{t("myAppointments")}</span>
              <span className="sm:hidden">{t("appointments")}</span>
            </CardTitle>

            <div className="flex items-center gap-1 md:gap-2 whitespace-nowrap min-w-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                className="h-7 w-7 md:h-8 md:w-8 text-xs md:text-sm hover:bg-primary-light p-1 md:p-2"
              >
                <ChevronLeft className="w-3 h-3 md:w-4 md:h-4" />
              </Button>

              <span className="text-xs md:text-sm font-semibold min-w-0 text-center truncate px-1 md:px-2">
                {monthFormatter.format(currentMonth)}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                className="h-7 w-7 md:h-8 md:w-8 text-xs md:text-sm hover:bg-primary-light p-1 md:p-2"
              >
                <ChevronRight className="w-3 h-3 md:w-4 md:h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-2 md:p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-1 md:mb-2">
            {[
              t("weekdays.sun"),
              t("weekdays.mon"),
              t("weekdays.tue"),
              t("weekdays.wed"),
              t("weekdays.thu"),
              t("weekdays.fri"),
              t("weekdays.sat"),
            ].map((day, idx) => (
              <div
                key={idx}
                className="text-center text-xs font-semibold text-foreground py-1 md:py-2"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Calendar grid - smaller on mobile */}
          <div className="grid grid-cols-7 gap-0.5 md:gap-1 mb-3 md:mb-4">
            {calendarDays}
          </div>

          {/* Legend - horizontal scroll on mobile */}
          <div className="pt-2 md:pt-4 border-t border-primary/10">
            <div className="flex overflow-x-auto gap-2 md:gap-3 text-xs pb-2 md:pb-0">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                <span className="text-muted-foreground leading-none whitespace-nowrap">{t("statuses.confirmed")}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="text-muted-foreground leading-none whitespace-nowrap">{t("statuses.pending")}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-muted-foreground leading-none whitespace-nowrap">{t("statuses.completed")}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <div className="w-3 h-3 rounded border-2 border-primary flex-shrink-0" />
                <span className="text-muted-foreground leading-none whitespace-nowrap">{t("today")}</span>
              </div>
            </div>
          </div>
        </CardContent>
        </div>
      </Card>

      {/* Selected Date Appointments List */}
      {selectedDate && selectedDateAppts.length > 1 && (
        <Card className="mt-4 rounded-2xl shadow-lg bg-[var(--calendar-card-bg)] border-primary/20">
          <CardHeader className="border-b border-primary/10 p-3 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm md:text-base truncate">
                {t("appointmentsOn", { date: formatDateTime(selectedDate).date })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)} className="h-8 w-8 p-0 md:h-10 md:w-auto md:px-3">
                <span className="hidden md:inline">{t("close")}</span>
                <span className="md:hidden text-sm">✕</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4 space-y-2 md:space-y-3">
            {selectedDateAppts.map((appt) => (
              <button
                key={appt.id}
                onClick={() => handleAppointmentClick(appt)}
                className="w-full p-3 md:p-4 rounded-lg border border-primary/20 bg-primary-more-light/30 hover:bg-primary-more-light active:bg-primary-more-light/50 transition-colors text-left touch-manipulation"
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <span className="font-semibold text-foreground text-sm md:text-base truncate">
                    {appt.doctor_title} {appt.doctor_name}
                  </span>
                  <Badge className={cn("text-xs text-white flex-shrink-0", getStatusColor(appt.status))}>
                    {getStatusLabel(appt.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>{appt.slot_time || t("timeNotSet")}</span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Appointment Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              {t("appointmentDetails")}
            </DialogTitle>
            {selectedAppointment && (
              <DialogDescription>
                {formatDateTime(selectedAppointment.appointment_date, selectedAppointment.slot_time).date}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {selectedAppointment && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    {selectedAppointment.doctor_photo_url ? (
                      <Image
                        src={selectedAppointment.doctor_photo_url}
                        alt={selectedAppointment.doctor_name || t("doctorFallback")}
                        width={48}
                        height={48}
                        className="w-12 h-12 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <User className="w-6 h-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {selectedAppointment.doctor_title} {selectedAppointment.doctor_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAppointment.doctor_specialization}
                    </p>
                  </div>
                </div>
                <Badge className={cn("text-white", getStatusColor(selectedAppointment.status))}>
                  {getStatusLabel(selectedAppointment.status)}
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-foreground bg-primary-more-light/50 p-3 rounded-lg">
                  <Clock className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">{selectedAppointment.slot_time || t("timeNotSet")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(selectedAppointment.appointment_date).date}
                    </p>
                  </div>
                </div>
                
                {selectedAppointment.hospital_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedAppointment.hospital_name}</span>
                  </div>
                )}
                
                {selectedAppointment.reason && (
                  <div className="bg-accent/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">{t("consultation")}</p>
                    {(() => {
                      const { consultationType, appointmentType } = parseCompositeReason(selectedAppointment.reason)
                      const ct = humanizeConsultationType(consultationType)
                      const at = humanizeAppointmentType(appointmentType)
                      return (
                        <>
                          <p className="text-foreground">{ct}{at ? ` | ${at}` : ''}</p>
                          {selectedAppointment.notes && <p className="text-xs text-muted-foreground mt-1">{selectedAppointment.notes}</p>}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

