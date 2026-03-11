import Link from "next/link";
import { cookies } from "next/headers";
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
  CheckCircle2,
  Pill,
  FlaskConical,
  Scissors,
} from "lucide-react";

import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { cn } from "@/lib/utils";
import { getMyAppointments } from "@/lib/appointment-actions";
import { getPatientPrescriptions, type Prescription } from "@/lib/prescription-actions";

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

function getPrescriptionIcon(type: string) {
  switch (type) {
    case "medication":
      return <Pill className="h-5 w-5" />;
    case "test":
      return <FlaskConical className="h-5 w-5" />;
    case "surgery":
      return <Scissors className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return "text-success-muted bg-success/15 dark:text-green-300 dark:bg-green-500/15";
    case "pending":
      return "text-amber-700 bg-amber-100/70 dark:text-amber-300 dark:bg-amber-500/15";
    case "completed":
      return "text-primary bg-primary/15";
    case "cancelled":
      return "text-destructive bg-destructive/15";
    default:
      return "text-muted-foreground bg-surface";
  }
}

function getStatusIcon(status: string) {
  switch (status?.toLowerCase()) {
    case "confirmed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "pending":
      return <Clock className="w-4 h-4" />;
    case "completed":
      return <CheckCircle2 className="w-4 h-4" />;
    case "cancelled":
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <Clock className="w-4 h-4" />;
  }
}

function getUpcomingAppointments(appointments: Appointment[]) {
  const now = new Date();
  return appointments
    .filter((appointment) => {
      const status = appointment.status?.toLowerCase();
      return new Date(appointment.appointment_date) > now && status !== "cancelled";
    })
    .sort(
      (a, b) =>
        new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime(),
    )
    .slice(0, 3);
}

