"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * Smooth Scroll Provider using Lenis
 * Only enabled on desktop devices (no touch)
 * 
 * Per PRD: Disable on touch devices, smoothing < 0.8
 */
export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Only enable on non-touch devices
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isTouchDevice) {
      return;
    }

    // Initialize Lenis with conservative settings
    lenisRef.current = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    // RAF loop
    function raf(time: number) {
      lenisRef.current?.raf(time);
      requestAnimationFrame(raf);
    }
    
    requestAnimationFrame(raf);

    // Cleanup
    return () => {
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}

export default SmoothScrollProvider;
