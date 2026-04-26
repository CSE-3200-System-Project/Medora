"use client";

import Image from "next/image";
import Link from "next/link";
import * as React from "react";

import logo from "@/assets/images/logo.png";

type ChoruiLauncherProps = {
  role: "patient" | "doctor";
};

const targetByRole: Record<ChoruiLauncherProps["role"], string> = {
  patient: "/patient/chorui-ai",
  doctor: "/doctor/chorui-ai",
};

const tooltipByRole: Record<ChoruiLauncherProps["role"], string> = {
  patient: "Ask Chorui AI",
  doctor: "Chorui AI",
};

export function ChoruiLauncher({ role }: ChoruiLauncherProps) {
  return (
    <Link
      href={targetByRole[role]}
      aria-label="Open Chorui AI assistant"
      title={tooltipByRole[role]}
      className="group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full">
        <Image
          src={logo}
          alt="Chorui AI"
          fill
          sizes="50px"
          className="object-contain scale-150"
          priority
        />
      </span>
      {/* Tooltip */}
      <span className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border/60 bg-popover px-2 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100">
        {tooltipByRole[role]}
      </span>
    </Link>
  );
}
