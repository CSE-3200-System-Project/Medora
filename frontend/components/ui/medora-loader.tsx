"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MedoraLoaderProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

/**
 * Theme-aware loader with Medora pulse animation.
 * - sm: inline / button contexts
 * - md: card / section loading
 * - lg: full-page loading
 */
export function MedoraLoader({
  size = "md",
  label,
  className,
  fullScreen = false,
}: MedoraLoaderProps) {
  const sizeMap = {
    sm: { outer: "h-6 w-6", inner: "h-3 w-3", ring: "h-5 w-5" },
    md: { outer: "h-10 w-10", inner: "h-5 w-5", ring: "h-9 w-9" },
    lg: { outer: "h-16 w-16", inner: "h-8 w-8", ring: "h-14 w-14" },
  };

  const { outer, inner, ring } = sizeMap[size];

  const loader = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        fullScreen && "fixed inset-0 z-[70] min-h-dvh bg-background/80 backdrop-blur-sm",
        className
      )}
    >
      <div className={cn("relative flex items-center justify-center", outer)}>
        {/* Outer spinning ring */}
        <div
          className={cn(
            "absolute rounded-full border-2 border-primary/30 border-t-primary animate-spin",
            ring
          )}
          style={{ animationDuration: "1s" }}
        />
        {/* Inner pulse dot */}
        <div
          className={cn(
            "rounded-full bg-primary animate-pulse",
            inner
          )}
          style={{ animationDuration: "1.2s" }}
        />
      </div>
      {label && (
        <p className="text-sm text-muted-foreground animate-pulse font-medium">
          {label}
        </p>
      )}
    </div>
  );

  return loader;
}

interface ButtonLoaderProps {
  className?: string;
}

/**
 * Tiny inline spinner for buttons. Replaces icon or text while loading.
 */
export function ButtonLoader({ className }: ButtonLoaderProps) {
  return (
    <div
      className={cn(
        "h-4 w-4 rounded-full border-2 border-current/30 border-t-current animate-spin",
        className
      )}
      style={{ animationDuration: "0.8s" }}
    />
  );
}
