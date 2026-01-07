import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DoctorNavbar } from "@/components/doctor/doctor-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";

async function getDoctorProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/profile/doctor/profile`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      redirect("/login");
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching doctor profile:", error);
    redirect("/login");
  }
}

export default async function DoctorHomePage() {
  const doctor = await getDoctorProfile();

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-primary-more-light to-accent">
      <DoctorNavbar doctor={doctor} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Welcome back, Dr. {doctor.last_name}! 👋
          </h1>
          <p className="text-foreground-muted text-lg">
            Here's what's happening with your practice today
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-white to-primary-more-light/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground-muted uppercase">
                    Today's Appointments
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-2">12</p>
                </div>
                <div className="bg-primary/10 rounded-full p-3">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-white to-accent/50 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground-muted uppercase">
                    Total Patients
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-2">248</p>
                </div>
                <div className="bg-primary/10 rounded-full p-3">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-white to-primary-light/30 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground-muted uppercase">
                    Pending Reviews
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-2">8</p>
                </div>
                <div className="bg-primary/10 rounded-full p-3">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-white to-success/10 shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground-muted uppercase">
                    Completion Rate
                  </p>
                  <p className="text-3xl font-bold text-foreground mt-2">94%</p>
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
          <Card className="lg:col-span-2 rounded-2xl border-primary/20 bg-gradient-to-br from-white to-primary-more-light/30 shadow-md">
            <CardHeader className="border-b border-primary/10">
              <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Upcoming Appointments
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {[1, 2, 3].map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 bg-white/70 rounded-xl border border-primary/10 hover:shadow-md transition-shadow"
                  >
                    <div className="bg-primary/10 rounded-lg px-4 py-2 text-center">
                      <p className="text-2xl font-bold text-primary">15</p>
                      <p className="text-xs text-foreground-muted font-semibold">
                        JAN
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-foreground">
                        Patient Consultation
                      </p>
                      <p className="text-sm text-foreground-muted">
                        John Doe • 10:00 AM - 10:30 AM
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary hover:text-white">
                      View
                    </Button>
                  </div>
                ))}
              </div>
              <Link href="/doctor/appointments">
                <Button variant="link" className="text-primary mt-4 font-semibold">
                  View all appointments →
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-white to-accent/40 shadow-md">
            <CardHeader className="border-b border-primary/10">
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
                    className="w-full justify-start border-primary text-primary hover:bg-primary hover:text-white"
                    size="lg"
                  >
                    <Users className="h-5 w-5 mr-3" />
                    View Patients
                  </Button>
                </Link>
                <Link href="/doctor/profile">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-primary text-primary hover:bg-primary hover:text-white"
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
          <Card className="mt-6 rounded-2xl border-success/20 bg-gradient-to-r from-success/10 to-success/5 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-success rounded-full p-3">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-lg">
                    Your profile is verified!
                  </p>
                  <p className="text-foreground-muted">
                    You're all set to accept patient appointments
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mt-6 rounded-2xl border-destructive/20 bg-gradient-to-r from-destructive/10 to-destructive/5 shadow-md">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="bg-destructive rounded-full p-3">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg">
                    BMDC Verification Pending
                  </p>
                  <p className="text-foreground-muted">
                    Your profile is under review. You'll be notified once verified.
                  </p>
                </div>
                <Link href="/doctor/profile">
                  <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive hover:text-white">
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
