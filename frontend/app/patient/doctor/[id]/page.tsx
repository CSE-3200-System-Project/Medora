"use client";

import React from "react";
import { useParams } from "next/navigation";
import { getDoctorProfile, getAvailableSlots } from "@/lib/auth-actions";
import { DoctorInformationSection } from "@/components/doctor/doctor-information-section";
import { AppointmentBookingPanel } from "@/components/doctor/appointment-booking-panel";

export default function DoctorProfilePage() {
  const params = useParams();
  const profileId = params.id as string;

  const [doctor, setDoctor] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchDoctor() {
      try {
        setLoading(true);
        const data = await getDoctorProfile(profileId);
        setDoctor(data);
      } catch (err: any) {
        setError(err.message || "Failed to load doctor profile");
      } finally {
        setLoading(false);
      }
    }

    if (profileId) {
      fetchDoctor();
    }
  }, [profileId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading doctor profile...</p>
        </div>
      </div>
    );
  }

  if (error || !doctor) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive mb-4">{error || "Doctor not found"}</p>
          <a href="/patient/home" className="text-primary hover:underline">
            ← Back to search
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop: Two-column layout */}
      <div className="container mx-auto px-4 py-6 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left: Doctor Information (takes 2 columns on desktop) */}
          <div className="lg:col-span-2">
            <DoctorInformationSection doctor={doctor} />
          </div>

          {/* Right: Appointment Booking Panel (sticky on desktop) */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <AppointmentBookingPanel doctor={doctor} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: Fixed bottom CTA (shown only on mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg">
        <button className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold">
          Book Appointment
        </button>
      </div>
    </div>
  );
}
