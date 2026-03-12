"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface AppBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Whether to use the full page background (mobile-safe viewport height)
   * @default true
   */
  fullPage?: boolean;
}

/**
 * AppBackground - Clinical Depth Field Background
 * 
 * A premium, calm background with:
 * - Vertical tonal shift (environmental lighting cue)
 * - One directional soft-focus medical-blue glow
 * - Micro-noise for material realism
 * - No continuous animation (performance-first)
 * 
 * Usage:
 * ```tsx
 * <AppBackground>
 *   <Navbar />
 *   <main>{children}</main>
 * </AppBackground>
 * ```
 */
export function AppBackground({ 
  className, 
  fullPage = true,
  children, 
  ...props 
}: AppBackgroundProps) {
  return (
    <div
      data-slot="app-background"
      className={cn(
        "app-background keyboard-safe-bottom",
        fullPage && "min-h-dvh min-h-app",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
