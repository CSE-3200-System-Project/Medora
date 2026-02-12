"use client";

import React from "react";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { AppointmentCalendar } from "@/components/ui/appointment-calendar";
import { TimeSlotGrid } from "@/components/doctor/time-slot-grid";
import { DoctorPatientList } from "@/components/doctor/doctor-patient-list";
import { getMyAppointments, getAppointmentsByDate, updateAppointment, syncAppointmentStatus } from "@/lib/appointment-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, User, FileText, CheckCircle2, XCircle, AlertCircle, Phone, ExternalLink, Filter, ArrowLeft } from "lucide-react";
import { cn, localDateKey, parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils";
import { useRouter } from "next/navigation";

type TabMode = 'appointments' | 'patients';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

export default function DoctorAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tabMode, setTabMode] = React.useState<TabMode>('appointments');
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [daySlots, setDaySlots] = React.useState<any[]>([]);
  const [showTimeSlots, setShowTimeSlots] = React.useState(false);
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
      const data = await getMyAppointments();
      setAppointments(data);
    } catch (error) {
      console.error("Failed to load appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateSelect = async (date: string | null) => {
    setSelectedDate(date);
    
    if (date) {
      setShowTimeSlots(true);
      // Fetch time slots for this date
      try {
        const slots = await getAppointmentsByDate(date);
        setDaySlots(slots);
      } catch (error) {
        console.error("Failed to fetch slots:", error);
      }
    } else {
      setShowTimeSlots(false);
      setDaySlots([]);
    }
  };

  const handleBackToCalendar = () => {
    setSelectedDate(null);
    setShowTimeSlots(false);
    setDaySlots([]);
  };

  const handleSlotClick = (appointmentId: string) => {
    // Optional: Highlight or scroll to appointment in the list
    console.log("Slot clicked:", appointmentId);
  };

  const handleUpdateAppointment = async (appointmentId: string, status: string) => {
    try {
      await updateAppointment(appointmentId, { status });
      loadAppointments();
      // Refresh slots if viewing a date
      if (selectedDate) {
        const slots = await getAppointmentsByDate(selectedDate);
        setDaySlots(slots);
      }
    } catch (error) {
      console.error(`Failed to ${status.toLowerCase()} appointment:`, error);
      alert(`Failed to ${status.toLowerCase()} appointment. Please try again.`);
    }
  };

  // Deduplicate appointments
  const uniqueAppointments = React.useMemo(() => {
    return appointments.filter(
      (appt, index, self) => index === self.findIndex(a => a.id === appt.id)
    );
  }, [appointments]);

  // Filter by date if selected
  const dateFilteredAppointments = React.useMemo(() => {
    if (!selectedDate) return uniqueAppointments;
    return uniqueAppointments.filter(appt => {
      const apptDate = localDateKey(appt.appointment_date);
      return apptDate === selectedDate;
    });
  }, [uniqueAppointments, selectedDate]);

  // Filter by status
  const filteredAppointments = React.useMemo(() => {
    if (statusFilter === 'all') return dateFilteredAppointments;
    return dateFilteredAppointments.filter(
      appt => appt.status.toUpperCase() === statusFilter.toUpperCase()
    );
  }, [dateFilteredAppointments, statusFilter]);

  // Count appointments by status (for filter badges)
  const statusCounts = React.useMemo(() => {
    const base = selectedDate ? dateFilteredAppointments : uniqueAppointments;
    return {
      all: base.length,
      pending: base.filter(a => a.status.toUpperCase() === 'PENDING').length,
      confirmed: base.filter(a => a.status.toUpperCase() === 'CONFIRMED').length,
      cancelled: base.filter(a => a.status.toUpperCase() === 'CANCELLED').length,
      completed: base.filter(a => a.status.toUpperCase() === 'COMPLETED').length,
    };
  }, [selectedDate, dateFilteredAppointments, uniqueAppointments]);

  // Sort appointments: upcoming first, then past
  const sortedAppointments = React.useMemo(() => {
    const now = new Date();
    const upcoming = filteredAppointments.filter(
      appt => new Date(appt.appointment_date) >= now
    ).sort((a, b) => 
      new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
    );
    
    const past = filteredAppointments.filter(
      appt => new Date(appt.appointment_date) < now
    ).sort((a, b) => 
      new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime()
    );
    
    return { upcoming, past };
  }, [filteredAppointments]);

  // Pagination for main appointments list (all filtered appointments)
  const allFilteredAppointments = React.useMemo(() => {
    return [...sortedAppointments.upcoming, ...sortedAppointments.past];
  }, [sortedAppointments]);

  const totalPages = Math.ceil(allFilteredAppointments.length / itemsPerPage);
  const paginatedAppointments = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return allFilteredAppointments.slice(startIndex, startIndex + itemsPerPage);
  }, [allFilteredAppointments, currentPage]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, statusFilter]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const dateFormatted = `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
    const timeFormatted = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    return { date: dateFormatted, time: timeFormatted };
  };

  const getStatusBadge = (status: string) => {
    const statusUpper = status.toUpperCase();
    
    switch (statusUpper) {
      case 'PENDING':
        return (
          <Badge variant="warning" className="flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Pending
          </Badge>
        );
      case 'CONFIRMED':
        return (
          <Badge variant="default" className="flex items-center gap-1 bg-blue-500">
            <CheckCircle2 className="w-3 h-3" />
            Confirmed
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Extract slot time from notes
  const extractSlotTime = (notes: string | null): string | null => {
    if (!notes) return null;
    const slotMatch = notes.match(/Slot:\s*(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
    return slotMatch ? slotMatch[1] : null;
  };

  const AppointmentCard = ({ appointment, isPast = false }: { appointment: any; isPast?: boolean }) => {
    const { date, time } = formatDateTime(appointment.appointment_date);
    const slotTime = extractSlotTime(appointment.notes);
    const displayTime = slotTime || time;
    const isPending = appointment.status.toUpperCase() === 'PENDING';

    return (
      <div
        className={cn(
          "p-4 rounded-lg border-2 transition-all",
          "hover:shadow-md",
          "border-blue-200 bg-white dark:bg-card hover:bg-blue-50 dark:hover:bg-card/80",
          isPast && "opacity-75"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              {appointment.patient_id ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/doctor/patient/${appointment.patient_id}`);
                  }}
                  className="font-semibold text-primary hover:underline text-base flex items-center gap-1 text-left"
                >
                  {appointment.patient_name}
                  <ExternalLink className="w-3 h-3" />
                </button>
              ) : (
                <h4 className="font-semibold text-foreground text-base">{appointment.patient_name}</h4>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                {appointment.patient_age && (
                  <span>{appointment.patient_age} yrs</span>
                )}
                {appointment.patient_gender && (
                  <span>• {appointment.patient_gender}</span>
                )}
                {appointment.blood_group && (
                  <span>• {appointment.blood_group}</span>
                )}
              </div>
            </div>
          </div>
          {getStatusBadge(appointment.status)}
        </div>

        <div className="space-y-2.5 text-sm">
          {/* Appointment Time */}
          <div className="flex items-center gap-2 text-foreground bg-blue-50 dark:bg-primary/10 p-2 rounded">
            <Clock className="w-4 h-4 text-primary flex-shrink-0" />
            <div>
              <div className="font-medium">{displayTime}</div>
              <div className="text-xs text-muted-foreground">{date}</div>
            </div>
          </div>
          
          {/* Reason for visit */}
          {appointment.reason && (
            <div className="flex items-start gap-2 text-muted-foreground">
              <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Reason</p>
                {(() => {
                  const { consultationType, appointmentType } = parseCompositeReason(appointment.reason)
                  const ct = humanizeConsultationType(consultationType)
                  const at = humanizeAppointmentType(appointmentType)
                  return (
                    <>
                      <p className="text-sm text-foreground">{ct}{at ? ` • ${at}` : ''}</p>
                      {appointment.notes && <p className="text-xs text-muted-foreground mt-1">{appointment.notes}</p>}
                    </>
                  )
                })()}
              </div>
            </div>
          )}
          
          {/* Contact Info */}
          {appointment.patient_phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4 flex-shrink-0" />
              <span>{appointment.patient_phone}</span>
            </div>
          )}
          
          {/* Chronic Conditions */}
          {appointment.chronic_conditions && appointment.chronic_conditions.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-2">
              <p className="text-xs text-muted-foreground mb-1 font-medium">Chronic Conditions:</p>
              <div className="flex flex-wrap gap-1">
                {appointment.chronic_conditions.map((condition: string, idx: number) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-white dark:bg-background">
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons for Pending Appointments */}
        {isPending && !isPast && (
          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            <Button
              size="sm"
              variant="default"
              onClick={() => handleUpdateAppointment(appointment.id, 'CONFIRMED')}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleUpdateAppointment(appointment.id, 'CANCELLED')}
              className="flex-1"
            >
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px]">
          <div className="flex items-center justify-center py-20">
            <div className="skeleton w-12 h-12 rounded-full"></div>
          </div>
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Appointments Management
            </h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Manage your patient bookings and schedule
            </p>
          </div>
          
          {/* Tab Switcher */}
          <div className="flex items-center gap-2 bg-card rounded-xl p-1 shadow-sm border border-border/50">
            <Button
              variant={tabMode === 'appointments' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTabMode('appointments')}
              className="touch-target"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Appointments
            </Button>
            <Button
              variant={tabMode === 'patients' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTabMode('patients')}
              className="touch-target"
            >
              <Users className="w-4 h-4 mr-2" />
              Patients
            </Button>
          </div>
        </div>

        {tabMode === 'appointments' ? (
          <div className="space-y-6">
            {/* Top Section: Calendar (1 col) + Upcoming Appointments (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar - 1 Column */}
              <div>
                <AppointmentCalendar
                  appointments={uniqueAppointments}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  title="Appointment Calendar"
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
                      Next {Math.min(5, sortedAppointments.upcoming.length)} appointments
                    </p>
                  </CardHeader>
                  <CardContent className="p-4">
                    {sortedAppointments.upcoming.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Calendar className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground">No upcoming appointments</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedAppointments.upcoming.slice(0, 5).map((appt) => {
                          const { date, time } = formatDateTime(appt.appointment_date);
                          const slotTime = extractSlotTime(appt.notes);
                          const displayTime = slotTime || time;

                          return (
                            <div
                              key={appt.id}
                              className="p-3 rounded-lg border border-blue-200 bg-white dark:bg-card hover:bg-blue-50 dark:hover:bg-card/80 transition-all"
                            >
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm text-foreground truncate">
                                      {appt.patient_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {appt.patient_age && `${appt.patient_age} yrs`}
                                      {appt.patient_gender && ` • ${appt.patient_gender}`}
                                    </p>
                                  </div>
                                </div>
                                {getStatusBadge(appt.status)}
                              </div>
                              <div className="flex items-center gap-2 text-xs bg-blue-50 dark:bg-primary/10 p-2 rounded">
                                <Clock className="w-3 h-3 text-primary flex-shrink-0" />
                                <span className="font-medium">{displayTime}</span>
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

            {/* Time Slots View - Shows when date is selected */}
            {showTimeSlots && selectedDate && (
              <div className="w-full">
                <TimeSlotGrid
                  selectedDate={selectedDate}
                  slots={daySlots}
                  onSlotClick={handleSlotClick}
                  onBack={handleBackToCalendar}
                />
              </div>
            )}

            {/* All Appointments List - Full Width with Pagination */}
            <Card className="rounded-2xl shadow-lg">
              <CardHeader className="border-b border-border/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    {selectedDate ? (
                      <div className="flex items-center gap-2">
                        <span>Appointments on Selected Date</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleBackToCalendar}
                          className="ml-2"
                        >
                          <ArrowLeft className="w-4 h-4 mr-1" />
                          Back to All
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
                
                {/* Status Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('all')}
                    className="text-xs touch-target"
                  >
                    All ({statusCounts.all})
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('pending')}
                    className={cn("text-xs touch-target", statusFilter === 'pending' && "bg-yellow-500 hover:bg-yellow-600")}
                  >
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Pending ({statusCounts.pending})
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('confirmed')}
                    className={cn("text-xs touch-target", statusFilter === 'confirmed' && "bg-blue-500 hover:bg-blue-600")}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Confirmed ({statusCounts.confirmed})
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('cancelled')}
                    className={cn("text-xs touch-target", statusFilter === 'cancelled' && "bg-red-500 hover:bg-red-600")}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    Cancelled ({statusCounts.cancelled})
                  </Button>
                  <Button
                    size="sm"
                    variant={statusFilter === 'completed' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('completed')}
                    className={cn("text-xs touch-target", statusFilter === 'completed' && "bg-green-500 hover:bg-green-600")}
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Completed ({statusCounts.completed})
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                {filteredAppointments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Filter className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-foreground">
                      {selectedDate 
                        ? 'No appointments on this date' 
                        : statusFilter === 'all'
                        ? 'No appointments found'
                        : `No ${statusFilter} appointments`}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedDate || statusFilter !== 'all' ? 'Try adjusting your filters.' : 'New appointments will appear here.'}
                    </p>
                    {(selectedDate || statusFilter !== 'all') && (
                      <Button 
                        className="mt-4 touch-target" 
                        variant="outline" 
                        onClick={() => {
                          setSelectedDate(null);
                          setStatusFilter('all');
                        }}
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Appointments Grid */}
                    <div className="space-y-3">
                      {paginatedAppointments.map((appt) => (
                        <AppointmentCard key={appt.id} appointment={appt} isPast={new Date(appt.appointment_date) < new Date()} />
                      ))}
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
        ) : (
          <DoctorPatientList />
        )}
      </main>
    </AppBackground>
  );
}
