"use client";

import { cn } from "@/lib/utils";

export const glassCardClass =
  "rounded-xl border border-border/50 bg-white p-0 shadow-sm dark:bg-card";

export const tertiaryCardClass =
  "rounded-xl border border-primary/20 bg-primary/5";

export function changeClass(direction: "up" | "down" | "neutral"): string {
  if (direction === "up") {
    return "text-primary bg-primary/10";
  }

  if (direction === "down") {
    return "text-destructive bg-destructive/10";
  }

  return "text-muted-foreground bg-muted";
}

export function metricFillClass(accent: "primary" | "tertiary" | "error"): string {
  if (accent === "tertiary") {
    return "from-[#ffb597]/85 to-[#ffdbcd]/50";
  }

  if (accent === "error") {
    return "from-[#ffb4ab]/80 to-[#93000a]/45";
  }

  return "from-[#0360D9] to-[#b0c6ff]";
}

export function sectionTitleClass(extra?: string): string {
  return cn(
    "text-2xl font-bold tracking-tight text-foreground",
    extra,
  );
}
