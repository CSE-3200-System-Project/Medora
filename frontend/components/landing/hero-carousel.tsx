"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";

type Slide = {
  id: "patient" | "doctor";
  badge: string;
  title: string;
  accent: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryHref: string;
  secondaryHref: string;
  image: typeof patientImg;
  imageAlt: string;
};

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
    image: patientImg,
    imageAlt: "Patient consultation",
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
    image: doctorImg,
    imageAlt: "Doctor examining patient",
  },
];

export function HeroCarousel() {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 7000);

    return () => clearInterval(interval);
  }, []);

  const activeSlide = useMemo(() => HERO_SLIDES[slideIndex], [slideIndex]);

  const previousSlide = () => {
    setSlideIndex((prev) => (prev === 0 ? HERO_SLIDES.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
  };

  return (
    <section className="rounded-3xl border border-border/70 bg-card/95 shadow-[0_24px_50px_-35px_rgba(3,96,217,0.85)] overflow-hidden">
      <div className="grid lg:grid-cols-12">
        <div className="lg:col-span-6 p-6 sm:p-8 md:p-10 lg:p-12 flex flex-col justify-center bg-gradient-to-b from-background/85 via-card/70 to-card/95">
          <span className="mb-4 inline-flex w-fit rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
            {activeSlide.badge}
          </span>

          <h1 className="text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
            {activeSlide.title}
            <span className="mt-2 block text-primary">{activeSlide.accent}</span>
          </h1>

          <p className="mt-5 max-w-xl text-base md:text-lg text-muted-foreground leading-relaxed">
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground hover:bg-accent"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-background/70 text-foreground hover:bg-accent"
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
                  className={`h-2 rounded-full transition-all ${
                    index === slideIndex ? "w-8 bg-primary" : "w-2 bg-primary/35"
                  }`}
                  aria-label={`Show ${slide.badge}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[280px] sm:min-h-[340px] lg:min-h-[560px] border-t lg:border-t-0 lg:border-l border-border/70">
          <Image src={activeSlide.image} alt={activeSlide.imageAlt} fill className="object-cover" priority />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/15 to-transparent" />
        </div>
      </div>
    </section>
  );
}
