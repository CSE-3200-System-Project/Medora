"use client";

import React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { getPublicDoctorProfile } from "@/lib/auth-actions";
import { DoctorInformationSection } from "@/components/doctor/doctor-information-section";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { MedoraLoader } from "@/components/ui/medora-loader";

const AppointmentBookingPanel = dynamic(
  () =>
    import("@/components/doctor/appointment-booking-panel").then(
      (module) => module.AppointmentBookingPanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-border bg-card p-6">
        <MedoraLoader size="sm" label="Loading booking panel..." />
      </div>
    ),
  },
);

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
        const data = await getPublicDoctorProfile(profileId);
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
      <AppBackground>
        <MedoraLoader size="lg" label="Loading doctor profile..." fullScreen />
      </AppBackground>
    );
  }

  if (error || !doctor) {
    return (
      <AppBackground>
        <div className="flex min-h-dvh min-h-app items-center justify-center">
          <div className="text-center">
            <p className="mb-4 text-destructive">{error || "Doctor not found"}</p>
            <Link href="/patient/find-doctor" className="text-primary hover:underline">
              Back to search
            </Link>
          </div>
        </div>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          <div className="lg:col-span-2">
            <DoctorInformationSection doctor={doctor} />
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-32 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto xl:top-36">
              <AppointmentBookingPanel doctor={doctor} />
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card p-4 shadow-lg dark:bg-card lg:hidden">
        <button className="w-full rounded-lg bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary-muted">
          Book Appointment
        </button>
      </div>
    </AppBackground>
  );
}

