"use client";

import React from "react";
import { AlertCircle, Clock3, MessageSquare, Star, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { DoctorReview } from "@/lib/review-actions";

interface DoctorReviewsSectionProps {
  doctorName: string;
  viewerRole?: "patient" | "doctor" | "admin" | "guest";
  reviews: DoctorReview[];
  ratingAvg: number;
  ratingCount: number;
  existingReview?: DoctorReview | null;
  canReview?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
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

function AuthorReviewBanner({ review }: { review: DoctorReview }) {
  if (review.status === "PENDING") {
    return (
      <div className="rounded-lg border border-amber-300/50 bg-amber-50/70 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Waiting for admin approval</p>
            <p className="mt-1 text-amber-900/80 dark:text-amber-100/80">
              Your latest review has been submitted and will appear publicly after moderation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (review.status === "REJECTED") {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Review rejected</p>
            <p className="mt-1 text-destructive/90">
              {review.admin_feedback ? `Rejected: ${review.admin_feedback}` : "The admin team rejected this review."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export function DoctorReviewsSection({
  doctorName,
  viewerRole = "guest",
  reviews,
  ratingAvg,
  ratingCount,
  existingReview,
  canReview = false,
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
}: DoctorReviewsSectionProps) {
  const showAuthorState = viewerRole === "patient" && existingReview && existingReview.status !== "APPROVED";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Patient Reviews
        </CardTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {ratingCount > 0 ? (
            <>
              <span className="text-2xl font-bold tabular-nums text-foreground">{ratingAvg.toFixed(1)}</span>
              <Stars rating={Math.round(ratingAvg)} size={16} />
              <span>
                Based on {ratingCount} approved review{ratingCount === 1 ? "" : "s"}
              </span>
            </>
          ) : (
            <span>No approved reviews yet</span>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showAuthorState ? <AuthorReviewBanner review={existingReview} /> : null}

        {viewerRole === "patient" && !loading && !canReview && !existingReview ? (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>You can only review this doctor after completing an appointment.</p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading reviews...</p>
        ) : reviews.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Be the first to share your experience with {doctorName}.
          </div>
        ) : (
          <ul className="space-y-4">
            {reviews.map((review) => {
              const name =
                [review.author?.first_name, review.author?.last_name].filter(Boolean).join(" ") || "Patient";
              const initials =
                ((review.author?.first_name?.[0] ?? "") + (review.author?.last_name?.[0] ?? "")) || "P";

              return (
                <li key={review.id} className="rounded-lg border border-border/50 bg-surface/30 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={review.author?.profile_photo_url ?? undefined} alt={name} />
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {initials.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-foreground">{name}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
                      </div>
                      <Stars rating={review.rating} size={14} />
                      {review.note ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-foreground/80">
                          {review.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {hasMore && reviews.length > 0 ? (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={onLoadMore} disabled={loadingMore}>
              {loadingMore ? "Loading..." : "Load more"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
