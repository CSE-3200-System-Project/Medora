"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { getCurrentUser, getPublicDoctorProfile } from "@/lib/auth-actions";
import {
  getDoctorReviews,
  getReviewEligibility,
  type DoctorReview,
  type ReviewEligibility,
} from "@/lib/review-actions";
import { DoctorProfileHeader } from "@/components/doctor/doctor-profile/DoctorProfileHeader";
import { DoctorAboutCard } from "@/components/doctor/doctor-profile/DoctorAboutCard";
import { DoctorQualificationsCard } from "@/components/doctor/doctor-profile/DoctorQualificationsCard";
import { DoctorSpecializationsCard } from "@/components/doctor/doctor-profile/DoctorSpecializationsCard";
import { DoctorProfessionalDetailsCard } from "@/components/doctor/doctor-profile/DoctorProfessionalDetailsCard";
import { DoctorPracticeLocations } from "@/components/doctor/doctor-profile/DoctorPracticeLocations";
import { AppointmentBookingCard } from "@/components/doctor/doctor-profile/AppointmentBookingCard";
import { DoctorReviewsSection } from "@/components/doctor/doctor-profile/DoctorReviewsSection";
import { WriteReviewDialog } from "@/components/doctor/doctor-profile/WriteReviewDialog";
import type { BackendDoctorProfile } from "@/components/doctor/doctor-profile/types";
import { toast } from "@/lib/notify";
import { useT } from "@/i18n/client";

type ViewerRole = "patient" | "doctor" | "admin" | "guest";

interface DoctorProfileAppointmentPageProps {
  doctorId: string;
}

const REVIEWS_PER_PAGE = 5;
const EMPTY_ELIGIBILITY: ReviewEligibility = {
  can_review: false,
  has_existing_review: false,
  existing_review: null,
};

