"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/auth-actions";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";
import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";

export function ForgotPasswordClient() {
  const t = useTranslations("auth.forgot");
  const locale = useLocale() as AppLocale;
  const localeHref = React.useCallback((path: string) => withLocale(path, locale), [locale]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const images = [
    { src: doctorImg, alt: t("carousel.altDoctor"), text: t("carousel.textRecover") },
    { src: patientImg, alt: t("carousel.altPatient"), text: t("carousel.textSecure") },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await forgotPassword(email);
      setSuccess(true);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("errors.sendFailed");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 md:p-6 lg:p-8 animate-page-enter">
      <Card className="w-full max-w-md lg:max-w-7xl mx-auto overflow-hidden p-0 gap-0 shadow-xl border-border">
        <div className="flex flex-col lg:flex-row min-h-150">
          <div className="relative w-full lg:w-1/2 h-64 lg:h-auto bg-primary overflow-hidden shrink-0">
            {images.map((img, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentImageIndex ? "opacity-100" : "opacity-0"}`}
              >
                <Image src={img.src} alt={img.alt} fill className="object-cover" priority={index === 0} />
              </div>
            ))}

            <div className="absolute top-0 left-0 w-full h-full bg-black/40" />

            <div className="relative z-10 h-full flex flex-col items-center text-white p-6 md:p-12 text-center">
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight transition-all duration-500">
                  {images[currentImageIndex].text}
                </h1>
                <p className="text-sm sm:text-base text-white/90 hidden sm:block">
                  {t("heroDescription")}
                </p>
              </div>

              <div className="flex justify-center gap-2 pb-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${index === currentImageIndex ? "w-8 bg-card" : "w-2 bg-card/50"}`}
                    aria-label={t("goToSlide", { number: index + 1 })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 bg-card p-6 lg:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-8">
              <div className="flex flex-col items-center space-y-2 text-center">
                <div className="relative w-32 h-32">
                  <Image src={medoraDarkLogo} alt={t("logoAlt")} fill className="object-contain dark:hidden" />
                  <Image src={medoraLightLogo} alt={t("logoAlt")} fill className="hidden object-contain dark:block" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                <p className="text-muted-foreground">{t("subtitle")}</p>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {success ? (
                <div className="space-y-6">
                  <div className="bg-success/10 border border-success/30 text-success-muted px-4 py-3 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t("success.title")}</p>
                      <p className="text-xs text-success-muted/80 mt-1">{t("success.description")}</p>
                    </div>
                  </div>

                  <div className="text-center text-sm text-foreground">
                    <Link href={localeHref("/login")} className="font-medium text-primary hover:underline flex items-center justify-center gap-2">
                      <ArrowLeft size={16} />
                      {t("backToSignIn")}
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("emailLabel")}</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t("emailPlaceholder")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? t("sending") : t("sendResetLink")}
                    </Button>
                  </form>

                  <div className="text-center text-sm text-foreground">
                    <Link href={localeHref("/login")} className="font-medium text-primary hover:underline flex items-center justify-center gap-2">
                      <ArrowLeft size={16} />
                      {t("backToSignIn")}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}


