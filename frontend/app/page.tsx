import React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  TrendingUp,
  Users,
} from "lucide-react";

import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { HeroCarousel } from "@/components/landing/hero-carousel";
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";

export default function Home() {
  return (
    <AppBackground className="min-h-dvh min-h-app">
      <Navbar />

      <main className="mx-auto max-w-7xl page-content pt-(--nav-content-offset) pb-14 md:pb-20 space-y-14 md:space-y-20 animate-page-enter">
        <HeroCarousel />

        <section className="space-y-8">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">A platform built around shared context</h2>
            <p className="text-muted-foreground text-base md:text-lg">
              Replace scattered records with one clear timeline that supports patient care and clinical decisions.
            </p>
          </div>

          <div className="grid gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <PillarCard
              icon={<FileText className="h-7 w-7 text-primary" />}
              title="Structured Profiles"
              description="Clear, editable medical information designed for long-term use."
            />
            <PillarCard
              icon={<Clock className="h-7 w-7 text-primary" />}
              title="Longitudinal History"
              description="Conditions, medication, tests, and visits organized in a single timeline."
            />
            <PillarCard
              icon={<Users className="h-7 w-7 text-primary" />}
              title="Shared Visibility"
              description="Doctors and patients work from the same context with less repetition."
            />
            <PillarCard
              icon={<Activity className="h-7 w-7 text-primary" />}
              title="Practical Assistance"
              description="Optional reminders and summaries that support real workflows."
            />
          </div>
        </section>

        <section id="how-it-works" className="scroll-offset-navbar defer-content rounded-3xl border border-border/70 bg-card/90 shadow-sm">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-10 p-6 md:p-10">
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold">How it works</h2>
              <p className="text-muted-foreground">
                Join as a patient or doctor, add essential information, and keep care decisions anchored in reliable context.
              </p>
              <div className="space-y-5">
                <Step number="1" title="Create your account" description="Choose patient or doctor onboarding flow." />
                <Step number="2" title="Add core medical details" description="Start with clean data entry built for follow-up care." />
                <Step number="3" title="Keep history updated" description="Track visits, medication, tests, and condition changes over time." />
                <Step number="4" title="Collaborate with confidence" description="Use shared context for clearer consultations." />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-surface/45 p-5 md:p-6 space-y-3">
              <FlowCard badge="P" badgeClass="bg-primary/15 text-primary" title="Patient updates profile" text="Medication and symptoms are added." />
              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
              </div>
              <FlowCard badge="S" badgeClass="bg-success/20 text-success-muted" title="System organizes timeline" text="Data appears in one history view." />
              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
              </div>
              <FlowCard badge="D" badgeClass="bg-primary-light/35 text-primary" title="Doctor reviews context" text="Consultation starts with useful background." />
            </div>
          </div>
        </section>

        <section id="for-patients" className="scroll-offset-navbar defer-content grid gap-8 lg:grid-cols-2 items-center">
          <div className="relative h-[clamp(16rem,44vw,30rem)] rounded-3xl overflow-hidden border border-border/70 shadow-xl">
            <Image src={patientImg} alt="Patient experience" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-6">
              <p className="text-white text-sm md:text-base font-medium">
                I no longer need to repeat my full history every time.
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              For Patients
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">Everything stays organized</h2>
            <ul className="space-y-3">
              <FeatureItem text="One place for medication, tests, and conditions" />
              <FeatureItem text="Clear reminders and appointment continuity" />
              <FeatureItem text="Better communication with doctors" />
              <FeatureItem text="Control over profile and shared information" />
            </ul>
            <Button size="lg" asChild>
              <Link href="/selection">Start as a Patient</Link>
            </Button>
          </div>
        </section>

        <section
          id="for-doctors"
          className="scroll-offset-navbar defer-content grid gap-8 lg:grid-cols-2 items-center rounded-3xl border border-border/70 bg-card/90 p-6 md:p-10"
        >
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              For Doctors
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">Clinical context before consultation</h2>
            <ul className="space-y-3">
              <FeatureItem text="Structured patient history in one view" />
              <FeatureItem text="Reduced repetitive intake questions" />
              <FeatureItem text="Improved continuity across appointments" />
              <FeatureItem text="Optional AI support without forced automation" />
            </ul>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/selection">Start as a Doctor</Link>
            </Button>
          </div>
          <div className="relative h-[clamp(16rem,44vw,30rem)] rounded-3xl overflow-hidden border border-border/70 shadow-xl">
            <Image src={doctorImg} alt="Doctor experience" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-6">
              <p className="text-white text-sm md:text-base font-medium">
                I can focus on decisions, not searching for missing records.
              </p>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-offset-navbar defer-content max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">Why this platform exists</h2>
            <p className="text-muted-foreground leading-relaxed">
              Healthcare quality depends on continuity. Medora is designed to preserve clinical context, reduce repetition,
              and make both patient and doctor workflows more dependable.
            </p>
          </div>
          <Separator />
          <div id="privacy" className="grid gap-7 md:grid-cols-2">
            <InfoBlock
              icon={<Shield className="h-5 w-5 text-primary" />}
              title="Privacy and Control"
              description="Data is role-aware and user-controlled with explicit visibility boundaries."
            />
            <InfoBlock
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              title="Future Ready Architecture"
              description="Designed for safe automation and measurable outcomes without hype-first design."
            />
          </div>
        </section>

        <section className="defer-content rounded-3xl border border-primary/30 bg-linear-to-br from-primary to-primary-muted text-primary-foreground shadow-[0_24px_60px_-30px_rgba(3,96,217,0.9)]">
          <div className="px-6 py-10 md:px-10 md:py-14 text-center">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">Build better care with shared context</h2>
            <p className="mt-3 text-primary-foreground/90 text-sm md:text-base">
              Start as patient or doctor and keep healthcare decisions anchored in accurate history.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" variant="secondary" className="px-8" asChild>
                <Link href="/selection">Create Patient Account</Link>
              </Button>
              <Button
                size="lg"
                className="px-8 bg-primary-foreground/12 border border-primary-foreground/30 hover:bg-primary-foreground/18"
                asChild
              >
                <Link href="/selection">Create Doctor Account</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-6 border-t border-border/70 bg-background/70">
        <div className="mx-auto max-w-7xl page-content py-10 md:py-12 grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <h3 className="text-lg font-bold">Medora</h3>
            <p className="text-sm text-muted-foreground">One platform. Shared understanding. Better care.</p>
          </div>
          <FooterColumn title="Platform" links={["How it works", "For Patients", "For Doctors"]} />
          <FooterColumn title="Legal" links={["Privacy Policy", "Terms of Service"]} />
          <FooterColumn title="Contact" links={["Support", "Contact Us"]} />
        </div>
        <div className="border-t border-border/60 py-5 text-center text-sm text-muted-foreground">
          (c) {new Date().getFullYear()} Medora. All rights reserved.
        </div>
      </footer>
    </AppBackground>
  );
}

function PillarCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card hoverable className="border-border/70">
      <CardHeader>
        <div className="mb-1">{icon}</div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm md:text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {number}
      </div>
      <div className="space-y-1">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FlowCard({
  badge,
  badgeClass,
  title,
  text,
}: {
  badge: string;
  badgeClass: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/75 px-4 py-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${badgeClass}`}>{badge}</div>
      <div>
        <p className="font-semibold text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
      <span className="text-sm md:text-base text-foreground">{text}</span>
    </li>
  );
}

function InfoBlock({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card/85 p-5">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="font-semibold mb-3">{title}</h4>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {links.map((link) => (
          <li key={link}>
            <Link href="#" className="hover:text-foreground transition-colors">
              {link}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
