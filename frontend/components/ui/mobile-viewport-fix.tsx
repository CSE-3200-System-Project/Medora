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

    const updateViewport = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
      const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);

      root.style.setProperty("--app-vh", `${viewportHeight * 0.01}px`);
      root.style.setProperty("--keyboard-inset-height", `${keyboardInset}px`);

      body.classList.toggle("keyboard-open", keyboardInset > 0);
    };

    updateViewport();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener("resize", updateViewport);
    visualViewport?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport, { passive: true });
    window.addEventListener("orientationchange", updateViewport, { passive: true });

    return () => {
      visualViewport?.removeEventListener("resize", updateViewport);
      visualViewport?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
    };
  }, []);

  return null;
}
