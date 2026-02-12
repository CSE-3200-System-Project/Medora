"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
import { AppBackground } from "@/components/ui/app-background";

import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";
import logo from "@/assets/image/medora-logo.png";

function LoginPageContent() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdminDialog, setShowAdminDialog] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [showVerifiedMessage, setShowVerifiedMessage] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const images = [
    { src: doctorImg, alt: "Doctors Team", text: "Welcome Back to Medora" },
    { src: patientImg, alt: "Patient Care", text: "Your Health, Our Priority" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  useEffect(() => {
    // Check if user was redirected from email verification
    const verified = searchParams.get('verified');
    if (verified === 'true') {
      setShowVerifiedMessage(true);
      // Hide message after 5 seconds
      setTimeout(() => {
        setShowVerifiedMessage(false);
      }, 5000);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          const role = user.role.toLowerCase();
          // Check if onboarding is completed
          if (user.onboarding_completed) {
            router.push(role === 'doctor' ? '/doctor/home' : '/patient/home');
          } else {
            router.push(`/onboarding/${role}`);
          }
        }
      } catch (e) {
        // Ignore error, just stay on login page
      }
    };
    checkSession();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const rememberMe = (e.currentTarget.querySelector('#remember') as HTMLInputElement)?.checked || false;

    try {
      await login(formData, rememberMe);
      // If we reach here, login was successful and redirect happened
    } catch (err: any) {
      // Don't show NEXT_REDIRECT errors to user - these are internal Next.js redirects
      if (err.message === "NEXT_REDIRECT" || err.digest?.startsWith("NEXT_REDIRECT")) {
        // Redirect is happening, don't show error
        return;
      }
      setError(err.message || "Login failed. Please check your credentials.");
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
        // Use window.location for hard navigation to ensure middleware sees the cookies
        window.location.href = "/admin";
      } else {
        setAdminError(result.error || "Incorrect admin password");
      }
    } catch (err) {
      setAdminError("Failed to authenticate");
    }
  };

  return (
    <AppBackground className="min-h-screen flex items-center justify-center p-6 md:px-10 py-10 lg:p-16 relative animate-page-enter">
      {/* Admin Access Button */}
      <button
        onClick={() => setShowAdminDialog(true)}
        className="fixed top-4 right-4 p-3 bg-gradient-to-br from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 rounded-full shadow-lg border border-slate-700/50 transition-all hover:scale-105 group z-50"
        aria-label="Admin Access"
      >
        <Shield className="w-5 h-5 text-primary-light group-hover:text-primary transition-colors" />
      </button>

      <Card className="w-full max-w-7xl overflow-hidden p-0 gap-0 shadow-xl border-border">
        <div className="flex flex-col lg:flex-row min-h-[600px]">
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
                <p className="text-sm sm:text-base text-white/90 hidden sm:block">
                  Access your dashboard, manage appointments, and stay connected with your healthcare journey.
                </p>
              </div>
              
              <div className="flex justify-center gap-2 pb-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/50"
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
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
                   <Image src={logo} alt="Medora Logo" fill className="object-contain" />
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
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email Verified Successfully!</p>
                    <p className="text-xs text-success-muted/80 mt-1">You can now login to your account</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input name="email" id="email" type="email" placeholder="name@example.com" required />
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
                      className="pr-10"
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
                    <Checkbox id="remember" />
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

      {/* Admin Access Dialog */}
      <Dialog open={showAdminDialog} onOpenChange={setShowAdminDialog}>
        <DialogContent className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-primary/20 rounded-lg">
                <Shield className="h-6 w-6 text-primary-light" />
              </div>
              Access Verification
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              To access the admin panel, please enter the passkey.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-slate-300">
                Admin Passkey
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
                placeholder="Enter admin passkey"
                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-primary"
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
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAdminAccess}
              className="bg-gradient-to-r from-primary to-primary-muted hover:from-primary-muted hover:to-primary shadow-lg shadow-primary/20"
            >
              Enter admin panel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppBackground>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AppBackground className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-primary">Loading...</div></AppBackground>}>
      <LoginPageContent />
    </Suspense>
  );
}