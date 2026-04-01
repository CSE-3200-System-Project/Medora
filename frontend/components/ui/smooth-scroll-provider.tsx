"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

type LenisInstance = {
  raf: (time: number) => void;
  destroy: () => void;
};

/**
 * Smooth Scroll Provider using Lenis
 * Only enabled on desktop devices (no touch)
 * 
 * Per PRD: Disable on touch devices, smoothing < 0.8
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<LenisInstance | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let disposed = false;
    const smoothScrollEnabled = process.env.NEXT_PUBLIC_ENABLE_SMOOTH_SCROLL === "true";

    if (!smoothScrollEnabled) {
      return;
    }

    const strictMobileAnim = process.env.NEXT_PUBLIC_PERF_STRICT_MOBILE_ANIM !== "false";
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowMemoryDevice = typeof (navigator as { deviceMemory?: number }).deviceMemory === "number"
      ? (navigator as { deviceMemory?: number }).deviceMemory! <= 4
      : false;
    const lowCpuDevice = typeof navigator.hardwareConcurrency === "number"
      ? navigator.hardwareConcurrency <= 4
      : false;

    const skipPaths = [
      "/login",
      "/selection",
      "/patient/register",
      "/doctor/register",
      "/forgot-password",
      "/auth/reset-password",
      "/onboarding/",
      "/patient/find-doctor",
      "/patient/doctor/",
      "/doctor/patient/",
    ];
    const shouldSkipPath = skipPaths.some((path) => pathname.startsWith(path));

    if (prefersReducedMotion || shouldSkipPath) {
      return;
    }

    if (strictMobileAnim && (isTouchDevice || lowMemoryDevice || lowCpuDevice)) {
      return;
    }

    const initializeLenis = async () => {
      const { default: Lenis } = await import("lenis");
      if (disposed) {
        return;
      }

      lenisRef.current = new Lenis({
        duration: 0.8,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1,
        infinite: false,
      }) as LenisInstance;

      function raf(time: number) {
        lenisRef.current?.raf(time);
        rafIdRef.current = requestAnimationFrame(raf);
      }

      rafIdRef.current = requestAnimationFrame(raf);
    };

    void initializeLenis();

    // Cleanup
    return () => {
      disposed = true;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, [pathname]);

  return <>{children}</>;
}

export default SmoothScrollProvider;
