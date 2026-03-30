"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { login, getCurrentUser } from "@/lib/auth-actions";
import { setAdminAccess } from "@/lib/admin-actions";
import { toast } from "@/lib/notify";
import { AppBackground } from "@/components/ui/app-background";
import { FormSkeleton } from "@/components/ui/skeleton-loaders";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";

import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";
import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";

function LoginPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations("auth.login");
  const locale = useLocale() as AppLocale;
  const localeHref = React.useCallback((path: string) => withLocale(path, locale), [locale]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showVerifiedMessage, setShowVerifiedMessage] = useState(searchParams.get("verified") === "true");
  
  const images = [
    { src: doctorImg, alt: t("carousel.altDoctor"), text: t("carousel.textWelcome") },
    { src: patientImg, alt: t("carousel.altPatient"), text: t("carousel.textPriority") }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    const verified = searchParams.get("verified") === "true";
    if (verified) {
      toast.success(t("toasts.emailVerified"));
      const hideTimer = setTimeout(() => {
        setShowVerifiedMessage(false);
      }, 5000);

      return () => clearTimeout(hideTimer);
    }
  }, [searchParams, t]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          const role = user.role.toLowerCase();
          if (role === 'doctor') {
            router.push(localeHref('/doctor/home'));
          } else if (!user.onboarding_completed) {
            router.push(localeHref(`/onboarding/${role}`));
          } else {
            router.push(localeHref('/patient/home'));
          }
        }
      } catch {
        // Ignore error, just stay on login page
      }
    };
    checkSession();
  }, [localeHref, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      await login(formData, rememberMe);
      // If we reach here, login was successful and redirect happened
    } catch (err: unknown) {
      // Don't show NEXT_REDIRECT errors to user - these are internal Next.js redirects
      if (
        err instanceof Error &&
        (err.message === "NEXT_REDIRECT" ||
          (typeof (err as Error & { digest?: string }).digest === "string" &&
            (err as Error & { digest?: string }).digest?.startsWith("NEXT_REDIRECT")))
      ) {
        // Redirect is happening, don't show error
        return;
      }
      const message = err instanceof Error ? err.message : t("errors.loginFailed");
      setError(message);
      toast.error(message, { title: t("toasts.signInFailedTitle") });
      setLoading(false);
    }
  };

  const handleAdminAccess = async () => {
    setAdminError("");
    try {
      const result = await setAdminAccess(adminPassword);
      if (result.success) {
        setShowAdminDialog(false);
        setAdminPassword("");
        router.replace(localeHref("/admin"));
      } else {
        const message = result.error || t("adminDialog.errors.incorrectPasskey");
        setAdminError(message);
        toast.error(message);
      }
    } catch {
      setAdminError(t("adminDialog.errors.failedAuth"));
      toast.error(t("adminDialog.errors.failedAuth"));
    }
  };

  return (
    <AppBackground className="min-h-screen flex items-center justify-center p-6 md:px-10 py-10 lg:p-16 relative animate-page-enter">
      {/* Admin Access Button */}
      <button
        onClick={() => setShowAdminDialog(true)}
        className="fixed top-4 right-4 p-3 bg-linear-to-br from-background to-surface hover:from-surface hover:to-card rounded-full shadow-lg border border-border/50 transition-all hover:scale-105 group z-50"
        aria-label={t("adminAccessButton")}
      >
        <Shield className="w-5 h-5 text-primary-light group-hover:text-primary transition-colors" />
      </button>

      <Card className="w-full max-w-md lg:max-w-7xl mx-auto overflow-hidden p-0 gap-0 shadow-xl border-border">
        <div className="flex flex-col lg:flex-row min-h-150">
          {/* Left Side - Hero/Image */}
          <div className="relative w-full lg:w-1/2 h-64 lg:h-auto bg-primary overflow-hidden shrink-0">
            {images.map((img, index) => (
              <div 
                key={index}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  index === currentImageIndex ? "opacity-100" : "opacity-0"
                }`}
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority={index === 0}
                  loading={index === 0 ? "eager" : undefined}
                />
              </div>
            ))}

            <div className="absolute top-0 left-0 w-full h-full bg-black/40"></div>
            
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
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentImageIndex ? "w-8 bg-card" : "w-2 bg-card/50"
                    }`}
                    aria-label={t("goToSlide", { number: index + 1 })}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="w-full lg:w-1/2 bg-card p-8 lg:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-8">
              <div className="flex flex-col items-center space-y-2 text-center">
                <div className="relative w-32 h-32">
                   <Image src={medoraDarkLogo} alt={t("logoAlt")} fill sizes="128px" className="object-contain dark:hidden" />
                   <Image src={medoraLightLogo} alt={t("logoAlt")} fill sizes="128px" className="hidden object-contain dark:block" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
                <p className="text-muted-foreground">
                  {t("subtitle")}
                </p>
              </div>

              {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
                  <p className="text-sm">{error}</p>
                </div>
              )}

              {showVerifiedMessage && (
                <div className="bg-success/10 border border-success/30 text-success-muted px-4 py-3 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t("verifiedBanner.title")}</p>
                    <p className="text-xs text-success-muted/80 mt-1">{t("verifiedBanner.description")}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("form.emailLabel")}</Label>
                  <Input name="email" id="email" type="email" placeholder={t("form.emailPlaceholder")} required className="w-full" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t("form.passwordLabel")}</Label>
                  </div>
                  <div className="relative">
                    <Input 
                      name="password"
                      id="password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      required 
                      className="w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" checked={rememberMe} onCheckedChange={(checked) => setRememberMe(Boolean(checked))} />
                    <Label htmlFor="remember" className="text-sm font-normal">{t("form.rememberMe")}</Label>
                  </div>
                  <Link 
                    href={localeHref("/forgot-password")} 
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {t("form.forgotPassword")}
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t("form.signingIn") : t("form.signIn")}
                </Button>
              </form>

              <div className="text-center text-sm text-foreground">
                {t("newToMedora")} {" "}
                <Link href={localeHref("/selection")} className="font-medium text-primary hover:underline">
                  {t("signUpHere")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Admin Access Dialog */}
      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent className="bg-linear-to-br from-background via-surface to-background border-border text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Shield className="h-6 w-6 text-primary-light" />
              </div>
              {t("adminDialog.title")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("adminDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-muted-foreground">
                {t("adminDialog.passkeyLabel")}
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  setAdminError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAdminAccess();
                  }
                }}
                placeholder={t("adminDialog.passkeyPlaceholder")}
                className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
                autoFocus
              />
              {adminError && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <span className="inline-block w-1 h-1 bg-red-400 rounded-full"></span>
                  {adminError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAdminDialog(false);
                setAdminPassword("");
                setAdminError("");
              }}
              className="border-border text-muted-foreground hover:bg-card hover:text-foreground"
            >
              {t("adminDialog.cancel")}
            </Button>
            <Button
              onClick={handleAdminAccess}
              className="bg-linear-to-r from-primary to-primary-muted hover:from-primary-muted hover:to-primary shadow-lg shadow-primary/20"
            >
              {t("adminDialog.enterPanel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AppBackground className="min-h-dvh min-h-app flex items-center justify-center p-4 md:p-6 lg:p-8">
          <FormSkeleton className="w-full max-w-md" />
        </AppBackground>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

