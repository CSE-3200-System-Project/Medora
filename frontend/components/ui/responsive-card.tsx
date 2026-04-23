import React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

interface ResponsiveCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Card size variant for different screen sizes
   * @default "auto"
   */
  size?: 
    | "auto"          // Compact on mobile, comfortable on desktop
    | "compact"       // Always compact padding
    | "comfortable"   // Always comfortable padding
    | "spacious";     // Always spacious padding
    
  /**
   * Whether the card should take full width on mobile
   * @default true
   */
  fullWidthMobile?: boolean;
  
  /**
   * Whether to add mobile-friendly touch interaction
   * @default false
   */
  touchFriendly?: boolean;
}

/**
 * ResponsiveCard - Mobile-first card with responsive padding and touch targets
 * 
 * Standard usage:
 * <ResponsiveCard>
 *   <h3>Card Title</h3>
 *   <p>Card content</p>
 * </ResponsiveCard>
 * 
 * Touch-friendly for interactive cards:
 * <ResponsiveCard touchFriendly onClick={handleClick}>
 *   Interactive content
 * </ResponsiveCard>
 */
export function ResponsiveCard({ 
  className, 
  size = "auto",
  fullWidthMobile = true,
  touchFriendly = false,
  children, 
  ...props 
}: ResponsiveCardProps) {
  return (
    <Card
      className={cn(
        // Mobile width behavior
        fullWidthMobile && "w-full",
        
        // Responsive padding based on size
        size === "auto" && "card-padding",
        size === "compact" && "p-3 sm:p-4",
        size === "comfortable" && "p-4 sm:p-6",
        size === "spacious" && "p-6 sm:p-8",
        
        // Touch interaction
        touchFriendly && [
          "cursor-pointer",
          "min-h-[44px]", // Minimum touch target
          "transition-all duration-200",
          "hover:shadow-md hover:border-primary/20",
          "active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        ],
        
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
}
