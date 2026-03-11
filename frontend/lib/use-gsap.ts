"use client";

import { useEffect, useCallback } from "react";
import { motion } from "@/lib/motion";

type AnimationHandle = { kill: () => void };

function animateElement(
  element: Element,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): AnimationHandle {
  const animation = element.animate(keyframes, {
    fill: "forwards",
    ...options,
  });

  return {
    kill: () => animation.cancel(),
  };
}

function easeToCss(ease: string): string {
  return ease;
}

export function usePageEntry(containerRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!containerRef.current) return;

    const anim = animateElement(
      containerRef.current,
      [
        { opacity: 0, transform: `translateY(${motion.offset.medium}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: motion.duration.base * 1000,
        easing: easeToCss(motion.ease.enter),
      },
    );

    return () => anim.kill();
  }, [containerRef]);
}

export function useStaggerAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  selector: string = "> *",
) {
  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll(selector);
    const animations: AnimationHandle[] = [];

    items.forEach((item, index) => {
      animations.push(
        animateElement(
          item,
          [
            { opacity: 0, transform: `translateY(${motion.offset.small}px)` },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: motion.duration.base * 1000,
            easing: easeToCss(motion.ease.enter),
            delay: index * motion.stagger.base * 1000,
          },
        ),
      );
    });

    return () => {
      animations.forEach((anim) => anim.kill());
    };
  }, [containerRef, selector]);
}

export function useCardHover(cardRef: React.RefObject<HTMLElement | null>) {
  const handleMouseEnter = useCallback(() => {
    if (!cardRef.current) return;
    if (!window.matchMedia("(hover: hover)").matches) return;

    animateElement(
      cardRef.current,
      [
        { transform: "translateY(0)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)" },
        { transform: "translateY(-2px)", boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" },
      ],
      {
        duration: motion.duration.fast * 1000,
        easing: easeToCss(motion.ease.standard),
      },
    );
  }, [cardRef]);

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;

    animateElement(
      cardRef.current,
      [
        { transform: "translateY(-2px)", boxShadow: "0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)" },
        { transform: "translateY(0)", boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)" },
      ],
      {
        duration: motion.duration.fast * 1000,
        easing: easeToCss(motion.ease.standard),
      },
    );
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

export function useFadeIn(
  elementRef: React.RefObject<HTMLElement | null>,
  delay: number = 0,
) {
  useEffect(() => {
    if (!elementRef.current) return;

    const anim = animateElement(
      elementRef.current,
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: motion.duration.base * 1000,
        easing: easeToCss(motion.ease.enter),
        delay: delay * 1000,
      },
    );

    return () => anim.kill();
  }, [elementRef, delay]);
}

export function useSlideUp(
  elementRef: React.RefObject<HTMLElement | null>,
  delay: number = 0,
) {
  useEffect(() => {
    if (!elementRef.current) return;

    const anim = animateElement(
      elementRef.current,
      [
        { opacity: 0, transform: `translateY(${motion.offset.medium}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      {
        duration: motion.duration.base * 1000,
        easing: easeToCss(motion.ease.enter),
        delay: delay * 1000,
      },
    );

    return () => anim.kill();
  }, [elementRef, delay]);
}

export function useGsapAnimation(
  ref: React.RefObject<HTMLElement | null>,
  animation: (element: HTMLElement) => AnimationHandle,
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

// Compatibility export for legacy imports.
export const gsap = {
  to: () => ({ kill: () => undefined }),
  fromTo: () => ({ kill: () => undefined }),
};
