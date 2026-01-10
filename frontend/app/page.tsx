"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowRight, 
  Activity, 
  FileText, 
  Users, 
  Shield, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";

export default function Home() {
  const [currentHero, setCurrentHero] = useState<'patient' | 'doctor'>('patient');
  const router = useRouter();

  // Check if user is logged in and redirect them to their home page
  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const user = await response.json();
          if (user && user.role) {
            const role = user.role.toLowerCase();
            if (role === 'admin') {
              router.push('/admin');
            } else if (role === 'doctor') {
              router.push('/doctor/home');
            } else {
              router.push('/patient/home');
            }
          }
        }
      } catch (error) {
        // User not logged in, stay on landing page
      }
    }
    checkAuthAndRedirect();
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHero(prev => prev === 'patient' ? 'doctor' : 'patient');
    }, 6000); // Switch every 6 seconds

    return () => clearInterval(interval);
  }, []);

  const toggleHero = () => {
    setCurrentHero(prev => prev === 'patient' ? 'doctor' : 'patient');
  };
  return (
    <div className="min-h-screen bg-surface font-sans text-foreground">
      <Navbar />
      
      <main className="pt-24 pb-8 md:pt-28 md:pb-10">
        {/* 2. HERO SECTION (SLIDESHOW) */}
        <section className="w-[calc(100%-2rem)] max-w-7xl mx-auto mb-12 md:mb-16">
          <div className="relative overflow-hidden rounded-2xl md:rounded-3xl shadow-xl border border-border bg-white min-h-[550px] md:min-h-[600px] flex items-center">
            
            {/* Navigation Buttons */}
            <button 
              onClick={toggleHero}
              className="absolute left-4 z-20 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-all hidden md:block"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-6 w-6 text-foreground" />
            </button>
            <button 
              onClick={toggleHero}
              className="absolute right-4 z-20 p-2 rounded-full bg-white/80 hover:bg-white shadow-md transition-all hidden md:block"
              aria-label="Next slide"
            >
              <ChevronRight className="h-6 w-6 text-foreground" />
            </button>

            {/* HERO A: PATIENT SIDE */}
            <div 
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out flex flex-col lg:flex-row ${
                currentHero === 'patient' ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <div className="flex-1 flex flex-col justify-center p-6 md:p-12 lg:p-16 bg-blue-50/50 lg:border-r border-border order-2 lg:order-1">
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    For Patients
                  </div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                    Take control of your health — <br className="hidden md:block"/>
                    <span className="text-primary">clearly, safely, and over time</span>
                  </h1>
                  <p className="text-base md:text-lg text-muted-foreground max-w-md">
                    Keep your medical information organized, track conditions and medications, and share accurate context with doctors when needed.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2">
                    <Button size="lg" className="w-full sm:w-auto" asChild>
                      <Link href="/selection">Create Patient Account</Link>
                    </Button>
                    <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                      <Link href="#how-it-works">Explore how it works</Link>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative h-56 md:h-64 lg:h-auto bg-gray-100 order-1 lg:order-2">
                 <Image 
                  src={patientImg} 
                  alt="Patient using app" 
                  fill 
                  className="object-cover"
                  priority
                />
              </div>
            </div>

            {/* HERO B: DOCTOR SIDE */}
            <div 
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out flex flex-col lg:flex-row ${
                currentHero === 'doctor' ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <div className="flex-1 flex flex-col justify-center p-6 md:p-12 lg:p-16 bg-white order-2 lg:order-1">
                <div className="space-y-4 md:space-y-6">
                  <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
                    For Doctors
                  </div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                    Practice with context, <br className="hidden md:block"/>
                    <span className="text-primary-muted">not fragmented information</span>
                  </h1>
                  <p className="text-base md:text-lg text-muted-foreground max-w-md">
                    Access structured patient histories, reduce repeated explanations, and support better clinical decisions — with optional intelligent assistance.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 md:gap-4 pt-2">
                    <Button size="lg" variant="secondary" className="w-full sm:w-auto" asChild>
                      <Link href="/selection">Create Doctor Account</Link>
                    </Button>
                    <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
                      <Link href="#for-doctors">See doctor features</Link>
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative h-56 md:h-64 lg:h-auto bg-gray-100 order-1 lg:order-2">
                <Image 
                  src={doctorImg} 
                  alt="Doctor reviewing records" 
                  fill 
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Shared Hero Footer */}
          <div className="text-center mt-8">
            <p className="text-lg font-medium text-muted-foreground">
              One platform. Shared understanding. Better care.
            </p>
            {/* Slide Indicators */}
            <div className="flex justify-center gap-2 mt-4">
              <button 
                onClick={() => setCurrentHero('patient')}
                className={`h-2 rounded-full transition-all duration-300 ${currentHero === 'patient' ? 'w-8 bg-primary' : 'w-2 bg-primary/30'}`}
                aria-label="Show Patient Slide"
              />
              <button 
                onClick={() => setCurrentHero('doctor')}
                className={`h-2 rounded-full transition-all duration-300 ${currentHero === 'doctor' ? 'w-8 bg-primary' : 'w-2 bg-primary/30'}`}
                aria-label="Show Doctor Slide"
              />
            </div>
          </div>
        </section>

        {/* 3. PLATFORM PILLARS */}
        <section className="w-[calc(100%-2rem)] max-w-7xl mx-auto py-12 md:py-16">
          <div className="text-center mb-8 md:mb-12 space-y-4">
            <h2 className="text-3xl font-bold tracking-tight">A healthcare platform built around medical context</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We replace fragmented records with a unified system that works for everyone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <PillarCard 
              icon={<FileText className="h-8 w-8 text-primary" />}
              title="Structured Health Profiles"
              description="Manual-first data entry ensures clear, editable information built for long-term use."
            />
            <PillarCard 
              icon={<Clock className="h-8 w-8 text-primary" />}
              title="Longitudinal History"
              description="Conditions, medications, tests, and visits organized over time. No scattered records."
            />
            <PillarCard 
              icon={<Users className="h-8 w-8 text-primary" />}
              title="Doctor–Patient Collaboration"
              description="Shared understanding leads to less repetition and better conversations."
            />
            <PillarCard 
              icon={<Activity className="h-8 w-8 text-primary" />}
              title="Intelligent Assistance"
              description="Optional reminders, summaries, and alerts. Never forced, always explainable."
            />
          </div>
        </section>

        {/* 4. HOW THE PLATFORM WORKS */}
        <section id="how-it-works" className="w-[calc(100%-2rem)] max-w-7xl mx-auto bg-white py-12 md:py-20 rounded-3xl border border-border scroll-mt-24 my-12 md:my-24 shadow-sm">
          <div className="px-4 md:px-12">
            <div className="flex flex-col lg:flex-row gap-8 md:gap-12 items-center">
              <div className="lg:w-1/2 space-y-6 md:space-y-8">
                <h2 className="text-3xl font-bold">How it works</h2>
                <p className="text-xl text-muted-foreground">
                  The platform adapts to real workflows — not the other way around.
                </p>
                
                <div className="space-y-6">
                  <Step number="1" title="Join as a patient or doctor" desc="Create your secure account in seconds." />
                  <Step number="2" title="Add essential information" desc="Manually input your core health data in minutes." />
                  <Step number="3" title="Upload documents (Optional)" desc="Digitize your paper records to save time." />
                  <Step number="4" title="Manage care better" desc="Use shared context for better decisions." />
                </div>
              </div>
              <div className="lg:w-1/2 bg-surface rounded-2xl md:rounded-3xl p-6 md:p-8 lg:p-12 border border-border/50 shadow-sm">
                {/* Abstract Visual Representation of Flow */}
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-primary font-bold">P</div>
                    <div>
                      <div className="font-semibold">Patient updates profile</div>
                      <div className="text-xs text-muted-foreground">Added new medication</div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="rotate-90 text-muted-foreground" />
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">S</div>
                    <div>
                      <div className="font-semibold">System organizes data</div>
                      <div className="text-xs text-muted-foreground">Timeline updated</div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <ArrowRight className="rotate-90 text-muted-foreground" />
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">D</div>
                    <div>
                      <div className="font-semibold">Doctor reviews context</div>
                      <div className="text-xs text-muted-foreground">Better consultation</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. PATIENT EXPERIENCE */}
        <section id="for-patients" className="w-[calc(100%-2rem)] max-w-7xl mx-auto px-6 md:px-12 py-12 md:py-20 scroll-mt-24 my-12 md:my-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="order-2 lg:order-1 relative h-[350px] md:h-[500px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl">
               <Image 
                  src={patientImg} 
                  alt="Patient Experience" 
                  fill 
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-8">
                  <p className="text-white font-medium text-lg">"Finally, I don't have to repeat my history to every new doctor."</p>
                </div>
            </div>
            <div className="order-1 lg:order-2 space-y-8">
              <div className="inline-block rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-primary">
                For Patients
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">What Patients Actually Get</h2>
              <ul className="space-y-4">
                <FeatureItem text="One place for medical information" />
                <FeatureItem text="Easy tracking of conditions and medicines" />
                <FeatureItem text="Smart reminders and updates" />
                <FeatureItem text="Control over what doctors see" />
                <FeatureItem text="Optional document uploads, never required" />
              </ul>
              <Button size="lg" className="mt-4" asChild>
                <Link href="/selection">Start as a Patient</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 6. DOCTOR EXPERIENCE */}
        <section id="for-doctors" className="w-[calc(100%-2rem)] max-w-7xl mx-auto bg-slate-50 py-12 md:py-20 rounded-3xl border border-border scroll-mt-24 my-12 md:my-24 shadow-sm">
          <div className="px-4 md:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16 items-center">
              <div className="space-y-6 md:space-y-8">
                <div className="inline-block rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                  For Doctors
                </div>
                <h2 className="text-3xl md:text-4xl font-bold">What Doctors Actually Get</h2>
                <ul className="space-y-4">
                  <FeatureItem text="Structured patient context before consultations" />
                  <FeatureItem text="Reduced cognitive load" />
                  <FeatureItem text="Better continuity across visits" />
                  <FeatureItem text="Configurable AI assistance" />
                  <FeatureItem text="Optional verification and credential uploads" />
                </ul>
                <Button size="lg" variant="secondary" className="mt-4" asChild>
                  <Link href="/selection">Start as a Doctor</Link>
                </Button>
              </div>
              <div className="relative h-[350px] md:h-[500px] rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl border border-border">
                 <Image 
                  src={doctorImg} 
                  alt="Doctor Experience" 
                  fill 
                  className="object-cover"
                />
                 <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent flex items-end p-8">
                  <p className="text-white font-medium text-lg">"I can focus on the patient, not on hunting for information."</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 7, 8, 9. TEXT SECTIONS */}
        <section id="about" className="w-[calc(100%-2rem)] max-w-4xl mx-auto px-6 md:px-12 py-12 md:py-20 space-y-12 md:space-y-20 scroll-mt-24 my-12 md:my-24">
          
          {/* Why This Platform Exists */}
          <div className="text-center space-y-4 md:space-y-6">
            <h2 className="text-3xl font-bold">Why this platform exists</h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Healthcare is not transactional. Context matters more than speed. Continuity reduces errors, and structure improves care quality. 
              We believe technology should support judgment, not replace it.
            </p>
          </div>

          <Separator />

          {/* Privacy */}
          <div id="privacy" className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 scroll-mt-24">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <Shield className="h-6 w-6" />
                <h3 className="text-xl font-bold">Privacy, Control & Responsibility</h3>
              </div>
              <p className="text-muted-foreground">
                Your data is user-owned. We ensure clear consent, role-based access, and manual overrides are always available. 
                There is no hidden automation.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary">
                <TrendingUp className="h-6 w-6" />
                <h3 className="text-xl font-bold">Future-Ready, Not Hype-Driven</h3>
              </div>
              <p className="text-muted-foreground">
                Built for progress tracking, smart reminders, and decision support with a research-ready architecture. 
                We focus on utility, not buzzwords.
              </p>
            </div>
          </div>
        </section>

        {/* 10. FINAL CTA */}
        <section className="w-[calc(100%-2rem)] max-w-7xl mx-auto bg-primary text-primary-foreground py-12 md:py-20 mt-12 md:mt-24 rounded-3xl shadow-xl">
          <div className="max-w-4xl mx-auto px-4 md:px-6 text-center space-y-6 md:space-y-8">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold">Build better care with shared context</h2>
            <div className="flex flex-col sm:flex-row justify-center gap-4 md:gap-6">
              <Button size="lg" variant="secondary" className="text-lg px-8 py-6 h-auto w-full sm:w-auto" asChild>
                <Link href="/selection">Create Patient Account</Link>
              </Button>
              <Button size="lg" className="text-lg px-8 py-6 h-auto w-full sm:w-auto bg-white/10 hover:bg-white/20 border border-white/20" asChild>
                <Link href="/selection">Create Doctor Account</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* 11. FOOTER */}
      <footer className="bg-slate-900 text-slate-300 py-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <h3 className="text-white text-lg font-bold">Medora</h3>
            <p className="text-sm text-slate-400">
              One platform. Shared understanding. Better care.
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">How it works</Link></li>
              <li><Link href="#" className="hover:text-white">For Patients</Link></li>
              <li><Link href="#" className="hover:text-white">For Doctors</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">Privacy Policy</Link></li>
              <li><Link href="#" className="hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="#" className="hover:text-white">Support</Link></li>
              <li><Link href="#" className="hover:text-white">Contact Us</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Medora. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function PillarCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="mb-4">{icon}</div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function Step({ number, title, desc }: { number: string, title: string, desc: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
        {number}
      </div>
      <div>
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3">
      <CheckCircle2 className="h-6 w-6 text-green-500 flex-shrink-0" />
      <span className="text-lg">{text}</span>
    </li>
  );
}
