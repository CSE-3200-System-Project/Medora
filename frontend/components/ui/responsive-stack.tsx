import React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveStackProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Stack direction behavior across breakpoints
   * @default "mobile-stack" - vertical on mobile, horizontal on md+
   */
  direction?: 
    | "mobile-stack"   // flex-col md:flex-row (default)
    | "always-stack"   // flex-col (always vertical)
    | "always-row"     // flex-row (always horizontal) 
    | "tablet-stack"   // flex-col lg:flex-row (vertical until large screens)
    | "reverse-stack"; // flex-col-reverse md:flex-row (reverse stack on mobile)
    
  /**
   * Gap between items
   * @default "md"  
   */
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  
  /**
   * Alignment of items
   */
  align?: "start" | "center" | "end" | "stretch";
  
  /**
   * Justify content
   */
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  
  /**
   * Whether items should wrap
   * @default false
   */
  wrap?: boolean;
}

/**
 * ResponsiveStack - Mobile-first flex layouts with responsive direction changes
 * 
 * Standard usage (mobile stack, desktop row):
 * <ResponsiveStack>
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 * </ResponsiveStack>
 * 
 * Results in: flex flex-col md:flex-row gap-4
 */
export function ResponsiveStack({ 
  className, 
  direction = "mobile-stack",
  gap = "md",
  align,
  justify,
  wrap = false,
  children, 
  ...props 
}: ResponsiveStackProps) {
  return (
    <div
      className={cn(
        "flex",
        
        // Direction patterns
        direction === "mobile-stack" && "flex-col md:flex-row",
        direction === "always-stack" && "flex-col",
        direction === "always-row" && "flex-row",
        direction === "tablet-stack" && "flex-col lg:flex-row", 
        direction === "reverse-stack" && "flex-col-reverse md:flex-row",
        
        // Gap sizes
        gap === "xs" && "gap-2",
        gap === "sm" && "gap-3",
        gap === "md" && "gap-4", 
        gap === "lg" && "gap-6",
        gap === "xl" && "gap-8",
        
        // Alignment
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end", 
        align === "stretch" && "items-stretch",
        
        // Justify
        justify === "start" && "justify-start",
        justify === "center" && "justify-center",
        justify === "end" && "justify-end",
        justify === "between" && "justify-between",
        justify === "around" && "justify-around",
        justify === "evenly" && "justify-evenly",
        
        // Wrap
        wrap && "flex-wrap",
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}