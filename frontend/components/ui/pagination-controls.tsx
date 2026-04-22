"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  itemLabel?: string;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
};

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  itemLabel = "items",
  onPrev,
  onNext,
  className,
}: PaginationControlsProps) {
  if (totalItems <= 0 || totalPages <= 1) {
    return null;
  }

  return (
    <div className={cn("mt-3 flex items-center justify-between gap-2", className)}>
      <p className="text-xs text-muted-foreground">
        Showing {startIndex}-{endIndex} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="h-8 px-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Prev</span>
        </Button>
        <span className="min-w-14 text-center text-xs font-medium text-foreground">
          {currentPage}/{totalPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="h-8 px-2"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
