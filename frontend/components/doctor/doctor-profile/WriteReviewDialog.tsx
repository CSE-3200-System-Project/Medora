"use client";

import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRatingInput } from "./StarRatingInput";
import { submitDoctorReview, type DoctorReview } from "@/lib/review-actions";
import { toast } from "@/lib/notify";

interface WriteReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctorId: string;
  doctorName: string;
  existingReview?: DoctorReview | null;
  onSubmitted?: (review: DoctorReview) => void;
}

export function WriteReviewDialog({
  open,
  onOpenChange,
  doctorId,
  doctorName,
  existingReview,
  onSubmitted,
}: WriteReviewDialogProps) {
  const [rating, setRating] = React.useState(existingReview?.rating ?? 5);
  const [note, setNote] = React.useState(existingReview?.note ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setRating(existingReview?.rating ?? 5);
      setNote(existingReview?.note ?? "");
    }
  }, [open, existingReview]);

  const isEdit = Boolean(existingReview);

  async function handleSubmit() {
    if (rating < 1 || rating > 5) return;
    setSubmitting(true);
    try {
      const review = await submitDoctorReview({
        doctor_id: doctorId,
        rating,
        note: note.trim() || undefined,
      });
      toast.success(
        review.status === "PENDING"
          ? "Your review is pending admin approval"
          : isEdit
          ? "Review updated"
          : "Review submitted",
      );
      onSubmitted?.(review);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit your review" : "Write a review"}</DialogTitle>
          <DialogDescription>
            Share your experience with {doctorName}. Your feedback helps other patients make informed decisions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex flex-col items-center gap-2">
            <StarRatingInput value={rating} onChange={setRating} disabled={submitting} />
            <span className="text-sm text-muted-foreground">
              {rating} out of 5
            </span>
          </div>

          <div className="space-y-2">
            <label htmlFor="review-note" className="text-sm font-medium text-foreground">
              Your note (optional)
            </label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How was your experience? Was the doctor attentive, clear, and helpful?"
              rows={5}
              maxLength={2000}
              disabled={submitting}
            />
            <p className="text-right text-xs text-muted-foreground">{note.length}/2000</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rating < 1}>
            {submitting ? "Submitting..." : isEdit ? "Save changes" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
