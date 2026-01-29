"use client";

import * as React from "react";
import { X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from "@/components/ui/sheet";

interface MobileFilterSheetProps {
  /** Number of active filters to show as badge */
  activeFilterCount?: number;
  /** Callback when filters are applied */
  onApply?: () => void;
  /** Callback when filters are reset */
  onReset?: () => void;
  /** The filter controls to render inside the sheet */
  children: React.ReactNode;
  /** Custom trigger button content */
  triggerContent?: React.ReactNode;
  /** Title for the sheet header */
  title?: string;
  /** Whether the sheet is open (controlled mode) */
  open?: boolean;
  /** Callback when open state changes (controlled mode) */
  onOpenChange?: (open: boolean) => void;
}

/**
 * MobileFilterSheet - Bottom sheet pattern for mobile filters
 * 
 * Per PRD requirements:
 * - Show only search bar by default
 * - "Filters" button with count badge
 * - Bottom sheet slides up (85vh height)
 * - Clear vertical stacking, one filter per row
 * - Large tap targets
 * - Sticky bottom "Apply Filters" CTA
 * - Secondary "Reset" inline text
 * 
 * Usage:
 * ```tsx
 * <MobileFilterSheet
 *   activeFilterCount={3}
 *   onApply={() => handleSearch()}
 *   onReset={() => resetFilters()}
 * >
 *   <FilterControls />
 * </MobileFilterSheet>
 * ```
 */
export function MobileFilterSheet({
  activeFilterCount = 0,
  onApply,
  onReset,
  children,
  triggerContent,
  title = "Filters",
  open,
  onOpenChange,
}: MobileFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        {triggerContent || (
          <Button 
            variant="outline" 
            size="default"
            className="touch-target gap-2 relative"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="h-[85vh] rounded-t-3xl flex flex-col"
      >
        {/* Handle bar indicator */}
        <div className="flex justify-center pt-2 pb-4">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
        
        <SheetHeader className="px-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">{title}</SheetTitle>
            <SheetClose className="rounded-full p-2 hover:bg-muted transition-colors">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </SheetClose>
          </div>
        </SheetHeader>
        
        {/* Scrollable filter content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-6">
            {children}
          </div>
        </div>
        
        {/* Sticky footer with Apply/Reset buttons */}
        <SheetFooter className="px-6 py-4 border-t border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 w-full">
            {onReset && (
              <Button
                variant="ghost"
                onClick={onReset}
                className="text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
            <SheetClose asChild>
              <Button 
                onClick={onApply}
                className="flex-1 touch-target"
                size="lg"
              >
                Apply Filters
              </Button>
            </SheetClose>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * FilterSection - A styled section for grouping related filters
 */
interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function FilterSection({ title, children, className }: FilterSectionProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  );
}
