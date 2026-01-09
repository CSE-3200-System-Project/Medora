"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, Calendar, Clock, User, ArrowRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function AppointmentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [appointmentData, setAppointmentData] = useState<any>(null);

  useEffect(() => {
    // Parse appointment data from URL params
    const doctorName = searchParams.get("doctorName");
    const date = searchParams.get("date");
    const time = searchParams.get("time");
    const location = searchParams.get("location");

    if (doctorName && date && time) {
      setAppointmentData({
        doctorName,
        date,
        time,
        location: location || "Not specified",
      });
    }
  }, [searchParams]);

  if (!appointmentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface via-background to-accent flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-muted-foreground">Loading appointment details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface via-background to-accent flex items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        {/* Logo Section */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Image
            src="@/assets/images/logo.png"
            alt="Medora Logo"
            width={48}
            height={48}
            className="w-10 h-10 sm:w-12 sm:h-12"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Medora
          </h1>
        </div>

        {/* Success Icon with Animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 260,
            damping: 20,
            delay: 0.2,
          }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.3 }}
              className="absolute inset-0 bg-success/20 rounded-full blur-xl"
            />
            <CheckCircle2 className="w-20 h-20 sm:w-24 sm:h-24 text-success relative z-10" />
          </div>
        </motion.div>

        {/* Success Message */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
            Your{" "}
            <span className="text-success">appointment request</span>{" "}
            has been successfully submitted!
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            We'll be in touch shortly to confirm.
          </p>
        </motion.div>

        {/* Appointment Details Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Card className="rounded-2xl shadow-lg border-border/50 overflow-hidden mb-6">
            <div className="bg-primary/5 border-b border-border px-4 sm:px-6 py-3">
              <h3 className="text-base sm:text-lg font-semibold text-foreground">
                Requested appointment details:
              </h3>
            </div>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {/* Doctor Info */}
              <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Doctor
                  </p>
                  <p className="text-sm sm:text-base font-semibold text-foreground truncate">
                    {appointmentData.doctorName}
                  </p>
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Date */}
                <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Date
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {new Date(appointmentData.date).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Time */}
                <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                  <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Time
                    </p>
                    <p className="text-sm sm:text-base font-semibold text-foreground">
                      {appointmentData.time}
                    </p>
                  </div>
                </div>
              </div>

              {/* Location Badge */}
              {appointmentData.location !== "Not specified" && (
                <div className="pt-2">
                  <Badge variant="secondary" className="text-xs sm:text-sm">
                    Location: {appointmentData.location}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-3 sm:gap-4"
        >
          <Button
            onClick={() => router.push("/patient/appointments")}
            variant="medical"
            size="lg"
            className="flex-1 h-12 sm:h-14 text-sm sm:text-base font-semibold"
          >
            View My Appointments
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>
          <Button
            onClick={() => router.push("/patient/home")}
            variant="outline"
            size="lg"
            className="flex-1 h-12 sm:h-14 text-sm sm:text-base font-semibold"
          >
            <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Back to Home
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function AppointmentSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-surface via-background to-accent flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <AppointmentSuccessContent />
    </Suspense>
  );
}