export function DoctorProfileAppointmentPage({ doctorId }: DoctorProfileAppointmentPageProps) {
  const tCommon = useT("common");
  const [doctor, setDoctor] = React.useState<BackendDoctorProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [viewerRole, setViewerRole] = React.useState<ViewerRole>("guest");
  const [viewerId, setViewerId] = React.useState<string | null>(null);

  const [reviews, setReviews] = React.useState<DoctorReview[]>([]);
  const [reviewPage, setReviewPage] = React.useState(1);
  const [ratingAvg, setRatingAvg] = React.useState(0);
  const [ratingCount, setRatingCount] = React.useState(0);
  const [hasMoreReviews, setHasMoreReviews] = React.useState(false);
  const [reviewsLoading, setReviewsLoading] = React.useState(true);
  const [loadingMoreReviews, setLoadingMoreReviews] = React.useState(false);
  const [eligibility, setEligibility] = React.useState<ReviewEligibility | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((user) => {
        if (cancelled) return;
        const role = typeof user?.role === "string" ? user.role.toLowerCase() : null;
        if (role === "patient" || role === "doctor" || role === "admin") {
          setViewerRole(role);
        } else {
          setViewerRole("guest");
        }
        setViewerId(typeof user?.id === "string" ? user.id : null);
      })
      .catch(() => {
        if (!cancelled) {
          setViewerRole("guest");
          setViewerId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchDoctorProfile() {
      try {
        setLoading(true);
        setError(null);
        const profile = await getPublicDoctorProfile(doctorId);
        if (!cancelled) {
          setDoctor(profile);
        }
      } catch {
        if (!cancelled) {
          setError(tCommon("doctorProfile.page.loadFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (doctorId) {
      void fetchDoctorProfile();
    }

    return () => {
      cancelled = true;
    };
  }, [doctorId, tCommon]);

  const syncRatings = React.useCallback((list: { rating_avg: number; rating_count: number }) => {
    setRatingAvg(list.rating_avg);
    setRatingCount(list.rating_count);
    setDoctor((current) =>
      current
        ? {
            ...current,
            rating_avg: list.rating_avg,
            rating_count: list.rating_count,
          }
        : current,
    );
  }, []);

  const refreshReviewState = React.useCallback(async () => {
    setReviewsLoading(true);
    try {
      const [list, nextEligibility] = await Promise.all([
        getDoctorReviews(doctorId, 1, REVIEWS_PER_PAGE),
        viewerRole === "patient" ? getReviewEligibility(doctorId) : Promise.resolve(EMPTY_ELIGIBILITY),
      ]);

      setReviews(list.reviews);
      setReviewPage(list.page);
      setHasMoreReviews(list.has_more);
      setEligibility(nextEligibility);
      syncRatings(list);
    } finally {
      setReviewsLoading(false);
    }
  }, [doctorId, syncRatings, viewerRole]);

  React.useEffect(() => {
    if (!doctorId) return;
    void refreshReviewState();
  }, [doctorId, refreshReviewState]);

  const loadMoreReviews = React.useCallback(async () => {
    if (loadingMoreReviews || !hasMoreReviews) return;

    const nextPage = reviewPage + 1;
    setLoadingMoreReviews(true);
    try {
      const list = await getDoctorReviews(doctorId, nextPage, REVIEWS_PER_PAGE);
      setReviews((current) => [...current, ...list.reviews]);
      setReviewPage(list.page);
      setHasMoreReviews(list.has_more);
      syncRatings(list);
    } finally {
      setLoadingMoreReviews(false);
    }
  }, [doctorId, hasMoreReviews, loadingMoreReviews, reviewPage, syncRatings]);

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

  const handleOpenReviewDialog = React.useCallback(() => {
    if (viewerRole !== "patient") return;
    if (!eligibility?.can_review && !eligibility?.has_existing_review) {
      toast.error("You can only review after completing an appointment");
      return;
    }
    setReviewDialogOpen(true);
  }, [eligibility?.can_review, eligibility?.has_existing_review, viewerRole]);

  const handleReviewSubmitted = React.useCallback(
    (review: DoctorReview) => {
      setEligibility({
        can_review: true,
        has_existing_review: true,
        existing_review: review,
      });
      void refreshReviewState();
    },
    [refreshReviewState],
  );

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
  const existingReview = eligibility?.existing_review ?? null;
  const patientCanInteract =
    viewerRole === "patient" &&
    (Boolean(eligibility?.can_review) || Boolean(eligibility?.has_existing_review));
  const reviewAction = patientCanInteract
    ? {
        label: existingReview ? "Edit Review" : "Write Review",
        onClick: handleOpenReviewDialog,
        disabled: reviewsLoading,
        isEdit: Boolean(existingReview),
      }
    : null;
  const doctorDisplayName = `${doctor.title ? `${doctor.title} ` : ""}${doctor.first_name} ${doctor.last_name}`.trim();

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
            <DoctorProfileHeader doctor={doctor} onShare={handleShare} reviewAction={reviewAction} />
            <DoctorAboutCard doctor={doctor} />
            <DoctorQualificationsCard doctor={doctor} />
            <DoctorSpecializationsCard doctor={doctor} />
            <DoctorProfessionalDetailsCard doctor={doctor} />
            <DoctorPracticeLocations
              locations={locations}
              doctorName={{
                firstName: doctor.first_name,
                lastName: doctor.last_name,
                title: doctor.title ?? undefined,
              }}
              editable={viewerRole === "doctor" && viewerId === doctor.profile_id}
              onLocationUpdated={(updated) => {
                setDoctor((current) =>
                  current
                    ? {
                        ...current,
                        locations: (current.locations ?? []).map((loc) =>
                          loc.id && loc.id === updated.id ? updated : loc,
                        ),
                      }
                    : current,
                );
              }}
            />
            <DoctorReviewsSection
              doctorName={doctorDisplayName}
              viewerRole={viewerRole}
              reviews={reviews}
              ratingAvg={ratingAvg}
              ratingCount={ratingCount}
              existingReview={existingReview}
              canReview={Boolean(eligibility?.can_review)}
              loading={reviewsLoading}
              loadingMore={loadingMoreReviews}
              hasMore={hasMoreReviews}
              onLoadMore={() => void loadMoreReviews()}
            />
          </section>

          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-[calc(var(--nav-content-offset)-0.5rem)]">
              <AppointmentBookingCard doctor={doctor} />
            </div>
          </aside>
        </div>
      </main>

      {viewerRole === "patient" ? (
        <WriteReviewDialog
          open={reviewDialogOpen}
          onOpenChange={setReviewDialogOpen}
          doctorId={doctor.profile_id}
          doctorName={doctorDisplayName}
          existingReview={existingReview}
          onSubmitted={handleReviewSubmitted}
        />
      ) : null}
    </AppBackground>
  );
}
