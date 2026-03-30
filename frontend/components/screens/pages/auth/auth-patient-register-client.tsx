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
import { signupPatient } from "@/lib/auth-actions";
import { AppBackground } from "@/components/ui/app-background";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";

// Import images
import doctorImg from "@/assets/images/doctors.jpg";
import patientImg from "@/assets/images/patient.jpg";

export default function PatientRegister() {
  const t = useTranslations("auth.patientRegister");
  const locale = useLocale() as AppLocale;
  const localeHref = (path: string) => withLocale(path, locale);
  const [submitted, setSubmitted] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  const images = [
    { src: patientImg, alt: t("carousel.altPatientCare"), text: t("carousel.textFindCare") },
    { src: doctorImg, alt: t("carousel.altExpertDoctors"), text: t("carousel.textTopSpecialists") }
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
      const result = await signupPatient(formData);
      
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

  const inputStyles = "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive";

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
            
            <div className="relative z-10 h-full flex flex-col items-center text-white p-6 md:p-12 text-center">
              <div className="flex-1 flex flex-col items-center justify-center w-full">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 leading-tight transition-all duration-500">
                  {images[currentImageIndex].text}
                </h1>
                <p className="text-sm sm:text-base text-white/90 mb-6 hidden sm:block">
                  {t("carousel.description")}
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
                  <Label htmlFor="dob">{t("form.dob")}</Label>
                  <Input name="dob" id="dob" type="date" required className="w-full block" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">{t("form.gender")}</Label>
                    <select 
                      name="gender"
                      id="gender" 
                      className={inputStyles}
                      required
                      defaultValue=""
                    >
                      <option value="" disabled>{t("form.selectGender")}</option>
                      <option value="male">{t("form.genderMale")}</option>
                      <option value="female">{t("form.genderFemale")}</option>
                      <option value="other">{t("form.genderOther")}</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bloodGroup">{t("form.bloodGroupOptional")}</Label>
                    <select 
                      name="bloodGroup"
                      id="bloodGroup" 
                      className={inputStyles}
                      defaultValue=""
                    >
                      <option value="">{t("form.selectBloodGroup")}</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
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
                  {loading ? t("form.creating") : t("form.createAccount")}
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
