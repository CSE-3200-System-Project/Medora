"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn, localDateKey } from "@/lib/utils";
import { useAppI18n, useT } from "@/i18n/client";

interface CalendarAppointment {
  appointment_date?: string;
  date?: string;
  appointmentDate?: string;
  appointment_date_local?: string;
  date_local?: string;
  status?: string;
}

interface AppointmentCalendarProps {
  appointments: CalendarAppointment[];
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  title?: string;
  className?: string;
}

export function AppointmentCalendar({ 
  appointments,
  selectedDate,
  onDateSelect,
  title,
  className
}: AppointmentCalendarProps) {
  const { locale } = useAppI18n();
  const tCommon = useT("common");
  const resolvedTitle = title || tCommon("patientAppointments.calendar.title");
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const localeTag = locale === "bn" ? "bn-BD" : "en-US";
  const monthLabel = new Intl.DateTimeFormat(localeTag, { month: "long" }).format(currentMonth);
  const dayShortLabels = [
    tCommon("patientAppointments.calendar.dayShort.sun"),
    tCommon("patientAppointments.calendar.dayShort.mon"),
    tCommon("patientAppointments.calendar.dayShort.tue"),
    tCommon("patientAppointments.calendar.dayShort.wed"),
    tCommon("patientAppointments.calendar.dayShort.thu"),
    tCommon("patientAppointments.calendar.dayShort.fri"),
    tCommon("patientAppointments.calendar.dayShort.sat"),
  ];

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
    return appointments.filter((appointment) => {
      const a = appointment;
      const rawDate = a.appointment_date || a.date || a.appointmentDate || a.appointment_date_local || a.date_local;
      if (!rawDate) {
        return false;
      }

      const apptDate = localDateKey(rawDate);
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

  const getStatusColor = (status?: string) => {
  const getStatusColor = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED':
        return 'bg-blue-500';
      case 'PENDING':
        return 'bg-yellow-500';
      case 'COMPLETED':
        return 'bg-green-500';
      case 'CANCELLED':
      case 'CANCELLED_BY_PATIENT':
      case 'CANCELLED_BY_DOCTOR':
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
    const dateStr = getDateString(day);
    const dayAppts = getAppointmentsForDate(day);
    
    // Toggle selection: if clicking same date, deselect (show all)
    if (selectedDate === dateStr) {
      onDateSelect(null);
    } else if (dayAppts.length > 0) {
      // Only select dates with appointments
      onDateSelect(dateStr);
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
    const hasAppointments = dayAppts.length > 0;

    calendarDays.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        disabled={!hasAppointments}
        className={cn(
          "aspect-square rounded-lg text-sm font-medium transition-all relative border p-1",
          hasAppointments && "hover:scale-105 cursor-pointer",
          !hasAppointments && "cursor-default",
          isSelected && "bg-primary text-primary-foreground shadow-md scale-105 ring-2 ring-primary/50 border-primary",
          !isSelected && isCurrentDay && "bg-primary/10 border-2 border-primary text-foreground",
          !isSelected && !isCurrentDay && dayIsPast && "bg-muted text-muted-foreground",
          !isSelected && !isCurrentDay && !dayIsPast && "bg-background text-foreground",
          hasAppointments && "font-bold hover:text-primary",
          !isSelected && !isCurrentDay && "hover:bg-accent/70",
          !hasAppointments && "opacity-50"
        )}
        style={!isSelected && !isCurrentDay ? { borderColor: "hsl(var(--border))" } : undefined}
      >
        <span className={cn(
          isSelected ? 'text-white' : dayIsPast ? 'text-muted-foreground' : 'text-foreground',
          'relative z-10'
        )}>
          {day}
        </span>
        {dayAppts.length > 0 && (
          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
            {dayAppts.slice(0, 3).map((appt, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  isSelected ? "bg-background" : getStatusColor(appt.status)
                )} 
              />
            ))}
          </div>
        )}
        {dayAppts.length > 3 && !isSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-[8px] rounded-full flex items-center justify-center font-bold">
            {dayAppts.length}
          </div>
        )}
      </button>
    );
  }

  return (
    <Card className={cn("rounded-2xl border border-border bg-card shadow-sm p-0 overflow-hidden", className)}>
      <CardHeader className="border-b border-border/70 bg-muted/30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2 text-foreground whitespace-nowrap">
            <CalendarIcon className="w-5 h-5 text-primary" />
            {resolvedTitle}
          </CardTitle>
          <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-8 w-8 hover:bg-accent"
              aria-label={tCommon("patientAppointments.calendar.previousMonth")}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-semibold min-w-0 text-center truncate">
              {monthLabel} {currentMonth.getFullYear()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-8 w-8 hover:bg-accent"
              aria-label={tCommon("patientAppointments.calendar.nextMonth")}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {selectedDate && (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {tCommon("patientAppointments.calendar.showingSelected")}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDateSelect(null)}
              className="text-xs h-7"
            >
              {tCommon("patientAppointments.calendar.showAll")}
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {dayShortLabels.map((day, idx) => (
              <div
                key={idx}
                className="text-center text-xs font-semibold text-foreground py-2"
              >
                {day}
              </div>
            ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays}
        </div>

        {/* Legend */}
        <div className="mt-4 pt-4 border-t border-border/70 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-muted-foreground leading-none">{tCommon("patientAppointments.calendar.legend.confirmed")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span className="text-muted-foreground leading-none">{tCommon("patientAppointments.calendar.legend.pending")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-muted-foreground leading-none">{tCommon("patientAppointments.calendar.legend.completed")}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded border-2 border-primary shrink-0" />
            <span className="text-muted-foreground leading-none">{tCommon("patientAppointments.calendar.legend.today")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

