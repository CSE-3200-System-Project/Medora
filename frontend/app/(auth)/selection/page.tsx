"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import doctorImg from "@/assets/image/doctors.jpg";
import patientImg from "@/assets/image/patient.jpg";
import logo from "@/assets/image/medora-logo.png";

export default function SelectionPage() {
  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface p-4 md:p-8 gap-2 relative">
      {/* Doctor Section */}
      <Link href="/doctor/register" className="relative flex-1 group overflow-hidden rounded-3xl shadow-2xl">
        <Image
          src={doctorImg}
          alt="Doctor"
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          priority
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-300 flex flex-col items-center justify-end p-6 pb-32">
          <h2 className="text-white text-4xl md:text-6xl font-bold tracking-tight mb-4 transform transition-transform duration-300 group-hover:-translate-y-2">Doctor</h2>
          <p className="text-white/90 text-lg md:text-xl text-center max-w-md opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            Join our network of specialists
          </p>
        </div>
      </Link>

      {/* Patient Section */}
      <Link href="/patient/register" className="relative flex-1 group overflow-hidden rounded-3xl shadow-2xl">
        <Image
          src={patientImg}
          alt="Patient"
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          priority
        />
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors duration-300 flex flex-col items-center justify-end p-6 pb-32">
          <h2 className="text-white text-4xl md:text-6xl font-bold tracking-tight mb-4 transform transition-transform duration-300 group-hover:-translate-y-2">Patient</h2>
          <p className="text-white/90 text-lg md:text-xl text-center max-w-md opacity-0 transform translate-y-4 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
            Find the best care for you
          </p>
        </div>
      </Link>

      {/* Floating Sign In Link */}
      <div className="absolute bottom-12 left-0 right-0 text-center z-10 pointer-events-none">
        <p className="text-white/90 text-lg drop-shadow-md pointer-events-auto inline-block bg-black/30 px-6 py-3 rounded-full backdrop-blur-md border border-white/10">
          Already have an account? <Link href="/login" className="text-primary font-bold hover:text-primary-muted underline ml-2">Sign in</Link>
        </p>
      </div>
      
      {/* Floating Logo */}
      <div className="absolute top-8 left-0 right-0 flex justify-center z-20 pointer-events-none">
         <div className="relative w-20 h-20 md:w-24 md:h-24 bg-white/90 backdrop-blur-md rounded-full p-4 shadow-2xl border-4 border-white/20">
            <Image src={logo} alt="Medora" fill className="object-contain p-1" />
         </div>
      </div>
    </div>
  );
}
