"use client";

import { useEffect } from "react";

/**
 * Keeps CSS viewport units stable on mobile browsers and when the virtual keyboard opens.
 */
export function MobileViewportFix() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const body = document.body;
    let rafId: number | null = null;

    const updateViewport = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);

      root.style.setProperty("--app-vh", `${viewportHeight * 0.01}px`);
      root.style.setProperty("--keyboard-inset-height", `${keyboardInset}px`);

      body.classList.toggle("keyboard-open", keyboardInset > 48);
    };

    const scheduleViewportUpdate = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        rafId = null;
        updateViewport();
      });
    };

    scheduleViewportUpdate();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", scheduleViewportUpdate);
    visualViewport?.addEventListener("scroll", scheduleViewportUpdate);
    window.addEventListener("resize", scheduleViewportUpdate, { passive: true });
    window.addEventListener("orientationchange", scheduleViewportUpdate, { passive: true });

    return () => {
      visualViewport?.removeEventListener("resize", scheduleViewportUpdate);
      visualViewport?.removeEventListener("scroll", scheduleViewportUpdate);
      window.removeEventListener("resize", scheduleViewportUpdate);
      window.removeEventListener("orientationchange", scheduleViewportUpdate);

      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return null;
}
