"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@supabase/supabase-js";
import { resetPassword } from "@/lib/auth-actions";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";
import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

type PageState = "loading" | "form" | "success" | "error";

export function ResetPasswordClient() {
  const router = useRouter();
  const t = useTranslations("auth.reset");
  const locale = useLocale() as AppLocale;
  const localeHref = React.useCallback((path: string) => withLocale(path, locale), [locale]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [accessToken, setAccessToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(5);

  const images = [
    { src: doctorImg, alt: t("carousel.altDoctor"), text: t("carousel.textReset") },
    { src: patientImg, alt: t("carousel.altPatient"), text: t("carousel.textSecure") },
  ];

  // Image carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [images.length]);

  // Extract recovery session from URL hash on mount
  useEffect(() => {
    async function handleRecovery() {
      try {
        const hash = window.location.hash;
        if (!hash) {
          setPageState("error");
          setError(t("errors.noRecoveryToken"));
          return;
        }

        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("access_token");
        const type = params.get("type");

        if (type !== "recovery" || !token) {
          setPageState("error");
          setError(t("errors.invalidRecoveryLink"));
          return;
        }

        // Verify the token is valid by setting the session in Supabase client
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const refreshToken = params.get("refresh_token") || "";

        const { error: sessionError } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setPageState("error");
          setError(t("errors.linkExpired"));
          return;
        }

        setAccessToken(token);
        setPageState("form");
      } catch {
        setPageState("error");
        setError(t("errors.generic"));
      }
    }

    handleRecovery();
  }, [t]);

  // Success countdown redirect
  useEffect(() => {
    if (pageState !== "success") return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const timeout = setTimeout(() => {
      router.push(localeHref("/login"));
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [localeHref, pageState, router]);

  const validatePassword = (pw: string) => {
    if (pw.length < 8) return t("validation.minLength");
    if (!/[A-Z]/.test(pw)) return t("validation.uppercase");
    if (!/[a-z]/.test(pw)) return t("validation.lowercase");
    if (!/[0-9]/.test(pw)) return t("validation.number");
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setError(t("validation.passwordsDoNotMatch"));
      return;
    }

    setLoading(true);
    try {
      await resetPassword(accessToken, password);
      setPageState("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("errors.resetFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = () => {
    if (!password) return null;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) return { label: t("strength.weak"), color: "bg-destructive", width: "w-1/3" };
    if (strength <= 3) return { label: t("strength.fair"), color: "bg-yellow-500", width: "w-2/3" };
    return { label: t("strength.strong"), color: "bg-success", width: "w-full" };
  };

  const strength = passwordStrength();

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 md:p-6 lg:p-8 animate-page-enter">
      <Card className="w-full max-w-md lg:max-w-7xl mx-auto overflow-hidden p-0 gap-0 shadow-xl border-border">
        <div className="flex flex-col lg:flex-row min-h-150">
          {/* Left panel — image carousel */}
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

          {/* Right panel — form */}
          <div className="w-full lg:w-1/2 bg-card p-6 lg:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-8">
              <div className="flex flex-col items-center space-y-2 text-center">
                <div className="relative w-32 h-32">
                  <Image src={medoraDarkLogo} alt={t("logoAlt")} fill className="object-contain dark:hidden" />
                  <Image src={medoraLightLogo} alt={t("logoAlt")} fill className="hidden object-contain dark:block" />
                </div>

                {pageState === "loading" && (
                  <>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>{t("loading.verifying")}</span>
                    </div>
                  </>
                )}

                {pageState === "error" && (
                  <>
                    <div className="mx-auto mb-2 h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center">
                      <ShieldAlert className="h-9 w-9 text-destructive" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("errorState.title")}</h2>
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
                      <p className="text-sm">{error}</p>
                    </div>
                    <div className="pt-4 space-y-3 w-full">
                      <Link href={localeHref("/forgot-password")} className="block">
                        <Button className="w-full" variant="default">
                          {t("errorState.requestNewLink")}
                        </Button>
                      </Link>
                      <Link href={localeHref("/login")} className="block">
                        <Button className="w-full" variant="outline">
                          <ArrowLeft className="h-4 w-4 mr-2" />
                          {t("backToSignIn")}
                        </Button>
                      </Link>
                    </div>
                  </>
                )}

                {pageState === "form" && (
                  <>
                    <div className="mx-auto mb-2 h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <KeyRound className="h-9 w-9 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("formState.title")}</h2>
                    <p className="text-muted-foreground">
                      {t("formState.subtitle")}
                    </p>
                  </>
                )}

                {pageState === "success" && (
                  <>
                    <div className="mx-auto mb-2 h-16 w-16 bg-success/10 rounded-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
                      <CheckCircle2 className="h-9 w-9 text-success" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">{t("successState.title")}</h2>
                    <p className="text-muted-foreground">
                      {t("successState.subtitle")}
                    </p>
                  </>
                )}
              </div>

              {pageState === "form" && (
                <>
                  {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg">
                      <p className="text-sm">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">{t("form.newPassword")}</Label>
                      <div className="relative">
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("form.newPasswordPlaceholder")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {strength && (
                        <div className="space-y-1">
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${strength.color} ${strength.width} rounded-full transition-all duration-300`} />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {t("strength.label")}: <span className="font-medium">{strength.label}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">{t("form.confirmPassword")}</Label>
                      <div className="relative">
                        <Input
                          id="confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder={t("form.confirmPasswordPlaceholder")}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={8}
                          className="w-full pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-destructive">{t("validation.passwordsDoNotMatch")}</p>
                      )}
                    </div>

                    <div className="rounded-lg bg-accent/50 p-3 space-y-1">
                      <p className="text-xs font-medium text-foreground">{t("requirements.title")}</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        <li className={password.length >= 8 ? "text-success" : ""}>
                          {password.length >= 8 ? "\u2713" : "\u2022"} {t("requirements.minLength")}
                        </li>
                        <li className={/[A-Z]/.test(password) ? "text-success" : ""}>
                          {/[A-Z]/.test(password) ? "\u2713" : "\u2022"} {t("requirements.uppercase")}
                        </li>
                        <li className={/[a-z]/.test(password) ? "text-success" : ""}>
                          {/[a-z]/.test(password) ? "\u2713" : "\u2022"} {t("requirements.lowercase")}
                        </li>
                        <li className={/[0-9]/.test(password) ? "text-success" : ""}>
                          {/[0-9]/.test(password) ? "\u2713" : "\u2022"} {t("requirements.number")}
                        </li>
                      </ul>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("form.resetting")}
                        </>
                      ) : (
                        t("form.submit")
                      )}
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

              {pageState === "success" && (
                <div className="space-y-6">
                  <div className="bg-success/10 border border-success/30 text-success-muted px-4 py-3 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{t("successState.updatedTitle")}</p>
                      <p className="text-xs text-success-muted/80 mt-1">
                        {t("successState.updatedDescription")}
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground text-center">
                    {t("successState.redirectingPrefix")} <span className="font-semibold text-primary">{countdown}</span>{" "}
                    {countdown === 1 ? t("successState.second") : t("successState.seconds")}...
                  </p>

                  <Link href={localeHref("/login")} className="block">
                    <Button className="w-full" variant="medical" size="lg">
                      {t("successState.continueToLogin")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
