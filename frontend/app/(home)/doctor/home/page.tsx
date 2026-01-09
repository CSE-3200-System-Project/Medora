import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

async function getDoctorProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/login");
  }

  const response = await fetch(
    `${process.env.BACKEND_URL}/profile/doctor/profile`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  ).catch((error) => {
    console.error("Error fetching doctor profile:", error);
    return null;
  });

  if (!response || !response.ok) {
    redirect("/login");
  }

  return await response.json();
}

async function getDoctorStats() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const res = await fetch(`${process.env.BACKEND_URL}/appointment/stats`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error("Error fetching doctor stats", e);
    return null;
  }
}

async function getUpcomingAppointments(limit = 3) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const res = await fetch(`${process.env.BACKEND_URL}/appointment/upcoming?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error("Error fetching upcoming appointments", e);
    return [];
  }
}

export default async function DoctorHomePage() {
  const doctor = await getDoctorProfile();
  const stats = await getDoctorStats() || { todays_appointments: 0, total_patients: 0, pending_reviews: 0, completion_rate: 0 };
  const upcoming = await getUpcomingAppointments(3) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24 md:pt-28">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Welcome back, Dr. {doctor.last_name}! 
          </h1>
          <p className="text-muted-foreground text-lg">
            Here's what's happening with your practice today
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="rounded-2xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Today's Appointments
                  </p>
                  <p className="text-3xl font-bold text-foreground">{stats.todays_appointments}</p>
                </div>
                <div className="bg-primary/10 rounded-full p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Total Patients
                  </p>
                  <p className="text-3xl font-bold text-foreground">{stats.total_patients}</p>
                </div>
                <div className="bg-primary/10 rounded-full p-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Pending Reviews
                  </p>
                  <p className="text-3xl font-bold text-foreground">{stats.pending_reviews}</p>
                </div>
                <div className="bg-primary/10 rounded-full p-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">
                    Completion Rate
                  </p>
                  <p className="text-3xl font-bold text-foreground">{stats.completion_rate}%</p>
                </div>
                <div className="bg-success/10 rounded-full p-3">
                  <TrendingUp className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upcoming Appointments */}
          <Card className="lg:col-span-2 rounded-2xl border-border/50 shadow-md">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {upcoming.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">
                    No upcoming appointments
                  </div>
                ) : (
                  upcoming.map((a: any) => {
                    const dt = new Date(a.appointment_date);
                    const day = dt.getDate();
                    const month = dt.toLocaleString(undefined, { month: 'short' }).toUpperCase();
                    const time = dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div
                        key={a.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-surface rounded-xl border border-border hover:shadow-md transition-shadow"
                      >
                        <div className="bg-primary/10 rounded-lg px-4 py-2 text-center min-w-[60px]">
                          <p className="text-2xl font-bold text-primary">{day}</p>
                          <p className="text-xs text-muted-foreground font-medium">{month}</p>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-foreground">{a.reason || 'Consultation'}</p>
                          <p className="text-sm text-muted-foreground">
                            {a.patient_name || a.patient_id} • {time}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          View
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
              <Link href="/doctor/appointments">
                <Button variant="link" className="text-primary mt-4 font-semibold">
                  View all appointments →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-2xl border-border/50 shadow-md">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-xl font-bold text-foreground">
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Link href="/doctor/appointments">
                  <Button
                    variant="medical"
                    className="w-full justify-start"
                    size="lg"
                  >
                    <Calendar className="h-5 w-5 mr-3" />
                    Schedule Appointment
                  </Button>
                </Link>
                <Link href="/doctor/patients">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    size="lg"
                  >
                    <Users className="h-5 w-5 mr-3" />
                    View Patients
                  </Button>
                </Link>
                <Link href="/doctor/profile">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    size="lg"
                  >
                    <FileText className="h-5 w-5 mr-3" />
                    Update Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Completion Status */}
        {doctor.bmdc_verified ? (
          <Card className="mt-6 rounded-2xl border-success/20 bg-success/5 shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-success rounded-full p-3">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg">
                    Your profile is verified!
                  </p>
                  <p className="text-muted-foreground">
                    You're all set to accept patient appointments
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 rounded-2xl border-destructive/20 bg-destructive/5 shadow-md">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="bg-destructive rounded-full p-3">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg">
                    BMDC Verification Pending
                  </p>
                  <p className="text-muted-foreground">
                    Your profile is under review. You'll be notified once verified.
                  </p>
                </div>
                <Link href="/doctor/profile">
                  <Button variant="outline" className="w-full sm:w-auto">
                    View Status
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
