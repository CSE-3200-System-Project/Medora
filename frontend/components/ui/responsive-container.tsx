import React from "react";
import { cn } from "@/lib/utils";

interface ResponsiveContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Maximum width breakpoint for the container
   * @default "screen-xl"
   */
  maxWidth?: "screen-sm" | "screen-md" | "screen-lg" | "screen-xl" | "screen-2xl" | "none";
  /**
   * Whether to center the container horizontally
   * @default true
   */
  centered?: boolean;
  /**
   * Whether to include horizontal padding
   * @default true
   */
  withPadding?: boolean;
}

/**
 * ResponsiveContainer - Mobile-first page container with consistent max-width and padding
 * 
 * Standard usage:
 * <ResponsiveContainer>
 *   <h1>Page Content</h1>
 * </ResponsiveContainer>
 * 
 * Results in: max-w-screen-xl mx-auto container-padding
 */
export function ResponsiveContainer({ 
  className, 
  maxWidth = "screen-xl",
  centered = true,
  withPadding = true,
  children, 
  ...props 
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        // Max width constraints
        maxWidth === "screen-sm" && "max-w-screen-sm",
        maxWidth === "screen-md" && "max-w-screen-md", 
        maxWidth === "screen-lg" && "max-w-screen-lg",
        maxWidth === "screen-xl" && "max-w-screen-xl",
        maxWidth === "screen-2xl" && "max-w-screen-2xl",
        maxWidth === "none" && "max-w-none",
        
        // Centering
        centered && "mx-auto",
        
        // Mobile-first responsive padding
        withPadding && "container-padding",
        
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

