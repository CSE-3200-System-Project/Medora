"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPatientCalendarAppointments, updateAppointment, syncAppointmentStatus } from "@/lib/appointment-actions";
import { PatientAppointmentCalendar } from "@/components/patient/patient-appointment-calendar";
import { Calendar, Clock, User, XCircle, RefreshCw, MapPin, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [appointmentToCancel, setAppointmentToCancel] = React.useState<any>(null);
  const [viewMode, setViewMode] = React.useState<'calendar' | 'list'>('calendar');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

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

  // Separate upcoming and past appointments
  const now = new Date();
  
  // Deduplicate appointments by id
  const uniqueAppointments = appointments.filter(
    (appt, index, self) => index === self.findIndex(a => a.id === appt.id)
  );
  
  // Count appointments by status
  const statusCounts = {
    all: uniqueAppointments.length,
    pending: uniqueAppointments.filter(a => a.status?.toUpperCase() === 'PENDING').length,
    confirmed: uniqueAppointments.filter(a => a.status?.toUpperCase() === 'CONFIRMED').length,
    cancelled: uniqueAppointments.filter(a => a.status?.toUpperCase() === 'CANCELLED').length,
    completed: uniqueAppointments.filter(a => a.status?.toUpperCase() === 'COMPLETED').length,
  };
  
  // Filter by status
  const filteredAppointments = statusFilter === 'all'
    ? uniqueAppointments
    : uniqueAppointments.filter(appt => appt.status?.toUpperCase() === statusFilter.toUpperCase());
  
  const upcomingAppointments = filteredAppointments.filter(
    appt => new Date(appt.appointment_date) >= now && appt.status !== 'CANCELLED'
  ).sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

  const pastAppointments = filteredAppointments.filter(
    appt => new Date(appt.appointment_date) < now || appt.status === 'CANCELLED'
  ).sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime());

  return (
    <div className="min-h-screen bg-linear-to-br from-surface via-primary-more-light to-accent">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Appointments</h1>
            <p className="text-muted-foreground mt-2">
              Track your upcoming and past consultations
            </p>
          </div>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Calendar
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <User className="w-4 h-4 mr-2" />
              List
            </Button>
          </div>
        </div>
        
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="text-xs"
          >
            All ({statusCounts.all})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
            className={cn("text-xs", statusFilter === 'pending' && "bg-yellow-500 hover:bg-yellow-600")}
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Pending ({statusCounts.pending})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('confirmed')}
            className={cn("text-xs", statusFilter === 'confirmed' && "bg-blue-500 hover:bg-blue-600")}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Confirmed ({statusCounts.confirmed})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('cancelled')}
            className={cn("text-xs", statusFilter === 'cancelled' && "bg-red-500 hover:bg-red-600")}
          >
            <XCircle className="w-3 h-3 mr-1" />
            Cancelled ({statusCounts.cancelled})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('completed')}
            className={cn("text-xs", statusFilter === 'completed' && "bg-green-500 hover:bg-green-600")}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed ({statusCounts.completed})
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredAppointments.length === 0 && statusFilter !== 'all' ? (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center p-12">
              <Filter className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No {statusFilter} appointments</p>
              <p className="text-muted-foreground">Try selecting a different filter.</p>
              <Button className="mt-4" variant="outline" onClick={() => setStatusFilter('all')}>
                Show All Appointments
              </Button>
            </CardContent>
          </Card>
        ) : appointments.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center p-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-foreground">No appointments found</p>
              <p className="text-muted-foreground">Book an appointment with a doctor to get started.</p>
              <Button className="mt-4" onClick={() => window.location.href = '/patient/find-doctor'}>
                Find a Doctor
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Calendar View */}
            <div>
              <PatientAppointmentCalendar appointments={appointments} />
            </div>
            
            {/* Upcoming Appointments List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Upcoming Appointments</h2>
              {upcomingAppointments.length === 0 ? (
                <Card className="rounded-2xl">
                  <CardContent className="p-6 text-center text-muted-foreground">
                    No upcoming appointments
                  </CardContent>
                </Card>
              ) : (
                upcomingAppointments.slice(0, 5).map((appt) => {
                  const { date, time } = formatDateTime(appt.appointment_date, appt.slot_time);
                  return (
                    <Card key={appt.id} className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              {appt.doctor_photo_url ? (
                                <img 
                                  src={appt.doctor_photo_url} 
                                  alt="" 
                                  className="w-10 h-10 rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">
                                {appt.doctor_title} {appt.doctor_name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {appt.doctor_specialization}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-sm">
                                <Clock className="w-3 h-3 text-primary" />
                                <span className="font-medium">{time}</span>
                                <span className="text-muted-foreground">{date}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={getStatusBadgeVariant(appt.status)} className="flex items-center gap-1">
                              {getStatusIcon(appt.status)}
                              {appt.status}
                            </Badge>
                            {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openCancelDialog(appt)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-6">
            {/* Upcoming */}
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming Appointments</h2>
              {upcomingAppointments.length === 0 ? (
                <p className="text-muted-foreground">No upcoming appointments</p>
              ) : (
                <div className="space-y-4">
                  {upcomingAppointments.map((appt) => {
                    const { date, time } = formatDateTime(appt.appointment_date, appt.slot_time);
                    return (
                      <Card key={appt.id} className="rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                                {appt.doctor_photo_url ? (
                                  <img 
                                    src={appt.doctor_photo_url} 
                                    alt="" 
                                    className="w-14 h-14 rounded-full object-cover"
                                  />
                                ) : (
                                  <User className="w-7 h-7 text-primary" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="font-bold text-lg text-foreground">
                                  {appt.doctor_title} {appt.doctor_name}
                                </p>
                                <p className="text-sm text-primary font-medium">
                                  {appt.doctor_specialization}
                                </p>
                                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{time} - {date}</span>
                                  </div>
                                  {appt.hospital_name && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-4 h-4" />
                                      <span>{appt.hospital_name}</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm text-foreground mt-2">{appt.reason}</p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                              <Badge variant={getStatusBadgeVariant(appt.status)} className="flex items-center gap-1">
                                {getStatusIcon(appt.status)}
                                {appt.status}
                              </Badge>
                              {appt.status !== 'CANCELLED' && appt.status !== 'COMPLETED' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openCancelDialog(appt)}
                                  className="text-destructive border-destructive hover:bg-destructive/10"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past */}
            {pastAppointments.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Past Appointments</h2>
                <div className="space-y-4">
                  {pastAppointments.map((appt) => {
                    const { date, time } = formatDateTime(appt.appointment_date, appt.slot_time);
                    return (
                      <Card key={appt.id} className="rounded-2xl overflow-hidden opacity-75">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                                {appt.doctor_photo_url ? (
                                  <img 
                                    src={appt.doctor_photo_url} 
                                    alt="" 
                                    className="w-14 h-14 rounded-full object-cover grayscale"
                                  />
                                ) : (
                                  <User className="w-7 h-7 text-gray-400" />
                                )}
                              </div>
                              <div className="space-y-1">
                                <p className="font-bold text-lg text-foreground">
                                  {appt.doctor_title} {appt.doctor_name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {appt.doctor_specialization}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{time} - {date}</span>
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mt-2">{appt.reason}</p>
                              </div>
                            </div>
                            
                            <Badge variant={getStatusBadgeVariant(appt.status)} className="flex items-center gap-1 h-fit">
                              {getStatusIcon(appt.status)}
                              {appt.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
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
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Appointment
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
