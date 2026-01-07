"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Mail, RefreshCw, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-actions";

// Import images - reusing the same ones for consistency
import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";
import logo from "@/assets/image/medora-logo.png";

export default function VerifyEmailPage() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  
  const images = [
    { src: doctorImg, alt: "Doctors Team", text: "Verify Your Identity" },
    { src: patientImg, alt: "Patient Care", text: "Secure Your Account" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images.length]);

  // Polling for verification status
  useEffect(() => {
    let isMounted = true;
    const pollInterval = setInterval(async () => {
      try {
        const user = await getCurrentUser();
        if (isMounted && user) {
          // Check if email is verified
          if (user.email_verified || user.verification_status === "verified") {
            clearInterval(pollInterval);
            
            const role = user.role?.toLowerCase() || 'patient';
            // Redirect logic
            if (!user.onboarding_completed) {
              router.push(`/onboarding/${role}`);
            } else {
              router.push(role === 'doctor' ? '/doctor/home' : '/patient/home');
            }
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 3000); // Check every 3 seconds

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [router]);

  const checkVerification = async () => {
    setLoading(true);
    try {
      const user = await getCurrentUser();
      
      if (user && (user.email_verified || user.verification_status === "verified")) {
        const role = user.role?.toLowerCase() || 'patient';
        if (!user.onboarding_completed) {
          router.push(`/onboarding/${role}`);
        } else {
          router.push(role === 'doctor' ? '/doctor/home' : '/patient/home');
        }
      } else {
        setMessage("Email not verified yet. Please check your inbox.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Error checking verification status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-6 md:px-10 py-10 lg:p-16">
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
                  Please verify your email address to access all features of Medora.
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

          {/* Right Side - Content */}
          <div className="w-full lg:w-1/2 bg-card p-8 lg:p-12 flex flex-col justify-center">
            <div className="w-full max-w-md mx-auto space-y-8">
              <div className="flex flex-col items-center space-y-2 text-center">
                <div className="relative w-24 h-24 mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                   <Mail className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Check your email</h2>
                <p className="text-muted-foreground">
                  We've sent a verification link to your email address.
                </p>
              </div>

              {message && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-center">
                  <p className="text-sm">{message}</p>
                </div>
              )}

              <div className="space-y-4">
                <Button 
                  onClick={checkVerification} 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    "I've Verified My Email"
                  )}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  <p>Didn't receive the email? Check your spam folder.</p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col space-y-2 text-center">
                <Link href="/login" className="text-sm font-medium text-primary hover:underline flex items-center justify-center">
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
