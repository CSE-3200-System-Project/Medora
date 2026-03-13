import React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Grid pattern for different breakpoints
   * @default "auto" - 1 column on mobile, 2 on sm, 3 on lg, 4 on xl
   */
  pattern?: 
    | "auto"           // 1 -> 2 -> 3 -> 4 (default card grid)
    | "cards"          // 1 -> 2 -> 3 -> 4 (alias for auto)
    | "half"           // 1 -> 2 -> 2 -> 2 (simple split)
    | "thirds"         // 1 -> 1 -> 3 -> 3 (content blocks)
    | "quarters"       // 1 -> 2 -> 4 -> 4 (small items)
    | "stats"          // 1 -> 2 -> 4 -> 6 (dashboard stats)
    | "single"         // 1 -> 1 -> 1 -> 1 (stacked)
    | "custom";        // No grid classes applied
    
  /**
   * Gap between grid items
   * @default "md"
   */
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
}

/**
 * ResponsiveGrid - Mobile-first grid layouts with standard responsive patterns
 * 
 * Standard card grid:
 * <ResponsiveGrid>
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 * </ResponsiveGrid>
 * 
 * Results in: grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4
 */
export function ResponsiveGrid({ 
  className, 
  pattern = "auto",
  gap = "md",
  children, 
  ...props 
}: ResponsiveGridProps) {
  return (
    <div
      className={cn(
        "grid",
        
        // Gap sizes
        gap === "xs" && "gap-2",
        gap === "sm" && "gap-3", 
        gap === "md" && "gap-4",
        gap === "lg" && "gap-6",
        gap === "xl" && "gap-8",
        
        // Grid patterns
        pattern === "auto" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        pattern === "cards" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        pattern === "half" && "grid-cols-1 sm:grid-cols-2",
        pattern === "thirds" && "grid-cols-1 lg:grid-cols-3",
        pattern === "quarters" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        pattern === "stats" && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6",
        pattern === "single" && "grid-cols-1",
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}