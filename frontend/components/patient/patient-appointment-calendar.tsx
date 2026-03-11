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
  const [currentMonth, setCurrentMonth] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [selectedAppointment, setSelectedAppointment] = React.useState<CalendarAppointment | null>(null);

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
      default:
        return 'bg-gray-500';
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
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      date: `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
      time: slotTime || date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
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
          "aspect-square rounded-lg text-sm font-medium transition-all relative border p-1",
          isSelected && "bg-primary text-white shadow-md scale-105 border-primary",
          !isSelected && isCurrentDay && "bg-primary-light border-2 border-primary text-foreground",
          !isSelected && !isCurrentDay && dayIsPast && "bg-muted text-muted-foreground",
          !isSelected && !isCurrentDay && !dayIsPast && "bg-[var(--calendar-cell-bg)] text-foreground hover:text-primary",
          dayAppts.length > 0 && "font-bold hover:scale-105",
          !isSelected && !isCurrentDay && "hover:bg-[var(--calendar-cell-hover)]"
        )}
        style={!isSelected && !isCurrentDay ? { borderColor: 'var(--calendar-border)' } : undefined}
      >
        <span className={cn(
          isSelected ? 'text-white' : dayIsPast ? 'text-muted-foreground' : 'text-[var(--calendar-date-foreground)]',
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
                  isSelected ? "bg-[var(--calendar-cell-bg)]" : getStatusColor(appt.status)
                )} 
              />
            ))}
          </div>
        )}
        {dayAppts.length > 3 && !isSelected && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[8px] rounded-full flex items-center justify-center font-bold">
            {dayAppts.length}
          </div>
        )}
      </button>
    );
  }

  const selectedDateAppts = selectedDate ? appointments.filter(a => a.date === selectedDate) : [];

  return (
    <>
      <Card className="rounded-2xl bg-[var(--calendar-card-bg)] border-primary/20 p-6">
        <div className="rounded-2xl bg-white shadow-md overflow-hidden">
          <CardHeader className="border-b border-primary/10 bg-primary-more-light/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2 text-foreground whitespace-nowrap">
              <CalendarIcon className="w-5 h-5 text-primary" />
              My Appointments
            </CardTitle>

            <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handlePrevMonth}
                className="h-8 w-8 hover:bg-primary-light"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-sm font-semibold min-w-0 text-center truncate">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>

              <Button
                variant="ghost"
                size="icon"
                onClick={handleNextMonth}
                className="h-8 w-8 hover:bg-primary-light"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
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
          <div className="mt-4 pt-4 border-t border-primary/10 flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
              <span className="text-muted-foreground leading-none">Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
              <span className="text-muted-foreground leading-none">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <span className="text-muted-foreground leading-none">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border-2 border-primary flex-shrink-0" />
              <span className="text-muted-foreground leading-none">Today</span>
            </div>
          </div>
        </CardContent>
        </div>
      </Card>

      {/* Selected Date Appointments List */}
      {selectedDate && selectedDateAppts.length > 1 && (
        <Card className="mt-4 rounded-2xl shadow-lg bg-[var(--calendar-card-bg)] border-primary/20">
          <CardHeader className="border-b border-primary/10">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Appointments on {formatDateTime(selectedDate).date}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {selectedDateAppts.map((appt) => (
              <button
                key={appt.id}
                onClick={() => handleAppointmentClick(appt)}
                className="w-full p-3 rounded-lg border border-primary/20 bg-primary-more-light/30 hover:bg-primary-more-light transition-colors text-left"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-foreground">
                    {appt.doctor_title} {appt.doctor_name}
                  </span>
                  <Badge className={cn("text-xs text-white", getStatusColor(appt.status))}>
                    {appt.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>{appt.slot_time || "Time not set"}</span>
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
              Appointment Details
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
                        alt={selectedAppointment.doctor_name || "Doctor"}
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
                  {selectedAppointment.status}
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-foreground bg-primary-more-light/50 p-3 rounded-lg">
                  <Clock className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">{selectedAppointment.slot_time || "Time not set"}</p>
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
                    <p className="text-xs text-muted-foreground mb-1">Consultation</p>
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
