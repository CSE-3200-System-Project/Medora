"use client";

import { useEffect, useRef, useState } from "react";
import Image, { type StaticImageData } from "next/image";

export type HeroSlideshowImage = {
  src: StaticImageData;
  alt: string;
};

type HeroSlideshowProps = {
  images: readonly HeroSlideshowImage[];
  intervalMs?: number;
  sizes?: string;
  className?: string;
  overlayClassName?: string;
  renderOverlay?: (activeIndex: number) => React.ReactNode;
  showDots?: boolean;
  pauseOnHover?: boolean;
  onIndexChange?: (index: number) => void;
  minDesktopWidth?: number;
};

export function HeroSlideshow({
  images,
  intervalMs = 5000,
  sizes = "100vw",
  className = "",
  overlayClassName = "",
  renderOverlay,
  showDots = true,
  pauseOnHover = true,
  onIndexChange,
  minDesktopWidth,
}: HeroSlideshowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onIndexChange?.(activeIndex);
  }, [activeIndex, onIndexChange]);

  useEffect(() => {
    if (typeof window === "undefined" || images.length <= 1) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktopQuery =
      typeof minDesktopWidth === "number"
        ? window.matchMedia(`(min-width: ${minDesktopWidth}px)`)
        : null;

    const shouldRun = () => !reduceMotion.matches && (desktopQuery ? desktopQuery.matches : true);

    let intervalId: number | null = null;

    const start = () => {
      if (intervalId !== null || isPaused || !shouldRun()) return;
      intervalId = window.setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % images.length);
      }, intervalMs);
    };

    const stop = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    reduceMotion.addEventListener?.("change", () => (shouldRun() ? start() : stop()));
    desktopQuery?.addEventListener?.("change", () => (shouldRun() ? start() : stop()));

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [images.length, intervalMs, isPaused, minDesktopWidth]);

  if (images.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={pauseOnHover ? () => setIsPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setIsPaused(false) : undefined}
      onFocus={pauseOnHover ? () => setIsPaused(true) : undefined}
      onBlur={pauseOnHover ? () => setIsPaused(false) : undefined}
      aria-roledescription="carousel"
    >
      {images.map((image, index) => {
        const isActive = index === activeIndex;
        const isFirst = index === 0;
        return (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
              isActive ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={!isActive}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes={sizes}
              className="object-cover"
              priority={isFirst}
              loading={isFirst ? "eager" : "lazy"}
              fetchPriority={isFirst ? "high" : "low"}
              decoding="async"
              placeholder="blur"
            />
          </div>
        );
      })}

      {overlayClassName ? <div className={`absolute inset-0 ${overlayClassName}`} /> : null}

      {renderOverlay ? (
        <div className="relative z-10 h-full w-full">{renderOverlay(activeIndex)}</div>
      ) : null}

      {showDots && images.length > 1 ? (
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeIndex ? "w-8 bg-white" : "w-2 bg-white/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === activeIndex}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
