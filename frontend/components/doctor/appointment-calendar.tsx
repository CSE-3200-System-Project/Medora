"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn, localDateKey } from "@/lib/utils";

interface AppointmentInfo {
  id: string;
  status: string;
  patient_name?: string;
}

interface AppointmentCalendarProps {
  onDateSelect: (date: string) => void;
  selectedDate: string | null;
  appointmentDates: string[]; // Dates with appointments
  appointmentsByDate?: Record<string, AppointmentInfo[]>; // Appointments grouped by date
}

export function AppointmentCalendar({ 
  onDateSelect, 
  selectedDate,
  appointmentDates,
  appointmentsByDate = {}
}: AppointmentCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
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

  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = localDateKey(date);
    onDateSelect(dateStr);
  };

  const getDateString = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    return localDateKey(date);
  };

  const hasAppointment = (day: number) => {
    const dateStr = getDateString(day);
    // Normalize appointmentDates to local keys when checking
    return appointmentDates.map(d => localDateKey(d)).includes(dateStr);
  };

  const getAppointmentCount = (day: number) => {
    const dateStr = getDateString(day);
    return appointmentsByDate[dateStr]?.length || 0;
  };

  const getAppointmentStatus = (day: number) => {
    const dateStr = getDateString(day);
    const appts = appointmentsByDate[dateStr] || [];
    if (appts.length === 0) return null;
    
    // Priority: CONFIRMED > PENDING > COMPLETED
    if (appts.some(a => a.status === 'CONFIRMED')) return 'CONFIRMED';
    if (appts.some(a => a.status === 'PENDING')) return 'PENDING';
    if (appts.some(a => a.status === 'COMPLETED')) return 'COMPLETED';
    return null;
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

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const dateStr = getDateString(day);
    return dateStr === selectedDate;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
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

  // Generate calendar grid
  const calendarDays = [];
  
  // Empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="aspect-square" />);
  }

  // Actual days
  for (let day = 1; day <= daysInMonth; day++) {
    const isCurrentDay = isToday(day);
    const isSelectedDay = isSelected(day);
    const hasAppt = hasAppointment(day);
    const apptCount = getAppointmentCount(day);
    const apptStatus = getAppointmentStatus(day);
    const dayIsPast = isPast(day);

    calendarDays.push(
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        className={cn(
          "aspect-square rounded text-[10px] font-medium transition-all relative p-0.5 border p-1",
          !isSelectedDay && "hover:bg-[var(--calendar-cell-hover)] hover:scale-105",
          isSelectedDay && "bg-primary text-primary-foreground shadow-md scale-105",
          !isSelectedDay && isCurrentDay && "bg-primary-light border-2 border-primary text-blue-900",
          !isSelectedDay && !isCurrentDay && dayIsPast && "bg-muted/50 text-muted-foreground",
          !isSelectedDay && !isCurrentDay && !dayIsPast && "bg-[var(--calendar-cell-bg)] text-blue-900 hover:text-primary"
        )}
        style={!isSelectedDay && !isCurrentDay ? { borderColor: 'var(--calendar-border)' } : undefined}
      >
        <span className={cn(
          isSelectedDay ? 'text-white' : dayIsPast ? 'text-muted-foreground' : 'text-[var(--calendar-date-foreground)]',
          'relative z-10 text-[10px]'
        )}>{day}</span>
        {hasAppt && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-0.5">
            {apptCount > 0 && (
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isSelectedDay ? "bg-[var(--calendar-cell-bg)]" : getStatusColor(apptStatus)
              )} />
            )}
            {apptCount > 1 && (
              <div className={cn(
                "w-1.5 h-1.5 rounded-full",
                isSelectedDay ? "bg-[var(--calendar-cell-bg)]/70" : `${getStatusColor(apptStatus)} opacity-60`
              )} />
            )}
          </div>
        )}
        {apptCount > 2 && !isSelectedDay && (
          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary text-primary-foreground text-[6px] rounded-full flex items-center justify-center font-bold">
            {apptCount}
          </div>
        )}
      </button>
    );
  }

  return (
    <Card className="rounded-2xl bg-[var(--calendar-card-bg)] border-primary/20 p-6">
      <div className="rounded-2xl bg-card shadow-md overflow-hidden">
        <CardHeader className="border-b border-blue-200 pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm flex items-center gap-1.5 text-blue-900 whitespace-nowrap">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-1 whitespace-nowrap min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-6 w-6 hover:bg-blue-100"
            >
              <ChevronLeft className="w-3 h-3 text-blue-700" />
            </Button>
            <span className="text-[10px] font-semibold min-w-0 text-center truncate text-blue-800">
              {monthNames[currentMonth.getMonth()].slice(0, 3)} {currentMonth.getFullYear()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNextMonth}
              className="h-6 w-6 hover:bg-blue-100"
            >
              <ChevronRight className="w-3 h-3 text-blue-700" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 mb-0.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
            <div
              key={idx}
              className="text-center text-[9px] font-semibold text-blue-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {calendarDays}
        </div>

        {/* Legend */}
        <div className="mt-2 pt-2 border-t border-blue-200 grid grid-cols-2 gap-1 text-[8px] text-blue-700">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded border-2 border-primary" />
            <span>Today</span>
          </div>
        </div>
      </CardContent>
        </div>
    </Card>
  );
}

