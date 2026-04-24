"use client";

import React from "react";
import { Star, Pencil, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  getDoctorReviews,
  getReviewEligibility,
  type DoctorReview,
  type ReviewEligibility,
} from "@/lib/review-actions";
import { WriteReviewDialog } from "./WriteReviewDialog";

interface DoctorReviewsSectionProps {
  doctorId: string;
  doctorName: string;
  /** When viewing own profile as a doctor, we hide the "Write review" CTA. */
  viewerRole?: "patient" | "doctor" | "admin" | "guest";
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function DoctorReviewsSection({
  doctorId,
  doctorName,
  viewerRole = "guest",
}: DoctorReviewsSectionProps) {
  const [reviews, setReviews] = React.useState<DoctorReview[]>([]);
  const [ratingAvg, setRatingAvg] = React.useState(0);
  const [ratingCount, setRatingCount] = React.useState(0);
  const [eligibility, setEligibility] = React.useState<ReviewEligibility | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const [list, elig] = await Promise.all([
      getDoctorReviews(doctorId),
      viewerRole === "patient"
        ? getReviewEligibility(doctorId)
        : Promise.resolve<ReviewEligibility>({
            can_review: false,
            has_existing_review: false,
            existing_review: null,
          }),
    ]);
    setReviews(list.reviews);
    setRatingAvg(list.rating_avg);
    setRatingCount(list.rating_count);
    setEligibility(elig);
    setLoading(false);
  }, [doctorId, viewerRole]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const canWrite = viewerRole === "patient" && eligibility?.can_review;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Patient Reviews
          </CardTitle>
          <div className="mt-2 flex items-center gap-3">
            {ratingCount > 0 ? (
              <>
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {ratingAvg.toFixed(1)}
                </span>
                <div className="flex flex-col">
                  <Stars rating={Math.round(ratingAvg)} size={16} />
                  <span className="text-xs text-muted-foreground">
                    Based on {ratingCount} review{ratingCount === 1 ? "" : "s"}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">No reviews yet</span>
            )}
          </div>
        </div>

        {canWrite && (
          <Button onClick={() => setDialogOpen(true)} size="sm" className="shrink-0">
            {eligibility?.has_existing_review ? (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Edit your review
              </>
            ) : (
              <>
                <Star className="mr-2 h-4 w-4" />
                Write a review
              </>
            )}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {viewerRole === "patient" && eligibility && !eligibility.can_review && !eligibility.has_existing_review && (
          <p className="rounded-md border border-dashed border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            You can review this doctor after completing an appointment with them.
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Be the first to share your experience with {doctorName}.
          </div>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => {
              const name = [r.author?.first_name, r.author?.last_name].filter(Boolean).join(" ") || "Patient";
              const initials =
                (r.author?.first_name?.[0] ?? "") + (r.author?.last_name?.[0] ?? "") || "P";
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-border/50 bg-surface/30 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={r.author?.profile_photo_url ?? undefined} alt={name} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {initials.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                      </div>
                      <Stars rating={r.rating} size={14} />
                      {r.note && (
                        <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap break-words">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {viewerRole === "patient" && (
        <WriteReviewDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          doctorId={doctorId}
          doctorName={doctorName}
          existingReview={eligibility?.existing_review ?? null}
          onSubmitted={() => void refresh()}
        />
      )}
    </Card>
  );
}
