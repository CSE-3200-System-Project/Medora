"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
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
import { useT } from "@/i18n/client";

interface DoctorProfileAppointmentPageProps {
  doctorId: string;
}

export function DoctorProfileAppointmentPage({ doctorId }: DoctorProfileAppointmentPageProps) {
  const tCommon = useT("common");
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
      } catch {
        setError(tCommon("doctorProfile.page.loadFailed"));
      } finally {
        setLoading(false);
      }
    }

    if (doctorId) {
      fetchDoctorProfile();
    }
  }, [doctorId, tCommon]);

  const handleShare = React.useCallback(async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: tCommon("doctorProfile.page.shareTitle"),
          text: tCommon("doctorProfile.page.shareText", {
            firstName: doctor?.first_name || "",
            lastName: doctor?.last_name || "",
          }),
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success(tCommon("doctorProfile.page.linkCopied"));
    } catch {
      // Ignore share cancellation and clipboard failures.
    }
  }, [doctor?.first_name, doctor?.last_name, tCommon]);

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
          <PageLoadingShell label={tCommon("doctorProfile.page.loadingProfile")} cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  if (error || !doctor) {
    return (
      <AppBackground>
        <Navbar />
        <main className="mx-auto flex min-h-[60vh] w-full max-w-7xl items-center justify-center px-4 pt-[var(--nav-content-offset)] sm:px-6 lg:px-8">
          <div className="space-y-2 text-center">
            <p className="text-base font-semibold text-destructive">{error || tCommon("doctorProfile.page.notFound")}</p>
            <Link href="/patient/find-doctor" className="text-sm font-semibold text-primary hover:underline">
              {tCommon("doctorProfile.page.backToDoctorSearch")}
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
            {tCommon("doctorProfile.page.breadcrumbHome")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>{tCommon("doctorProfile.page.breadcrumbDoctors")}</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-medium text-foreground">
            {doctor.title || tCommon("doctorProfile.page.doctorPrefix")} {doctor.first_name} {doctor.last_name}
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
