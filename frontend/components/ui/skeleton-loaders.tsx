import * as React from "react";

import { cn } from "@/lib/utils";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading card"
      className={cn("rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-6 shadow-surface", className)}
    >
      <div className="skeleton h-5 w-2/5 rounded" />
      <div className="mt-4 space-y-3">
        <div className="skeleton h-4 w-full rounded" />
        <div className="skeleton h-4 w-4/5 rounded" />
        <div className="skeleton h-4 w-3/5 rounded" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading table"
      className={cn("rounded-xl border border-border/60 bg-card/80 p-4 sm:p-6", className)}
    >
      <div className="skeleton h-5 w-1/3 rounded" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-4 rounded" />
            <div className="skeleton hidden h-4 rounded sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ fields = 4, className }: { fields?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading form"
      className={cn("rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-6 md:p-8", className)}
    >
      <div className="space-y-4">
        {Array.from({ length: fields }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="skeleton h-4 w-1/4 rounded" />
            <div className="skeleton h-11 w-full rounded-lg" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        <div className="skeleton h-11 w-28 rounded-lg" />
        <div className="skeleton h-11 w-24 rounded-lg" />
      </div>
    </div>
  );
}
