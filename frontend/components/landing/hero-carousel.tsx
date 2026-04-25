"use client";

import { type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SHARED_HERO_IMAGES } from "./hero-images";

type Slide = {
  id: "patient" | "doctor" | "context" | "care";
  badge: string;
  title: string;
  accent: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryHref: string;
  secondaryHref: string;
  image: (typeof SHARED_HERO_IMAGES)[number]["src"];
  imageAlt: string;
};

const [patientImage, heroDoctorImage, doctorImage, heroPatientImage] = SHARED_HERO_IMAGES;

const HERO_SLIDES: Slide[] = [
  {
    id: "patient",
    badge: "For Patients",
    title: "Take control of your health",
    accent: "clearly, safely, and over time",
    description:
      "Keep your records organized, track conditions and medication, and share accurate context with doctors when needed.",
    primaryLabel: "Create Patient Account",
    secondaryLabel: "Explore how it works",
    primaryHref: "/selection",
    secondaryHref: "#how-it-works",
    image: patientImage.src,
    imageAlt: patientImage.alt,
  },
  {
    id: "doctor",
    badge: "For Doctors",
    title: "Practice with complete context",
    accent: "not fragmented information",
    description:
      "Review structured patient history faster, reduce repetitive intake questions, and focus your time on decisions.",
    primaryLabel: "Create Doctor Account",
    secondaryLabel: "See doctor features",
    primaryHref: "/selection",
    secondaryHref: "#for-doctors",
    image: heroDoctorImage.src,
    imageAlt: heroDoctorImage.alt,
  },
  {
    id: "context",
    badge: "Shared Context",
    title: "One timeline, one source of truth",
    accent: "for every consultation",
    description:
      "Medication, tests, and history stay connected — so every visit builds on the last instead of starting over.",
    primaryLabel: "Get started",
    secondaryLabel: "How it works",
    primaryHref: "/selection",
    secondaryHref: "#how-it-works",
    image: doctorImage.src,
    imageAlt: doctorImage.alt,
  },
  {
    id: "care",
    badge: "Better Care",
    title: "Healthcare that remembers you",
    accent: "reliable, private, continuous",
    description:
      "Private by design, role-aware, and ready for long-term care — reminders and summaries that actually help.",
    primaryLabel: "Join Medora",
    secondaryLabel: "Why Medora",
    primaryHref: "/selection",
    secondaryHref: "#about",
    image: heroPatientImage.src,
    imageAlt: heroPatientImage.alt,
  },
];

const AUTO_ADVANCE_MS = 6000;

export function HeroCarousel() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [isHoverPaused, setIsHoverPaused] = useState(false);
  const [isDocumentHidden, setIsDocumentHidden] = useState(false);
  const [autoPlayAllowed, setAutoPlayAllowed] = useState(true);
  const touchStartX = useRef<number | null>(null);

  const activeSlide = useMemo(() => HERO_SLIDES[slideIndex], [slideIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMotion = () => setAutoPlayAllowed(!motionQuery.matches);

    syncMotion();

    motionQuery.addEventListener?.("change", syncMotion);

    return () => {
      motionQuery.removeEventListener?.("change", syncMotion);
    };
  }, []);

  useEffect(() => {
    if (!autoPlayAllowed || isHoverPaused || isDocumentHidden || typeof window === "undefined") return;
    const id = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [autoPlayAllowed, isHoverPaused, isDocumentHidden]);

  useEffect(() => {
    const handleVisibility = () => setIsDocumentHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const previousSlide = useCallback(() => {
    setSlideIndex((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1));
  }, []);

  const nextSlide = useCallback(() => {
    setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    touchStartX.current = event.clientX;
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse") return;
    if (touchStartX.current === null) return;

    const deltaX = event.clientX - touchStartX.current;
    const swipeThreshold = 44;

    if (deltaX > swipeThreshold) previousSlide();
    if (deltaX < -swipeThreshold) nextSlide();

    touchStartX.current = null;
  };

  return (
    <section
      className="overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-surface-strong min-h-[31rem] lg:h-[34rem] lg:min-h-0"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        touchStartX.current = null;
      }}
      onMouseEnter={() => setIsHoverPaused(true)}
      onMouseLeave={() => setIsHoverPaused(false)}
      aria-roledescription="carousel"
      aria-label="Medora platform highlights"
    >
      <div className="grid lg:h-full lg:grid-cols-12">
        <div
          className="relative flex min-h-[31rem] flex-col justify-center bg-linear-to-b from-background/85 via-card/70 to-card/95 p-6 sm:p-8 md:p-10 lg:col-span-6 lg:h-full lg:min-h-0 lg:p-12"
        >
          <div className="pointer-events-none absolute inset-0 -z-10 lg:hidden">
            {HERO_SLIDES.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
                  index === slideIndex ? "opacity-30" : "opacity-0"
                }`}
                aria-hidden
              >
                <Image
                  src={slide.image}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                  priority={index === 0}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  placeholder="blur"
                />
              </div>
            ))}
            <div className="absolute inset-0 bg-linear-to-b from-background/60 via-background/85 to-background" />
          </div>

          <span className="mb-4 inline-flex w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {activeSlide.badge}
          </span>

          <h1 className="min-h-[7.5rem] text-3xl font-bold leading-tight tracking-tight md:min-h-[8.5rem] md:text-4xl xl:text-5xl">
            {activeSlide.title}
            <span className="mt-2 block text-primary">{activeSlide.accent}</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:min-h-[5.5rem] md:text-lg">
            {activeSlide.description}
          </p>

          <div className="mt-8 button-row">
            <Button size="lg" asChild className="w-full sm:w-auto px-7">
              <Link href={activeSlide.primaryHref}>{activeSlide.primaryLabel}</Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="w-full sm:w-auto px-7 border-border/70 bg-background/55">
              <Link href={activeSlide.secondaryHref}>{activeSlide.secondaryLabel}</Link>
            </Button>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="button"
              onClick={previousSlide}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Next slide"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="ml-2 flex gap-2">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  type="button"
                  key={slide.id}
                  onClick={() => setSlideIndex(index)}
                  className={`h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                    index === slideIndex ? "bg-primary" : "bg-primary/35"
                  }`}
                  aria-label={`Show ${slide.badge}`}
                  aria-current={index === slideIndex}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="relative hidden border-l border-border/70 lg:col-span-6 lg:block lg:h-full">
          {HERO_SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-[1200ms] ease-in-out ${
                index === slideIndex ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={index !== slideIndex}
            >
              <Image
                src={slide.image}
                alt={slide.imageAlt}
                fill
                sizes="50vw"
                className="object-cover"
                priority={index === 0}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "low"}
                decoding="async"
                placeholder="blur"
              />
            </div>
          ))}
          <div className="absolute inset-0 bg-linear-to-t from-black/45 via-black/15 to-transparent" />
        </div>
      </div>
    </section>
  );
}
