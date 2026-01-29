"use client";

import { useEffect, useCallback } from "react";
import gsap from "gsap";
import { motion } from "@/lib/motion";

/**
 * GSAP Animation Hook
 * Provides reusable animation functions following the PRD motion system
 */

// Page entry animation
export function usePageEntry(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      // Animate the container
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: motion.offset.medium },
        { 
          opacity: 1, 
          y: 0, 
          duration: motion.duration.base, 
          ease: motion.ease.enter 
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [containerRef]);
}

// Stagger animation for lists
export function useStaggerAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string = "> *"
) {
  useEffect(() => {
    if (!containerRef.current) return;

    const ctx = gsap.context(() => {
      const items = containerRef.current?.querySelectorAll(selector);
      if (!items || items.length === 0) return;

      gsap.fromTo(
        items,
        { opacity: 0, y: motion.offset.small },
        {
          opacity: 1,
          y: 0,
          duration: motion.duration.base,
          ease: motion.ease.enter,
          stagger: motion.stagger.base,
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [containerRef, selector]);
}

// Card hover animation (desktop only)
export function useCardHover(cardRef: React.RefObject<HTMLElement | null>) {
  const handleMouseEnter = useCallback(() => {
    if (!cardRef.current) return;
    // Only apply on devices with hover capability
    if (window.matchMedia('(hover: hover)').matches) {
      gsap.to(cardRef.current, {
        y: -2,
        boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)",
        duration: motion.duration.fast,
        ease: motion.ease.standard,
      });
    }
  }, [cardRef]);

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;
    gsap.to(cardRef.current, {
      y: 0,
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)",
      duration: motion.duration.fast,
      ease: motion.ease.standard,
    });
  }, [cardRef]);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    card.addEventListener("mouseenter", handleMouseEnter);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mouseenter", handleMouseEnter);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [cardRef, handleMouseEnter, handleMouseLeave]);
}

// Fade in animation
export function useFadeIn(
  elementRef: React.RefObject<HTMLElement | null>,
  delay: number = 0
) {
  useEffect(() => {
    if (!elementRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        elementRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: motion.duration.base,
          ease: motion.ease.enter,
          delay,
        }
      );
    }, elementRef);

    return () => ctx.revert();
  }, [elementRef, delay]);
}

// Slide up animation
export function useSlideUp(
  elementRef: React.RefObject<HTMLElement | null>,
  delay: number = 0
) {
  useEffect(() => {
    if (!elementRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        elementRef.current,
        { opacity: 0, y: motion.offset.medium },
        {
          opacity: 1,
          y: 0,
          duration: motion.duration.base,
          ease: motion.ease.enter,
          delay,
        }
      );
    }, elementRef);

    return () => ctx.revert();
  }, [elementRef, delay]);
}

// Generic GSAP animation hook - simplified version without complex deps
export function useGsapAnimation(
  ref: React.RefObject<HTMLElement | null>,
  animation: (element: HTMLElement) => gsap.core.Tween | gsap.core.Timeline
) {
  useEffect(() => {
    if (!ref.current) return;

    const anim = animation(ref.current);

    return () => {
      anim.kill();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);
}

// Export gsap for direct use
export { gsap };
