"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppBackground } from "@/components/ui/app-background";
import { AppointmentCalendar } from "@/components/ui/appointment-calendar";
import { getPatientCalendarAppointments, updateAppointment, syncAppointmentStatus } from "@/lib/appointment-actions";
import { Calendar, Clock, User, XCircle, MapPin, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn, localDateKey } from "@/lib/utils";

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = React.useState<any>(null);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  React.useEffect(() => {
    // Sync status first (auto-complete past appointments), then load
    const init = async () => {
      await syncAppointmentStatus();
      loadAppointments();
    };
    init();
  }, []);

  const loadAppointments = async () => {
    try {
      const data = await getPatientCalendarAppointments();
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const openCancelDialog = (appt: any) => {
    setAppointmentToCancel(appt);
    setCancelDialogOpen(true);
  };

  const confirmCancel = async () => {
    if (!appointmentToCancel) return;

    try {
      await updateAppointment(appointmentToCancel.id, { status: 'CANCELLED' });
      loadAppointments();
      setCancelDialogOpen(false);
      setAppointmentToCancel(null);
    } catch (error) {
      console.error("Failed to cancel appointment:", error);
      alert("Failed to cancel appointment. Please try again.");
    }
  };

  const formatDateTime = (dateStr: string, slotTime?: string | null) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return {
      date: `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`,
      time: slotTime || date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    };
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED': return 'default';
      case 'PENDING': return 'warning';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'CONFIRMED': return <CheckCircle2 className="w-3 h-3" />;
      case 'PENDING': return <Clock className="w-3 h-3" />;
      case 'COMPLETED': return <CheckCircle2 className="w-3 h-3" />;
      case 'CANCELLED': return <XCircle className="w-3 h-3" />;
      default: return null;
    }
  };

  const handleDateSelect = (date: string | null) => {
    setSelectedDate(date);
  };

  // Separate upcoming and past appointments
  const now = new Date();
  
  // Deduplicate appointments by id
  const uniqueAppointments = appointments.filter(
    (appt, index, self) => index === self.findIndex(a => a.id === appt.id)
  );

  // Filter by date if selected
  const dateFilteredAppointments = selectedDate
    ? uniqueAppointments.filter(appt => {
        const apptDate = localDateKey(appt.appointment_date);
        return apptDate === selectedDate;
      })
    : uniqueAppointments;
  
  const upcomingAppointments = dateFilteredAppointments.filter(
    appt => new Date(appt.appointment_date) >= now && appt.status !== 'CANCELLED'
  ).sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

  const pastAppointments = dateFilteredAppointments.filter(
    appt => new Date(appt.appointment_date) < now || appt.status === 'CANCELLED'
  ).sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());

  // Pagination for all filtered appointments
  const allFilteredAppointments = [...upcomingAppointments, ...pastAppointments];
  const totalPages = Math.ceil(allFilteredAppointments.length / itemsPerPage);
  const paginatedAppointments = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return allFilteredAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [allFilteredAppointments, currentPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate]);

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 pt-24 md:pt-28">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Appointments</h1>
            <p className="text-muted-foreground mt-2">
              Track your upcoming and past consultations
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="skeleton w-8 h-8 rounded-full"></div>
          </div>
        ) : appointments.length === 0 ? (
          <Card hoverable>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No appointments found</p>
              <p className="text-muted-foreground">Book an appointment with a doctor to get started.</p>
              <Button className="mt-4 touch-target" onClick={() => window.location.href = '/patient/find-doctor'}>
                Find a Doctor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Top Section: Calendar (1 col) + Upcoming Appointments (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar - 1 Column */}
              <div>
                <AppointmentCalendar
                  appointments={uniqueAppointments}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  title="My Appointments"
                />
              </div>
              
              {/* Upcoming Appointments - 1 Column */}
              <div>
                <Card className="rounded-2xl shadow-lg h-full">
                  <CardHeader className="border-b border-border/50">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Upcoming Appointments
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Next {Math.min(5, upcomingAppointments.length)} appointments
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    {upcomingAppointments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No upcoming appointments</p>
                        {!selectedDate && (
                          <Button 
                            className="mt-3 touch-target" 
                            size="sm"
                            onClick={() => window.location.href = '/patient/find-doctor'}
                          >
                            Find a Doctor
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {upcomingAppointments.slice(0, 5).map((appt) => {
                          const { date, time } = formatDateTime(appt.appointment_date, appt.slot_time);
                          
                          return (
                            <div
                              key={appt.id}
                              className="p-3 rounded-lg border border-blue-200 bg-white dark:bg-card hover:bg-blue-50 dark:hover:bg-card/80 transition-all"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {appt.doctor_photo_url ? (
                                      <img 
                                        src={appt.doctor_photo_url} 
                                        alt="" 
                                        className="w-8 h-8 rounded-full object-cover"
                                      />
                                    ) : (
                                      <User className="w-4 h-4 text-primary" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-foreground truncate">
                                      {appt.doctor_title} {appt.doctor_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {appt.doctor_specialization}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={getStatusBadgeVariant(appt.status)} className="flex items-center gap-1 shrink-0 text-xs">
                                  {getStatusIcon(appt.status)}
                                  {appt.status}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-primary/10 p-2 rounded">
                                <Clock className="w-3 h-3 text-primary flex-shrink-0" />
                                <span className="font-medium">{time}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* All Appointments List - Full Width with Pagination */}
            <Card className="rounded-2xl shadow-lg">
              <CardHeader className="border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    {selectedDate ? (
                      <div className="flex items-center gap-2">
                        <span>Appointments on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedDate(null)}
                          className="ml-2 h-7 text-xs"
                        >
                          Show All
                        </Button>
                      </div>
                    ) : (
                      'All Appointments'
                    )}
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    Showing {paginatedAppointments.length} of {allFilteredAppointments.length}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {allFilteredAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">
                      {selectedDate ? 'No appointments on this date' : 'No appointments found'}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedDate ? 'Try selecting a different date.' : 'Book an appointment with a doctor to get started.'}
                    </p>
                    {!selectedDate ? (
                      <Button className="mt-4 touch-target" onClick={() => window.location.href = '/patient/find-doctor'}>
                        Find a Doctor
                      </Button>
                    ) : (
                      <Button 
                        className="mt-4 touch-target" 
                        variant="outline"
                        onClick={() => setSelectedDate(null)}
                      >
                        Show All Appointments
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Appointments List */}
                    <div className="space-y-3">
                      {paginatedAppointments.map((appt) => {
                        const { date, time } = formatDateTime(appt.appointment_date, appt.slot_time);
                        const isPast = new Date(appt.appointment_date) < now || appt.status === 'CANCELLED';
                        
                        return (
                          <div
                            key={appt.id}
                            className={cn(
                              "p-4 rounded-lg border-2 transition-all",
                              "border-blue-200 bg-white dark:bg-card hover:bg-blue-50 dark:hover:bg-card/80",
                              isPast && "opacity-75"
                            )}
                          >
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex items-start gap-3">
                                <div className="w-12 h-12 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center shrink-0">
                                  {appt.doctor_photo_url ? (
                                    <img 
                                      src={appt.doctor_photo_url} 
                                      alt="" 
                                      className={cn(
                                        "w-12 h-12 rounded-full object-cover",
                                        isPast && "grayscale"
                                      )}
                                    />
                                  ) : (
                                    <User className="w-6 h-6 text-primary" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-semibold text-foreground text-base">
                                    {appt.doctor_title} {appt.doctor_name}
                                  </p>
                                  <p className="text-sm text-primary font-medium">
                                    {appt.doctor_specialization}
                                  </p>
                                </div>
                              </div>
                              <Badge variant={getStatusBadgeVariant(appt.status)} className="flex items-center gap-1 shrink-0">
                                {getStatusIcon(appt.status)}
                                {appt.status}
                              </Badge>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2 text-foreground bg-blue-50 dark:bg-primary/10 p-2 rounded">
                                <Clock className="w-4 h-4 text-primary shrink-0" />
                                <div>
                                  <div className="font-medium">{time}</div>
                                  <div className="text-xs text-muted-foreground">{date}</div>
                                </div>
                              </div>

                              {appt.hospital_name && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <MapPin className="w-4 h-4 shrink-0" />
                                  <span className="text-xs">{appt.hospital_name}</span>
                                </div>
                              )}

                              {appt.reason && (
                                <div className="bg-accent/50 dark:bg-accent/20 rounded p-2">
                                  <p className="text-xs text-muted-foreground mb-1">Reason</p>
                                  <p className="text-sm text-foreground">{appt.reason}</p>
                                </div>
                              )}
                            </div>

                            {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && !isPast && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openCancelDialog(appt)}
                                className="mt-3 w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs touch-target"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancel Appointment
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                        <div className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              Cancel Appointment
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {appointmentToCancel && (
            <div className="bg-accent/50 rounded-lg p-4 mt-2">
              <p className="font-semibold text-foreground">
                {appointmentToCancel.doctor_title} {appointmentToCancel.doctor_name}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {formatDateTime(appointmentToCancel.appointment_date, appointmentToCancel.slot_time).date}
              </p>
              <p className="text-sm text-muted-foreground">
                {appointmentToCancel.slot_time || "Time not set"}
              </p>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="touch-target">
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={confirmCancel} className="touch-target">
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppBackground>
  );
}
