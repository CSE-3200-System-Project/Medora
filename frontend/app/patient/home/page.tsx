"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/ui/navbar";
import { DoctorCard } from "@/components/doctor/doctor-card";
import { SearchFilters } from "@/components/doctor/search-filters";
import { MapView } from "@/components/doctor/map-view";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function PatientHomePage() {
  type Doctor = {
    profile_id: string;
    first_name: string;
    last_name: string;
    title?: string;
    specialization: string;
    qualifications?: string;
    years_of_experience?: number;
    hospital_name?: string;
    hospital_address?: string;
    hospital_city?: string;
    consultation_fee?: number;
    profile_photo_url?: string;
    visiting_hours?: string;
    consultation_mode?: string;
  };

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDoctors = async (searchFilters = {}) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value) params.append(key, value as string);
      });

      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/doctor/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDoctors(data.doctors);
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSearch = (newFilters: Record<string, string>) => {
    fetchDoctors(newFilters);
  };

  return (
    <div className="min-h-screen bg-surface font-sans text-foreground">
      <Navbar />
      
      <main className="pt-24 pb-8 md:pt-28 md:pb-10 px-4 md:px-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Find a Doctor</h1>
          <p className="text-muted-foreground mb-6">
            Book appointments with minimum wait-time & video consult with verified doctors
          </p>
          
          <SearchFilters onSearch={handleSearch} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
          {/* Left: Doctor List */}
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : doctors.length > 0 ? (
              doctors.map((doctor) => (
                <DoctorCard key={doctor.profile_id} doctor={doctor} />
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-border">
                <p className="text-muted-foreground">No doctors found matching your criteria.</p>
                <Button variant="link" onClick={() => handleSearch({})}>Clear Filters</Button>
              </div>
            )}
          </div>

          {/* Right: Map View (Hidden on mobile, visible on large screens) */}
          <div className="hidden lg:block sticky top-28 h-[calc(100vh-8rem)]">
            <MapView />
          </div>
        </div>
      </main>
    </div>
  );
}
