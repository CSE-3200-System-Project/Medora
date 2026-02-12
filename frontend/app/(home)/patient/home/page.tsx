"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getMyAppointments } from "@/lib/appointment-actions";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { 
  Calendar, 
  Clock, 
  User, 
  Activity,
  TrendingUp,
  Search,
  FileText,
  ArrowRight,
  CalendarCheck,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

type Appointment = {
  id: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  reason?: string;
  notes?: string;
  doctor?: {
    first_name: string;
    last_name: string;
    specialization?: string;
    profile_photo_url?: string;
  };
};

export default function PatientHomePage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [stats, setStats] = useState({
    upcoming: 0,
    completed: 0,
    pending: 0,
  });

  useEffect(() => {
    fetchAppointments();
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = () => {
    // Check if onboarding is completed from cookie
    const cookies = document.cookie.split(';');
    const onboardingCookie = cookies.find(c => c.trim().startsWith('onboarding_completed='));
    const isOnboardingCompleted = onboardingCookie?.split('=')[1] === 'true';
    
    setShowOnboardingBanner(!isOnboardingCompleted);
  };

  const fetchAppointments = async () => {
    try {
      const data = await getMyAppointments();
      
      // If data is empty array and no token, redirect to home
      if (!data || data.length === 0) {
        const cookies = document.cookie.split(';');
        const tokenCookie = cookies.find(c => c.trim().startsWith('session_token='));
        if (!tokenCookie || !tokenCookie.split('=')[1]) {
          window.location.href = '/';
          return;
        }
      }
      
      setAppointments(data);
      
      // Calculate stats
      const now = new Date();
      const upcoming = data.filter((apt: Appointment) => 
        new Date(apt.appointment_date) > now && apt.status !== 'cancelled'
      ).length;
      const completed = data.filter((apt: Appointment) => 
        apt.status === 'completed'
      ).length;
      const pending = data.filter((apt: Appointment) => 
        apt.status === 'pending'
      ).length;
      
      setStats({ upcoming, completed, pending });
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
      // On any error, check if user has valid session
      const cookies = document.cookie.split(';');
      const tokenCookie = cookies.find(c => c.trim().startsWith('session_token='));
      if (!tokenCookie || !tokenCookie.split('=')[1]) {
        window.location.href = '/';
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments
      .filter(apt => new Date(apt.appointment_date) > now && apt.status !== 'cancelled')
      .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())
      .slice(0, 3);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'text-success bg-success/10';
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'completed':
        return 'text-primary bg-primary/10';
      case 'cancelled':
        return 'text-destructive bg-destructive/10';
      default:
        return 'text-muted-foreground bg-surface';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const upcomingAppointments = getUpcomingAppointments();

  return (
    <AppBackground>
      <Navbar />
      
      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px] animate-page-enter">
        {/* Onboarding Banner */}
        {showOnboardingBanner && <OnboardingBanner role="patient" />}
        
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">
            Welcome back! 
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Here's an overview of your healthcare journey
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 md:mb-8 stagger-enter">
          {/* Upcoming Appointments */}
          <Card hoverable className="border-border/50">
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {loading ? "..." : stats.upcoming}
              </h3>
              <p className="text-sm text-gray-600">Upcoming Appointments</p>
            </CardContent>
          </Card>

          {/* Pending Confirmations */}
          <Card hoverable className="border-border/50">
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 dark:text-yellow-500" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {loading ? "..." : stats.pending}
              </h3>
              <p className="text-sm text-gray-600">Pending Confirmations</p>
            </CardContent>
          </Card>

          {/* Completed Visits */}
          <Card hoverable className="border-border/50 sm:col-span-2 lg:col-span-1">
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-success/10 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {loading ? "..." : stats.completed}
              </h3>
              <p className="text-sm text-gray-600">Completed Visits</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Upcoming Appointments */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="border-b border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Upcoming Appointments</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Your next scheduled visits
                    </CardDescription>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.push('/patient/appointments')}
                    className="text-primary hover:text-primary-muted"
                  >
                    View All
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 bg-surface rounded-xl animate-pulse">
                        <div className="flex gap-3">
                          <div className="w-12 h-12 bg-border rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-border rounded w-1/3" />
                            <div className="h-3 bg-border rounded w-1/2" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAppointments.map((appointment) => (
                      <div 
                        key={appointment.id}
                        className="p-4 bg-surface rounded-xl border border-border hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => router.push('/patient/appointments')}
                      >
                        <div className="flex items-start gap-3 sm:gap-4">
                          {/* Doctor Avatar */}
                          <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                          </div>
                          
                          {/* Appointment Details */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-foreground text-sm sm:text-base mb-1 truncate">
                              Dr. {appointment.doctor?.first_name} {appointment.doctor?.last_name}
                            </h4>
                            {appointment.doctor?.specialization && (
                              <p className="text-xs sm:text-sm text-gray-600 mb-2">
                                {appointment.doctor.specialization}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                {new Date(appointment.appointment_date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                {new Date(appointment.appointment_date).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </span>
                            </div>
                          </div>
                          
                          {/* Status Badge */}
                          <Badge 
                            className={cn(
                              "flex items-center gap-1 text-xs",
                              getStatusColor(appointment.status)
                            )}
                          >
                            {getStatusIcon(appointment.status)}
                            {appointment.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-600 mb-4">No upcoming appointments</p>
                    <Button 
                      variant="medical"
                      onClick={() => router.push('/patient/find-doctor')}
                    >
                      Book an Appointment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quick Actions */}
          <div className="space-y-6">
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => router.push('/patient/find-doctor')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Search className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Find a Doctor</p>
                      <p className="text-xs text-gray-600">Search & book appointments</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => router.push('/patient/appointments')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <CalendarCheck className="w-5 h-5 text-success" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">My Appointments</p>
                      <p className="text-xs text-gray-600">View all appointments</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4"
                  onClick={() => router.push('/patient/profile')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">My Profile</p>
                      <p className="text-xs text-gray-600">Update health information</p>
                    </div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 touch-target"
                  onClick={() => router.push('/patient/medical-records')}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/50 rounded-lg">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-sm">Medical Records</p>
                      <p className="text-xs text-gray-600">Access your history</p>
                    </div>
                  </div>
                </Button>
              </CardContent>
            </Card>

            {/* Health Tip Card */}
            <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-accent dark:from-primary/10 dark:to-accent/20">
              <CardContent>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Health Tip</h4>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Regular checkups are essential for maintaining good health. Schedule your annual health screening today!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </AppBackground>
  );
}
