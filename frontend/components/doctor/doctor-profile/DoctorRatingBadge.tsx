import React from "react";
import { Star } from "lucide-react";

interface DoctorRatingBadgeProps {
  ratingAvg: number;
  ratingCount: number;
  size?: "sm" | "md";
  className?: string;
}

export function DoctorRatingBadge({
  ratingAvg,
  ratingCount,
  size = "md",
  className = "",
}: DoctorRatingBadgeProps) {
  const hasReviews = ratingCount > 0;
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  if (!hasReviews) {
    return (
      <span className={`inline-flex items-center gap-1 text-muted-foreground ${textSize} ${className}`}>
        <Star className={`${iconSize} opacity-50`} />
        <span>No reviews yet</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium text-foreground ${textSize} ${className}`}
      aria-label={`${ratingAvg.toFixed(1)} out of 5 from ${ratingCount} reviews`}
    >
      <Star className={`${iconSize} fill-amber-400 text-amber-400`} />
      <span className="tabular-nums">{ratingAvg.toFixed(1)}</span>
      <span className="text-muted-foreground font-normal">
        ({ratingCount})
      </span>
    </span>
  );
}
