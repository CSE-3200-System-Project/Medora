"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Import images
import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";

export default function DoctorRegister() {
  const [submitted, setSubmitted] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const images = [
    { src: doctorImg, alt: "Doctors Team", text: "Join Our Network of Specialists" },
    { src: patientImg, alt: "Patient Care", text: "Provide Better Care to Patients" }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Add your backend registration logic here
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Application Submitted</CardTitle>
            <CardDescription>
              Thank you for registering. Your BM&DC number is under review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-secondary/20 p-4 rounded-lg border border-secondary/50">
              <p className="text-sm text-secondary-foreground font-medium text-center">
                Verification usually takes 24-48 hours.
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              We will notify you via email once your account is verified.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/">
              <Button variant="link">Back to Home</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row w-full min-h-screen bg-surface lg:h-screen lg:overflow-hidden">
      {/* Left Side - Hero */}
      <div className="relative w-full lg:w-1/2 h-72 sm:h-96 lg:h-full bg-primary overflow-hidden shrink-0">
        {/* Background Images with Fade Transition */}
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

        {/* Dark overlay for text readability */}
        <div className="absolute top-0 left-0 w-full h-full bg-black/40"></div>
        
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-white max-w-lg mx-auto p-6 md:p-12 text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-5xl font-bold mb-4 lg:mb-6 leading-tight transition-all duration-500">
            {images[currentImageIndex].text}
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-white/90 mb-6 lg:mb-8 hidden sm:block">
            Connect with millions of patients, manage your appointments efficiently, and grow your practice.
          </p>
          
          {/* Carousel Indicators */}
          <div className="flex justify-center gap-2 mt-auto sm:mt-8 pb-4 sm:pb-0">
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
      <div className="w-full lg:w-1/2 bg-surface lg:overflow-y-auto lg:h-full">
        <div className="min-h-full flex items-center justify-center p-4 md:p-8 py-8 lg:py-0">
          <Card className="w-full max-w-2xl border border-border shadow-xl bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-3xl font-bold text-foreground">Doctor Registration</CardTitle>
            <CardDescription>
              Enter your professional details to get verified.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="John" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Doe" required />
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" placeholder="doctor@example.com" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" type="tel" placeholder="+880 1XXX XXXXXX" required />
              </div>

              {/* Professional Info */}
              <div className="space-y-2">
                <Label htmlFor="bmdc">BM&DC Registration Number</Label>
                <div className="relative">
                  <Input id="bmdc" className="pl-16" placeholder="A-12345" required />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-muted-foreground font-bold text-xs">BMDC</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document">Upload Document (BM&DC Certificate)</Label>
                <Input id="document" type="file" className="cursor-pointer file:text-primary" required />
                <p className="text-xs text-muted-foreground">Please upload a clear scan of your registration certificate.</p>
              </div>

              {/* Security */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input 
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input 
                      id="confirmPassword" 
                      type={showConfirmPassword ? "text" : "password"} 
                      placeholder="••••••••" 
                      required 
                      className="pr-10"
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

              {/* Terms */}
              <div className="flex items-center space-x-2">
                <Checkbox id="terms" required />
                <Label htmlFor="terms" className="font-normal text-foreground">
                  I agree to the <Link href="#" className="text-primary hover:underline">Terms of Service</Link> and <Link href="#" className="text-primary hover:underline">Privacy Policy</Link>
                </Label>
              </div>

              <Button type="submit" className="w-full">Submit for Verification</Button>
            </form>
          </CardContent>
          
          <div className="px-6">
            <Separator className="my-4" />
          </div>

          <CardFooter className="flex flex-col space-y-4 text-center">
            <div className="text-sm text-foreground">
              Already have an account?{' '}
              <Link href="/doctor/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </div>
            <div className="text-sm">
              <Link href="/forgot-password" className="text-foreground hover:text-primary transition-colors">
                Forgot password?
              </Link>
            </div>
          </CardFooter>
        </Card>
        </div>
      </div>
    </div>
  );
}