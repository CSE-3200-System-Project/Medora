"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentCalendarProps {
  onDateSelect: (date: string) => void;
  selectedDate: string | null;
  appointmentDates: string[]; // Dates with appointments
}

export function AppointmentCalendar({ 
  onDateSelect, 
  selectedDate,
  appointmentDates 
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
    const dateStr = date.toISOString().split('T')[0];
    onDateSelect(dateStr);
  };

  const hasAppointment = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    return appointmentDates.includes(dateStr);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dateStr = date.toISOString().split('T')[0];
    return dateStr === selectedDate;
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

    calendarDays.push(
      <button
        key={day}
        onClick={() => handleDateClick(day)}
        className={cn(
          "aspect-square rounded text-[10px] font-medium transition-all relative p-0.5",
          "hover:bg-blue-200 hover:scale-105",
          isSelectedDay && "bg-primary text-white shadow-md scale-105",
          !isSelectedDay && isCurrentDay && "bg-blue-100 border border-primary text-blue-900",
          !isSelectedDay && !isCurrentDay && "bg-white text-blue-900 hover:text-primary"
        )}
      >
        {day}
        {hasAppt && !isSelectedDay && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-primary" />
        )}
      </button>
    );
  }

  return (
    <Card className="rounded-2xl shadow-lg bg-blue-50 border-blue-200">
      <CardHeader className="border-b border-blue-200 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5 text-blue-900">
            <CalendarIcon className="w-3.5 h-3.5 text-primary" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevMonth}
              className="h-6 w-6 hover:bg-blue-100"
            >
              <ChevronLeft className="w-3 h-3 text-blue-700" />
            </Button>
            <span className="text-[10px] font-semibold min-w-20 text-center text-blue-800">
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

        <div className="mt-1.5 pt-1.5 border-t border-blue-200 flex items-center gap-2 text-[9px] text-blue-600">
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-1 rounded-full bg-primary" />
            <span>Appts</span>
          </div>
          <div className="flex items-center gap-0.5">
            <div className="w-1 h-1 rounded-full border border-primary" />
            <span>Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
