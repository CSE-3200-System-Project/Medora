"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { AppointmentCalendar } from "@/components/doctor/appointment-calendar";
import { TimeSlotGrid } from "@/components/doctor/time-slot-grid";
import { AppointmentList } from "@/components/doctor/appointment-list";
import { getMyAppointments, getAppointmentsByDate, updateAppointment } from "@/lib/appointment-actions";

type ViewMode = 'calendar' | 'slots';

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [viewMode, setViewMode] = React.useState<ViewMode>('calendar');
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [daySlots, setDaySlots] = React.useState<any[]>([]);
  const [highlightedAppointmentId, setHighlightedAppointmentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const data = await getMyAppointments();
      setAppointments(data);
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = async (date: string) => {
    setSelectedDate(date);
    setViewMode('slots');
    
    // Fetch time slots for this date
    try {
      const slots = await getAppointmentsByDate(date);
      setDaySlots(slots);
    } catch (error) {
      console.error("Failed to fetch slots:", error);
    }
  };

  const handleBackToCalendar = () => {
    setViewMode('calendar');
    setSelectedDate(null);
    setHighlightedAppointmentId(null);
  };

  const handleSlotClick = (appointmentId: string) => {
    setHighlightedAppointmentId(appointmentId);
  };

  const handleAppointmentClick = (appointmentId: string) => {
    // Find appointment date and switch to slots view
    const appointment = appointments.find(a => a.id === appointmentId);
    if (appointment) {
      const date = new Date(appointment.appointment_date).toISOString().split('T')[0];
      handleDateSelect(date);
      setHighlightedAppointmentId(appointmentId);
    }
  };

  const handleCancelAppointment = async (appointmentId: string) => {
    try {
      await updateAppointment(appointmentId, { status: 'CANCELLED' });
      // Refresh appointments list
      loadAppointments();
      // Refresh slots if viewing a date
      if (selectedDate) {
        const slots = await getAppointmentsByDate(selectedDate);
        setDaySlots(slots);
      }
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      alert("Failed to cancel appointment. Please try again.");
    }
  };

  const handleApproveAppointment = async (appointmentId: string) => {
    try {
      await updateAppointment(appointmentId, { status: 'CONFIRMED' });
      // Refresh appointments list
      loadAppointments();
      // Refresh slots if viewing a date
      if (selectedDate) {
        const slots = await getAppointmentsByDate(selectedDate);
        setDaySlots(slots);
      }
    } catch (error) {
      console.error("Failed to approve appointment:", error);
      alert("Failed to approve appointment. Please try again.");
    }
  };

  const handleRejectAppointment = async (appointmentId: string) => {
    try {
      await updateAppointment(appointmentId, { status: 'CANCELLED' });
      // Refresh appointments list
      loadAppointments();
      // Refresh slots if viewing a date
      if (selectedDate) {
        const slots = await getAppointmentsByDate(selectedDate);
        setDaySlots(slots);
      }
    } catch (error) {
      console.error("Failed to reject appointment:", error);
      alert("Failed to reject appointment. Please try again.");
    }
  };

  // Extract unique dates with appointments for calendar highlighting
  const appointmentDates = React.useMemo(() => {
    return [...new Set(
      appointments.map(appt => 
        new Date(appt.appointment_date).toISOString().split('T')[0]
      )
    )];
  }, [appointments]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-surface via-primary-more-light to-accent">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-surface via-primary-more-light to-accent">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Appointments Management
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            Manage your patient bookings and schedule
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Side - Appointment List */}
          <div className="order-2 lg:order-1">
            <AppointmentList
              appointments={appointments}
              highlightedId={highlightedAppointmentId}
              onAppointmentClick={handleAppointmentClick}
              onCancelAppointment={handleCancelAppointment}
              onApproveAppointment={handleApproveAppointment}
              onRejectAppointment={handleRejectAppointment}
            />
          </div>

          {/* Right Side - Calendar or Time Slots */}
          <div className="order-1 lg:order-2">
            {viewMode === 'calendar' ? (
              <AppointmentCalendar
                onDateSelect={handleDateSelect}
                selectedDate={selectedDate}
                appointmentDates={appointmentDates}
              />
            ) : (
              <TimeSlotGrid
                selectedDate={selectedDate!}
                slots={daySlots}
                onSlotClick={handleSlotClick}
                onBack={handleBackToCalendar}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
