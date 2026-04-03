import * as React from "react";

import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { cn } from "@/lib/utils";

type PageLoadingShellProps = {
  label?: string;
  cardCount?: number;
  className?: string;
  loaderSize?: "sm" | "md" | "lg";
};

export function PageLoadingShell({
  label = "Loading...",
  cardCount = 4,
  className,
  loaderSize = "lg",
}: PageLoadingShellProps) {
  const resolvedCardCount = Math.max(1, Math.min(cardCount, 8));

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("space-y-6", className)}
    >
      <div className="flex justify-center py-3 sm:py-4">
        <MedoraLoader size={loaderSize} label={label} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: resolvedCardCount }).map((_, index) => (
          <CardSkeleton
            key={index}
            className={cn(index === 0 && resolvedCardCount > 2 ? "lg:col-span-2" : "")}
          />
        ))}
      </div>
    </section>
  );
}