export default async function PatientHomePage() {
  const cookieStore = await cookies();
  const showOnboardingBanner = cookieStore.get("onboarding_completed")?.value !== "true";

  const [appointmentsData, prescriptionData] = await Promise.all([
    getMyAppointments().catch(() => []),
    getPatientPrescriptions("pending", 3, 0).catch(() => ({
      prescriptions: [] as Prescription[],
      total: 0,
    })),
  ]);

  const appointments = Array.isArray(appointmentsData) ? (appointmentsData as Appointment[]) : [];
  const prescriptions = Array.isArray(prescriptionData?.prescriptions)
    ? prescriptionData.prescriptions
    : [];

  const now = new Date();
  const stats = {
    upcoming: appointments.filter((appointment) => {
      const status = appointment.status?.toLowerCase();
      return new Date(appointment.appointment_date) > now && status !== "cancelled";
    }).length,
    completed: appointments.filter((appointment) => appointment.status?.toLowerCase() === "completed")
      .length,
    pending: appointments.filter((appointment) => appointment.status?.toLowerCase() === "pending")
      .length,
  };

  const upcomingAppointments = getUpcomingAppointments(appointments);

  return (
    <AppBackground>
      <Navbar />

      <main className="mx-auto max-w-7xl page-content pt-28 md:pt-32 pb-12 md:pb-16 animate-page-enter">
        {showOnboardingBanner ? <OnboardingBanner role="patient" /> : null}

        <div className="mb-6 md:mb-8 header-spacing">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2">Welcome back!</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Here&apos;s an overview of your healthcare journey
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 md:mb-8 stagger-enter">
          <Card hoverable className="border-border/70 bg-card/95">
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-primary/10 rounded-xl">
                  <CalendarCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{stats.upcoming}</h3>
              <p className="text-sm text-muted-foreground">Upcoming Appointments</p>
            </CardContent>
          </Card>

          <Card hoverable className="border-border/70 bg-card/95">
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-amber-100/80 dark:bg-amber-500/15">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-700 dark:text-amber-300" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{stats.pending}</h3>
              <p className="text-sm text-muted-foreground">Pending Confirmations</p>
            </CardContent>
          </Card>

          <Card hoverable className="border-border/70 bg-card/95 sm:col-span-2 lg:col-span-1">
            <CardContent>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-success/10 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
                </div>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {stats.completed}
              </h3>
              <p className="text-sm text-muted-foreground">Completed Visits</p>
            </CardContent>
          </Card>
        </div>

        {prescriptions.length > 0 ? (
          <Card className="mb-6 border-primary/35 bg-linear-to-r from-primary/10 via-primary/5 to-transparent">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Pill className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">
                      New Prescriptions Awaiting Review
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      You have {prescriptions.length} prescription
                      {prescriptions.length > 1 ? "s" : ""} that require
                      {prescriptions.length === 1 ? "s" : ""} your attention
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0">
                  <Link href="/patient/prescriptions">
                    View All
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {prescriptions.map((prescription) => (
                  <Link key={prescription.id} href={`/patient/prescriptions/${prescription.id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow bg-background/85 border-border/70">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            {getPrescriptionIcon(prescription.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-foreground capitalize">
                              {prescription.type}
                            </p>
                            {prescription.doctor_name ? (
                              <p className="text-xs text-muted-foreground mt-1">
                                Dr. {prescription.doctor_name}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {prescription.medications && prescription.medications.length > 0 ? (
                          <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {prescription.medications.length} medicine
                            {prescription.medications.length > 1 ? "s" : ""}:{" "}
                            {prescription.medications[0].medicine_name}
                            {prescription.medications.length > 1
                              ? ` +${prescription.medications.length - 1} more`
                              : ""}
                          </div>
                        ) : null}
                        {prescription.tests && prescription.tests.length > 0 ? (
                          <div className="text-xs text-muted-foreground line-clamp-2 mb-2">
                            {prescription.tests.length} test
                            {prescription.tests.length > 1 ? "s" : ""}:{" "}
                            {prescription.tests[0].test_name}
                            {prescription.tests.length > 1
                              ? ` +${prescription.tests.length - 1} more`
                              : ""}
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                          <Badge
                            variant="outline"
                            className="bg-amber-100/70 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/40 text-xs"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(prescription.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                  <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary-muted">
                    <Link href="/patient/appointments">
                      View All
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {upcomingAppointments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingAppointments.map((appointment) => (
                      <Link key={appointment.id} href="/patient/appointments">
                        <div className="p-4 bg-surface rounded-xl border border-border hover:border-primary/50 transition-colors cursor-pointer">
                          <div className="flex items-start gap-3 sm:gap-4">
                            <div className="shrink-0 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                              <User className="w-6 h-6 text-primary" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-foreground text-sm sm:text-base mb-1 truncate">
                                Dr. {appointment.doctor?.first_name} {appointment.doctor?.last_name}
                              </h4>
                              {appointment.doctor?.specialization ? (
                                <p className="text-xs sm:text-sm text-muted-foreground mb-2">
                                  {appointment.doctor.specialization}
                                </p>
                              ) : null}
                              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                                  {new Date(appointment.appointment_date).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                                  {new Date(appointment.appointment_date).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                            </div>

                            <Badge
                              className={cn(
                                "flex items-center gap-1 text-xs",
                                getStatusColor(appointment.status),
                              )}
                            >
                              {getStatusIcon(appointment.status)}
                              {appointment.status}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-60" />
                    <p className="text-muted-foreground mb-4">No upcoming appointments</p>
                    <Button asChild variant="medical">
                      <Link href="/patient/find-doctor">Book an Appointment</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-2xl border-border/50">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 rounded-xl border-border/70 bg-background/50 hover:bg-primary/10"
                >
                  <Link href="/patient/find-doctor">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Search className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">Find a Doctor</p>
                        <p className="text-xs text-muted-foreground">Search and book appointments</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 rounded-xl border-border/70 bg-background/50 hover:bg-primary/10"
                >
                  <Link href="/patient/appointments">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-success/10 rounded-lg">
                        <CalendarCheck className="w-5 h-5 text-success" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">My Appointments</p>
                        <p className="text-xs text-muted-foreground">View all appointments</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 rounded-xl border-border/70 bg-background/50 hover:bg-primary/10"
                >
                  <Link href="/patient/profile">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">My Profile</p>
                        <p className="text-xs text-muted-foreground">Update health information</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 rounded-xl border-border/70 bg-background/50 hover:bg-primary/10 touch-target"
                >
                  <Link href="/patient/medical-history">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/50 rounded-lg">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">Medical Records</p>
                        <p className="text-xs text-muted-foreground">Access your history</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button
                  asChild
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 rounded-xl border-border/70 bg-background/50 hover:bg-primary/10"
                >
                  <Link href="/patient/my-prescriptions">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/15">
                        <Pill className="w-5 h-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">My Prescriptions</p>
                        <p className="text-xs text-muted-foreground">View and manage prescriptions</p>
                      </div>
                    </div>
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/70 bg-linear-to-br from-primary/12 via-primary/5 to-transparent">
              <CardContent>
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Activity className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold text-foreground">Health Tip</h4>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Regular checkups are essential for maintaining good health. Schedule your annual
                  health screening today!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </AppBackground>
  );
}

