import Link from "next/link";
import { cookies } from "next/headers";
import {
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { AppBackground } from "@/components/ui/app-background";
import {
  getDoctorAppointmentStats,
  getDoctorUpcomingAppointments,
} from "@/lib/appointment-actions";
import { getDoctorProfile } from "@/lib/auth-actions";

type DoctorProfile = {
  last_name?: string | null;
  bmdc_verified?: boolean;
  locations?: Array<{
    time_slots_needs_review?: boolean;
  }>;
};

type DoctorStats = {
  todays_appointments: number;
  total_patients: number;
  pending_reviews: number;
  completion_rate: number;
};

type DoctorUpcomingAppointment = {
  id: string;
  appointment_date: string;
  reason?: string | null;
  patient_name?: string | null;
  patient_id?: string | null;
};

const DEFAULT_STATS: DoctorStats = {
  todays_appointments: 0,
  total_patients: 0,
  pending_reviews: 0,
  completion_rate: 0,
};

function formatAppointmentDateTime(dateValue: string) {
  const date = new Date(dateValue);
  return {
    day: date.getDate(),
    month: date.toLocaleString("en-US", { month: "short" }).toUpperCase(),
    time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
  };
}

export default async function DoctorHomePage() {
  const cookieStore = await cookies();
  const showOnboardingBanner = cookieStore.get("onboarding_completed")?.value !== "true";

  const [doctorData, statsData, upcomingData] = await Promise.all([
    getDoctorProfile().catch(() => null),
    getDoctorAppointmentStats().catch(() => null),
    getDoctorUpcomingAppointments(3).catch(() => []),
  ]);

  const doctor = doctorData as DoctorProfile | null;
  const stats: DoctorStats = { ...DEFAULT_STATS, ...(statsData ?? {}) };
  const upcoming = Array.isArray(upcomingData)
    ? (upcomingData as DoctorUpcomingAppointment[])
    : [];

  if (!doctor) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px]">
          <div className="text-center text-destructive">
            <p className="text-lg mb-4">Unable to load profile data</p>
            <Button asChild variant="medical" className="touch-target">
              <Link href="/login">Back to Login</Link>
            </Button>
          </div>
        </main>
      </AppBackground>
    );
  }

  const doctorProfileNeedsScheduleReview = Boolean(
    doctor.locations?.some((location) => Boolean(location?.time_slots_needs_review)),
  );

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px]">
        {showOnboardingBanner ? <OnboardingBanner role="doctor" /> : null}

        {doctorProfileNeedsScheduleReview ? (
          <div className="mb-6">
            <Card className="border-destructive/20 bg-destructive/5 dark:bg-destructive/10 p-4">
              <CardContent>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-destructive">
                      Action Required: Schedule Format Review
                    </p>
                    <p className="text-sm text-muted-foreground">
                      We detected an ambiguous schedule format on your profile. Please review and
                      update your weekly schedule to ensure appointment slots work correctly.
                    </p>
                  </div>
                  <div>
                    <Link href="/doctor/schedule">
                      <Button variant="medical" className="touch-target">
                        Fix Schedule
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2">
            Welcome back, Dr. {doctor.last_name ?? "Doctor"}!
          </h1>
          <p className="text-muted-foreground text-lg">Here&apos;s what&apos;s happening with your practice today</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card hoverable className="border-border/50 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Today&apos;s Appointments</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    {stats.todays_appointments}
                  </p>
                </div>
                <div className="bg-primary/10 dark:bg-primary/20 rounded-full p-3">
                  <Calendar className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="border-border/50 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Patients</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    {stats.total_patients}
                  </p>
                </div>
                <div className="bg-primary/10 dark:bg-primary/20 rounded-full p-3">
                  <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="border-border/50 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pending Reviews</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    {stats.pending_reviews}
                  </p>
                </div>
                <div className="bg-primary/10 dark:bg-primary/20 rounded-full p-3">
                  <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="border-border/50 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Completion Rate</p>
                  <p className="text-2xl md:text-3xl font-bold text-foreground">
                    {stats.completion_rate}%
                  </p>
                </div>
                <div className="bg-success/10 dark:bg-success/20 rounded-full p-3">
                  <TrendingUp className="h-5 w-5 md:h-6 md:w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-border/50 shadow-md">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {upcoming.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No upcoming appointments</div>
                ) : (
                  upcoming.map((appointment) => {
                    const { day, month, time } = formatAppointmentDateTime(
                      appointment.appointment_date,
                    );
                    return (
                      <div
                        key={appointment.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-surface dark:bg-muted/30 rounded-xl border border-border hover:shadow-md transition-shadow"
                      >
                        <div className="bg-primary/10 dark:bg-primary/20 rounded-lg px-4 py-2 text-center min-w-[60px]">
                          <p className="text-2xl font-bold text-primary">{day}</p>
                          <p className="text-xs text-muted-foreground font-medium">{month}</p>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground">
                            {appointment.reason || "Consultation"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {appointment.patient_name || appointment.patient_id || "Patient"} | {time}
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto touch-target">
                          <Link href="/doctor/appointments">View</Link>
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
              <Link href="/doctor/appointments">
                <Button variant="link" className="text-primary mt-4 font-semibold touch-target">
                  View all appointments
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-md">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg md:text-xl font-bold text-foreground">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Link href="/doctor/appointments">
                  <Button variant="medical" className="w-full justify-start touch-target" size="lg">
                    <Calendar className="h-5 w-5 mr-3" />
                    View Appointments
                  </Button>
                </Link>
                <Link href="/doctor/schedule">
                  <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                    <Clock className="h-5 w-5 mr-3" />
                    Set Schedule
                  </Button>
                </Link>
                <Link href="/doctor/patients">
                  <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                    <Users className="h-5 w-5 mr-3" />
                    View Patients
                  </Button>
                </Link>
                <Link href="/doctor/profile">
                  <Button variant="outline" className="w-full justify-start touch-target" size="lg">
                    <FileText className="h-5 w-5 mr-3" />
                    Update Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {doctor.bmdc_verified ? (
          <Card className="mt-6 border-success/20 bg-success/5 dark:bg-success/10 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-success rounded-full p-3">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg">Your profile is verified!</p>
                  <p className="text-muted-foreground">
                    You&apos;re all set to accept patient appointments
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 border-destructive/20 bg-destructive/5 dark:bg-destructive/10 shadow-md">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-destructive rounded-full p-3">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg">BMDC Verification Pending</p>
                  <p className="text-muted-foreground">
                    Your profile is under review. You&apos;ll be notified once verified.
                  </p>
                </div>
                <Link href="/doctor/profile">
                  <Button variant="outline" className="w-full sm:w-auto touch-target">
                    View Status
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </AppBackground>
  );
}

