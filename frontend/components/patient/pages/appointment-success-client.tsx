"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Calendar, CheckCircle2, Clock, Home, User } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import logo from "@/assets/images/logo.png";

type AppointmentData = {
  doctorName: string;
  date: string;
  time: string;
  location: string;
};

type AppointmentSuccessClientProps = {
  initialAppointmentData: AppointmentData | null;
};

export function AppointmentSuccessClient({ initialAppointmentData }: AppointmentSuccessClientProps) {
  if (!initialAppointmentData) {
    return (
      <AppBackground>
        <div className="flex items-center justify-center min-h-dvh min-h-app px-4">
          <div className="w-full max-w-2xl space-y-4">
            <div className="flex justify-center py-2">
              <MedoraLoader size="lg" label="Loading appointment details..." />
            </div>
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="animate-page-enter">
      <div className="flex items-center justify-center min-h-dvh min-h-app px-4 py-8">
        <div className="w-full max-w-2xl animate-fade-in-up">
          <div className="flex items-center justify-center gap-3 mb-8">
            <Image src={logo} alt="Medora Logo" width={64} height={64} className="w-10 h-10 sm:w-12 sm:h-12" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Medora</h1>
          </div>

          <div className="flex justify-center mb-6 animate-scale-in">
            <div className="relative">
              <div className="absolute inset-0 bg-success/20 rounded-full blur-xl" />
              <CheckCircle2 className="w-20 h-20 sm:w-24 sm:h-24 text-success relative z-10" />
            </div>
          </div>

          <div className="text-center mb-8 animate-fade-in-up delay-2">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
              Your <span className="text-success">appointment request</span> has been successfully submitted!
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">We&apos;ll be in touch shortly to confirm.</p>
          </div>

          <div className="animate-fade-in-up delay-3">
            <Card className="rounded-2xl shadow-lg border-border/50 overflow-hidden mb-6">
              <div className="bg-primary/5 border-b border-border px-4 sm:px-6 py-3">
                <h3 className="text-base sm:text-lg font-semibold text-foreground">Requested appointment details:</h3>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                  <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">Doctor</p>
                    <p className="text-sm sm:text-base font-semibold text-foreground truncate">{initialAppointmentData.doctorName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                    <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Date</p>
                      <p className="text-sm sm:text-base font-semibold text-foreground">
                        {new Date(initialAppointmentData.date).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                    <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">Time</p>
                      <p className="text-sm sm:text-base font-semibold text-foreground">{initialAppointmentData.time}</p>
                    </div>
                  </div>
                </div>

                {initialAppointmentData.location !== "Not specified" && (
                  <div className="pt-2">
                    <Badge variant="secondary" className="text-xs sm:text-sm">
                      Location: {initialAppointmentData.location}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-fade-in-up delay-3">
            <Link href="/patient/appointments" className="flex-1">
              <Button variant="medical" size="lg" className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold">
                View My Appointments
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </Link>
            <Link href="/patient/home" className="flex-1">
              <Button variant="outline" size="lg" className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </AppBackground>
  );
}
