import React from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getTranslations } from "next-intl/server";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";

const Navbar = dynamic(
  () => import("@/components/ui/navbar").then((mod) => mod.Navbar),
  {
    loading: () => <div className="mx-auto h-16 w-full max-w-7xl rounded-2xl border border-border/70 bg-background/75 shadow-surface" />,
  }
);

const HeroCarousel = dynamic(
  () => import("@/components/landing/hero-carousel").then((mod) => mod.HeroCarousel),
  {
    loading: () => <CardSkeleton className="min-h-90" />,
  }
);

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations();
  const localeHref = (path: string) => `/${locale}${path}`;

  return (
    <AppBackground className="min-h-dvh min-h-app">
      <Navbar />

      <main className="mx-auto max-w-7xl page-content pt-(--nav-content-offset) pb-14 md:pb-20 space-y-14 md:space-y-20 animate-page-enter">
        <HeroCarousel />

        <section className="space-y-8">
          <div className="text-center space-y-3 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">{t("landing.platform.heading")}</h2>
            <p className="text-muted-foreground text-base md:text-lg">
              {t("landing.platform.description")}
            </p>
          </div>

          <div className="grid gap-4 md:gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <PillarCard
              icon={<FileText className="h-7 w-7 text-primary" />}
              title={t("landing.pillars.structuredProfilesTitle")}
              description={t("landing.pillars.structuredProfilesDescription")}
            />
            <PillarCard
              icon={<Clock className="h-7 w-7 text-primary" />}
              title={t("landing.pillars.longitudinalHistoryTitle")}
              description={t("landing.pillars.longitudinalHistoryDescription")}
            />
            <PillarCard
              icon={<Users className="h-7 w-7 text-primary" />}
              title={t("landing.pillars.sharedVisibilityTitle")}
              description={t("landing.pillars.sharedVisibilityDescription")}
            />
            <PillarCard
              icon={<Activity className="h-7 w-7 text-primary" />}
              title={t("landing.pillars.practicalAssistanceTitle")}
              description={t("landing.pillars.practicalAssistanceDescription")}
            />
          </div>
        </section>

        <section id="how-it-works" className="scroll-offset-navbar rounded-3xl border border-border/70 bg-card/90 shadow-sm">
          <div className="grid lg:grid-cols-2 gap-8 md:gap-10 p-6 md:p-10">
            <div className="space-y-6">
              <h2 className="text-2xl md:text-3xl font-bold">{t("landing.sections.howItWorksTitle")}</h2>
              <p className="text-muted-foreground">
                {t("landing.sections.howItWorksDescription")}
              </p>
              <div className="space-y-5">
                <Step number="1" title={t("landing.steps.step1Title")} description={t("landing.steps.step1Description")} />
                <Step number="2" title={t("landing.steps.step2Title")} description={t("landing.steps.step2Description")} />
                <Step number="3" title={t("landing.steps.step3Title")} description={t("landing.steps.step3Description")} />
                <Step number="4" title={t("landing.steps.step4Title")} description={t("landing.steps.step4Description")} />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-surface/45 p-5 md:p-6 space-y-3">
              <FlowCard badge="P" badgeClass="bg-primary/15 text-primary" title={t("landing.flow.patientTitle")} text={t("landing.flow.patientDescription")} />
              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
              </div>
              <FlowCard badge="S" badgeClass="bg-success/20 text-success-muted" title={t("landing.flow.systemTitle")} text={t("landing.flow.systemDescription")} />
              <div className="flex justify-center">
                <ArrowRight className="h-4 w-4 rotate-90 text-muted-foreground" />
              </div>
              <FlowCard badge="D" badgeClass="bg-primary-light/35 text-primary" title={t("landing.flow.doctorTitle")} text={t("landing.flow.doctorDescription")} />
            </div>
          </div>
        </section>

        <section id="for-patients" className="scroll-offset-navbar grid gap-8 lg:grid-cols-2 items-center">
          <div className="relative h-80 md:h-115 rounded-3xl overflow-hidden border border-border/70 shadow-xl">
            <Image src={patientImg} alt={t("landing.cta.forPatients")} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-6">
              <p className="text-white text-sm md:text-base font-medium">
                {t("landing.sections.patientQuote")}
              </p>
            </div>
          </div>
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {t("landing.cta.forPatients")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.sections.forPatientsHeadline")}</h2>
            <ul className="space-y-3">
              <FeatureItem text={t("landing.patientFeatures.feature1")} />
              <FeatureItem text={t("landing.patientFeatures.feature2")} />
              <FeatureItem text={t("landing.patientFeatures.feature3")} />
              <FeatureItem text={t("landing.patientFeatures.feature4")} />
            </ul>
            <Button size="lg" asChild>
              <Link href={localeHref("/selection")}>{t("landing.cta.startPatient")}</Link>
            </Button>
          </div>
        </section>

        <section
          id="for-doctors"
          className="scroll-offset-navbar grid gap-8 lg:grid-cols-2 items-center rounded-3xl border border-border/70 bg-card/90 p-6 md:p-10"
        >
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              {t("landing.cta.forDoctors")}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.sections.forDoctorsHeadline")}</h2>
            <ul className="space-y-3">
              <FeatureItem text={t("landing.doctorFeatures.feature1")} />
              <FeatureItem text={t("landing.doctorFeatures.feature2")} />
              <FeatureItem text={t("landing.doctorFeatures.feature3")} />
              <FeatureItem text={t("landing.doctorFeatures.feature4")} />
            </ul>
            <Button size="lg" variant="secondary" asChild>
              <Link href={localeHref("/selection")}>{t("landing.cta.startDoctor")}</Link>
            </Button>
          </div>
          <div className="relative h-80 md:h-115 rounded-3xl overflow-hidden border border-border/70 shadow-xl">
            <Image src={doctorImg} alt={t("landing.cta.forDoctors")} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-6">
              <p className="text-white text-sm md:text-base font-medium">
                {t("landing.sections.doctorQuote")}
              </p>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-offset-navbar max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold">{t("landing.sections.aboutTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">
              {t("landing.sections.aboutDescription")}
            </p>
          </div>
          <Separator />
          <div id="privacy" className="grid gap-7 md:grid-cols-2">
            <InfoBlock
              icon={<Shield className="h-5 w-5 text-primary" />}
              title={t("landing.info.privacyTitle")}
              description={t("landing.info.privacyDescription")}
            />
            <InfoBlock
              icon={<TrendingUp className="h-5 w-5 text-primary" />}
              title={t("landing.info.futureTitle")}
              description={t("landing.info.futureDescription")}
            />
          </div>
        </section>

        <section className="rounded-3xl border border-primary/30 bg-linear-to-br from-primary to-primary-muted text-primary-foreground shadow-[0_24px_60px_-30px_rgba(3,96,217,0.9)]">
          <div className="px-6 py-10 md:px-10 md:py-14 text-center">
            <h2 className="text-2xl md:text-4xl font-bold tracking-tight">{t("landing.hero.title")}</h2>
            <p className="mt-3 text-primary-foreground/90 text-sm md:text-base">
              {t("landing.hero.subtitle")}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button size="lg" variant="secondary" className="px-8" asChild>
                <Link href={localeHref("/selection")}>{t("landing.hero.createPatient")}</Link>
              </Button>
              <Button
                size="lg"
                className="px-8 bg-primary-foreground/12 border border-primary-foreground/30 hover:bg-primary-foreground/18"
                asChild
              >
                <Link href={localeHref("/selection")}>{t("landing.hero.createDoctor")}</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-6 border-t border-border/70 bg-background/70">
        <div className="mx-auto max-w-7xl page-content py-10 md:py-12 grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <h3 className="text-lg font-bold">{t("landing.info.brandName")}</h3>
            <p className="text-sm text-muted-foreground">{t("landing.footer.tagline")}</p>
          </div>
          <FooterColumn title={t("landing.footer.platform")} links={[t("landing.footer.howItWorks"), t("landing.footer.forPatients"), t("landing.footer.forDoctors")]} />
          <FooterColumn title={t("landing.footer.legal")} links={[t("landing.footer.privacyPolicy"), t("landing.footer.terms")]} />
          <FooterColumn title={t("landing.footer.contact")} links={[t("landing.footer.support"), t("landing.footer.contactUs")]} />
        </div>
        <div className="border-t border-border/60 py-5 text-center text-sm text-muted-foreground">
          (c) {new Date().getFullYear()} Medora. {t("landing.footer.rights")}
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
