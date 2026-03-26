"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { getPublicDoctorProfile } from "@/lib/auth-actions";
import type { BackendDoctorProfile } from "@/components/doctor/doctor-profile/types";
import { DoctorProfileHeader } from "@/components/doctor/doctor-profile/DoctorProfileHeader";
import { DoctorAboutCard } from "@/components/doctor/doctor-profile/DoctorAboutCard";
import { DoctorQualificationsCard } from "@/components/doctor/doctor-profile/DoctorQualificationsCard";
import { DoctorSpecializationsCard } from "@/components/doctor/doctor-profile/DoctorSpecializationsCard";
import { DoctorProfessionalDetailsCard } from "@/components/doctor/doctor-profile/DoctorProfessionalDetailsCard";
import { DoctorPracticeLocations } from "@/components/doctor/doctor-profile/DoctorPracticeLocations";
import { AppointmentBookingCard } from "@/components/doctor/doctor-profile/AppointmentBookingCard";
import { toast } from "@/lib/notify";

interface DoctorProfileAppointmentPageProps {
  doctorId: string;
}

export function DoctorProfileAppointmentPage({ doctorId }: DoctorProfileAppointmentPageProps) {
  const [doctor, setDoctor] = React.useState<BackendDoctorProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchDoctorProfile() {
      try {
        setLoading(true);
        setError(null);
        const profile = await getPublicDoctorProfile(doctorId);
        setDoctor(profile);
      } catch (fetchError: any) {
        setError(fetchError?.message || "Failed to load doctor profile");
      } finally {
        setLoading(false);
      }
    }

    if (doctorId) {
      fetchDoctorProfile();
    }
  }, [doctorId]);

  const handleShare = React.useCallback(async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Medora Doctor Profile",
          text: `Book an appointment with Dr. ${doctor?.first_name || ""} ${doctor?.last_name || ""}`,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Profile link copied to clipboard");
    } catch {
      // Ignore share cancellation and clipboard failures.
    }
  }, [doctor?.first_name, doctor?.last_name]);

  if (loading) {
    return (
      <AppBackground>
        <MedoraLoader size="lg" label="Loading doctor profile..." fullScreen />
      </AppBackground>
    );
  }

  if (error || !doctor) {
    return (
      <AppBackground>
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
          <div className="space-y-2 text-center">
            <p className="text-base font-semibold text-destructive">{error || "Doctor not found"}</p>
            <Link href="/patient/find-doctor" className="text-sm font-semibold text-primary hover:underline">
              Back to doctor search
            </Link>
          </div>
        </main>
      </AppBackground>
    );
  }

  const locations = doctor.locations || [];

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
        <div className="mb-5 hidden items-center gap-2 text-sm text-muted-foreground md:flex">
          <Link href="/patient/find-doctor" className="hover:text-primary">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>Doctors</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">
            Dr. {doctor.first_name} {doctor.last_name}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
          <section className="space-y-5 lg:col-span-8">
            <DoctorProfileHeader doctor={doctor} onShare={handleShare} />
            <DoctorAboutCard doctor={doctor} />
            <DoctorQualificationsCard doctor={doctor} />
            <DoctorSpecializationsCard doctor={doctor} />
            <DoctorProfessionalDetailsCard doctor={doctor} />
            <DoctorPracticeLocations locations={locations} />
          </section>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-[calc(var(--nav-content-offset)-0.5rem)]">
              <AppointmentBookingCard doctor={doctor} />
            </div>
          </aside>
        </div>
      </main>
    </AppBackground>
  );
}
