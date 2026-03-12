"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/lib/auth-actions";
import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";
import logo from "@/assets/image/medora-logo.png";

export function ForgotPasswordClient() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const images = [
    { src: doctorImg, alt: "Doctors Team", text: "Recover Your Account" },
    { src: patientImg, alt: "Patient Care", text: "Secure & Private" },
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
      const errorMessage = err instanceof Error ? err.message : "Failed to send reset email. Please try again.";
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
                  We&apos;ll help you get back to your account safely and securely.
                </p>
              </div>

              <div className="flex justify-center gap-2 pb-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${index === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/50"}`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-1/2 bg-card p-6 lg:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-8">
              <div className="flex flex-col items-center space-y-2 text-center">
                <div className="relative w-32 h-32">
                  <Image src={logo} alt="Medora Logo" fill className="object-contain" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Forgot Password?</h2>
                <p className="text-muted-foreground">Enter your email address and we&apos;ll send you a link to reset your password.</p>
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
                      <p className="text-sm font-medium">Email Sent Successfully!</p>
                      <p className="text-xs text-success-muted/80 mt-1">Check your inbox for the password reset link</p>
                    </div>
                  </div>

                  <div className="text-center text-sm text-foreground">
                    <Link href="/login" className="font-medium text-primary hover:underline flex items-center justify-center gap-2">
                      <ArrowLeft size={16} />
                      Back to Sign In
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full"
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                  </form>

                  <div className="text-center text-sm text-foreground">
                    <Link href="/login" className="font-medium text-primary hover:underline flex items-center justify-center gap-2">
                      <ArrowLeft size={16} />
                      Back to Sign In
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

