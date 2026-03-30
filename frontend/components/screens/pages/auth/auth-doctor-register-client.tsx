"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signupDoctor } from "@/lib/auth-actions";
import { AppBackground } from "@/components/ui/app-background";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";

// Import images
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";

export default function DoctorRegister() {
  const t = useTranslations("auth.doctorRegister");
  const locale = useLocale() as AppLocale;
  const localeHref = (path: string) => withLocale(path, locale);
  const [submitted, setSubmitted] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const images = [
    { src: doctorImg, alt: t("carousel.altDoctorsTeam"), text: t("carousel.textJoinNetwork") },
    { src: patientImg, alt: t("carousel.altPatientCare"), text: t("carousel.textProvideCare") }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    // Validate password match
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    
    if (password !== confirmPassword) {
      setError(t("errors.passwordsDoNotMatch"));
      setLoading(false);
      return;
    }

    try {
      const result = await signupDoctor(formData);
      
      if (result.success) {
        setSubmitted(true);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("errors.registrationFailed");
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AppBackground className="min-h-screen flex items-center justify-center p-4 animate-page-enter">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <CardTitle className="text-2xl">{t("success.title")}</CardTitle>
            <CardDescription>
              {t("success.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary/20 p-4 rounded-lg border border-secondary/50">
              <p className="text-sm text-secondary-foreground font-medium text-center">
                {t("success.verificationWindow")}
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t("success.verifyEmailPrompt")}
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href={localeHref("/verify-email")}>
              <Button>{t("success.verifyEmailButton")}</Button>
            </Link>
          </CardFooter>
        </Card>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="min-h-screen flex items-center justify-center p-6 md:px-10 py-10 lg:p-16 animate-page-enter">
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
                  className="object-cover"
                  priority={index === 0}
                />
              </div>
            ))}

            <div className="absolute top-0 left-0 w-full h-full bg-black/40"></div>
            
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-white p-6 md:p-12 text-center">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight transition-all duration-500">
                {images[currentImageIndex].text}
              </h1>
              <p className="text-sm sm:text-base text-white/90 mb-6 hidden sm:block">
                {t("carousel.description")}
              </p>
              
              <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 pb-2">
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
          <div className="w-full lg:w-1/2 bg-card p-6 lg:p-12">
            <div className="space-y-6">
              <div className="space-y-1 text-center lg:text-left">
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("form.firstName")}</Label>
                    <Input name="firstName" id="firstName" placeholder={t("form.firstNamePlaceholder")} required className="w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("form.lastName")}</Label>
                    <Input name="lastName" id="lastName" placeholder={t("form.lastNamePlaceholder")} required className="w-full" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t("form.email")}</Label>
                  <Input name="email" id="email" type="email" placeholder={t("form.emailPlaceholder")} required className="w-full" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">{t("form.phone")}</Label>
                  <Input name="phone" id="phone" type="tel" placeholder={t("form.phonePlaceholder")} required className="w-full" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bmdc">{t("form.bmdc")}</Label>
                  <div className="relative">
                    <Input name="bmdc" id="bmdc" className="w-full pl-16" placeholder={t("form.bmdcPlaceholder")} required />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-muted-foreground font-bold text-xs">BMDC</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document">{t("form.uploadDocument")}</Label>
                  <Input name="document" id="document" type="file" className="w-full cursor-pointer file:text-primary" />
                  <p className="text-xs text-muted-foreground">{t("form.uploadHint")}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">{t("form.password")}</Label>
                    <div className="relative">
                      <Input 
                        name="password"
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder={t("form.passwordPlaceholder")} 
                        required 
                        className="w-full pr-10"
                        minLength={6}
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
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">{t("form.confirmPassword")}</Label>
                    <div className="relative">
                      <Input 
                        name="confirmPassword"
                        id="confirmPassword" 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder={t("form.passwordPlaceholder")} 
                        required 
                        className="w-full pr-10"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox id="terms" required />
                  <Label htmlFor="terms" className="text-sm font-normal text-foreground">
                    {t("form.agreePrefix")} <Link href="#" className="font-medium text-primary hover:underline">{t("form.termsOfService")}</Link> {t("form.and")} <Link href="#" className="font-medium text-primary hover:underline">{t("form.privacyPolicy")}</Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full mt-4" disabled={loading}>
                  {loading ? t("form.submitting") : t("form.submitForVerification")}
                </Button>
              </form>

              <Separator />

              <div className="flex flex-col space-y-2 text-center">
                <div className="text-sm text-foreground">
                  {t("footer.alreadyHaveAccount")}{' '}
                  <Link href={localeHref("/login")} className="font-medium text-primary hover:underline">
                    {t("footer.signIn")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </AppBackground>
  );
}
