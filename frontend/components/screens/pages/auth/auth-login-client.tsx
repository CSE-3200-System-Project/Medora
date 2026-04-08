"use client";

import React, { lazy, Suspense, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { login } from "@/lib/auth-actions";
import { toast } from "@/lib/notify";
import { AppBackground } from "@/components/ui/app-background";

const AdminDialog = lazy(() => import("./admin-dialog"));

import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";
import medoraLogoDark from "@/assets/images/Medora-Logo-Dark.png";
import medoraLogoLight from "@/assets/images/Medora-Logo-Light.png";

const LOGIN_HERO_IMAGES = [
  { src: doctorImg, alt: "Doctors Team", text: "Welcome Back to Medora" },
  { src: patientImg, alt: "Patient Care", text: "Your Health, Our Priority" },
] as const;

function LoginPageContent({ initiallyVerified = false }: { initiallyVerified?: boolean }) {
  const { theme, systemTheme } = useTheme();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [showVerifiedMessage, setShowVerifiedMessage] = useState(initiallyVerified);
  const activeImage = LOGIN_HERO_IMAGES[currentImageIndex] ?? LOGIN_HERO_IMAGES[0];
  const isPrimaryHeroImage = currentImageIndex === 0;

  const currentTheme = theme === "system" ? systemTheme : theme;
  const medoraLogo = currentTheme === "dark" ? medoraLogoLight : medoraLogoDark;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDesktopViewport = window.matchMedia("(min-width: 1280px)").matches;

    if (prefersReducedMotion || !isDesktopViewport) {
      return;
    }

    const interval = window.setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % LOGIN_HERO_IMAGES.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!initiallyVerified) {
      return;
    }

    toast.success("Email verified successfully. You can now sign in.");
    const hideTimer = setTimeout(() => {
      setShowVerifiedMessage(false);
    }, 5000);

    return () => clearTimeout(hideTimer);
  }, [initiallyVerified]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await login(formData, rememberMe);
      if (result?.success === false) {
        setError(result.error || "Login failed. Please check your credentials.");
        toast.error(result.error || "Login failed. Please check your credentials.", {
          title: "Sign in failed",
        });
        setLoading(false);
        return;
      }
      // If redirect succeeds, Next throws NEXT_REDIRECT and navigation occurs.
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
      const message = err instanceof Error ? err.message : "Login failed. Please check your credentials.";
      setError(message);
      toast.error(message, { title: "Sign in failed" });
      setLoading(false);
    }
  };

  return (
    <AppBackground className="min-h-dvh min-h-app flex items-center justify-center px-4 py-6 sm:px-6 md:px-8 lg:px-10 xl:px-12 relative animate-page-enter">
      {/* Admin Access Button */}
      <button
        onClick={() => setShowAdminDialog(true)}
        className="fixed top-3 right-3 sm:top-4 sm:right-4 size-11 sm:size-12 flex items-center justify-center bg-linear-to-br from-background to-surface hover:from-surface hover:to-card rounded-full shadow-lg border border-border/50 transition-all hover:scale-105 group z-50"
        aria-label="Admin Access"
      >
        <Shield className="w-5 h-5 text-primary-light group-hover:text-primary transition-colors" />
      </button>

      <Card className="w-full max-w-md xl:max-w-7xl mx-auto overflow-hidden p-0 sm:p-0 gap-0 shadow-xl border-border">
        <div className="flex flex-col xl:flex-row min-h-[clamp(34rem,70vh,46rem)]">
          <div className="relative hidden xl:block w-full xl:w-1/2 h-60 sm:h-72 md:h-80 xl:h-auto bg-primary overflow-hidden shrink-0">
            <div className="absolute inset-0">
              <Image
                src={activeImage.src}
                alt={activeImage.alt}
                fill
                sizes="(max-width: 1279px) 1px, 50vw"
                className="object-cover"
                priority={isPrimaryHeroImage}
                loading={isPrimaryHeroImage ? "eager" : "lazy"}
                fetchPriority={isPrimaryHeroImage ? "high" : "low"}
                decoding="async"
              />
            </div>

            <div className="absolute top-0 left-0 w-full h-full bg-black/40"></div>

            <div className="relative z-10 h-full flex flex-col items-center text-white p-5 sm:p-6 md:p-8 xl:p-12 text-center">
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <h1 className="min-h-18 sm:min-h-21 text-2xl sm:text-3xl xl:text-4xl font-bold mb-3 sm:mb-4 leading-tight transition-none xl:transition-all xl:duration-500">
                  {activeImage.text}
                </h1>
                <p className="text-sm sm:text-base text-white/90 hidden md:block">
                  Access your dashboard, manage appointments, and stay connected with your healthcare journey.
                </p>
              </div>

              <div className="flex justify-center gap-2 pb-1 sm:pb-2">
                {LOGIN_HERO_IMAGES.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentImageIndex ? "w-8 bg-card" : "w-2 bg-card/50"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="w-full xl:w-1/2 bg-card p-5 sm:p-6 md:p-8 xl:p-10 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-6 sm:space-y-7">
              <div className="flex flex-col items-center space-y-2 text-center">
                <div className="relative hidden sm:block w-24 h-24 md:w-32 md:h-32">
                   <Image
                     src={medoraLogo}
                     alt="Medora Logo"
                     fill
                     sizes="128px"
                     className="object-contain"
                     priority
                     loading="eager"
                     fetchPriority="high"
                   />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Sign in to your account</h2>
                <p className="text-muted-foreground">
                  Enter your email and password to access your account
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
                    <p className="text-sm font-medium">Email Verified Successfully!</p>
                    <p className="text-xs text-success-muted/80 mt-1">You can now login to your account</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input name="email" id="email" type="email" placeholder="name@example.com" required className="w-full" />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
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
                    <Label htmlFor="remember" className="text-sm font-normal">Remember me</Label>
                  </div>
                  <Link 
                    href="/forgot-password" 
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              <div className="text-center text-sm text-foreground">
                New to Medora?{' '}
                <Link href="/selection" className="font-medium text-primary hover:underline">
                  Sign up here
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {showAdminDialog && (
        <Suspense fallback={null}>
          <AdminDialog open={showAdminDialog} onOpenChange={setShowAdminDialog} />
        </Suspense>
      )}
    </AppBackground>
  );
}

export default function LoginPage({ initiallyVerified = false }: { initiallyVerified?: boolean }) {
  return <LoginPageContent initiallyVerified={initiallyVerified} />;
}

