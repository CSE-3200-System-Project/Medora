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
    score?: number;
    reason?: string;
  };

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null); // To store AI extra meta

  const fetchDoctors = async (searchFilters: any = {}) => {
    setLoading(true);
    setAiAnalysis(null);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      let url = `${backendUrl}/doctor/search`;
      let options: RequestInit = {};

      if (searchFilters.mode === 'ai') {
         url = `${backendUrl}/ai/search`;
         const payload = {
            user_text: searchFilters.prompt,
            location: searchFilters.location || null,
            consultation_mode: searchFilters.consultation_mode || null
         };

         // Browser console log for debugging the prompt
         console.log('AI Search Request payload:', payload);

         options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         };
      } else {
        const params = new URLSearchParams();
        Object.entries(searchFilters).forEach(([key, value]) => {
            if (value && key !== 'mode') params.append(key, value as string);
        });
        url = `${url}?${params.toString()}`;
      }
      
      console.log('Fetching doctors from:', url); 
      
      const res = await fetch(url, options);
      if (res.ok) {
        const data = await res.json();
        // Browser console log for debugging the LLM response when in AI mode
        if (searchFilters.mode === 'ai') {
          console.log('AI Search Response:', data);
          if (data.medical_intent) console.log('AI Medical Intent:', data.medical_intent);
        }
        setDoctors(data.doctors);
        setTotalResults(data.total || data.doctors.length);
        if (data.medical_intent) {
            setAiAnalysis(data.medical_intent);
        }
      } else {
        console.error('API Error:', res.status, res.statusText);
        const errorData = await res.text();
        console.error('Error details:', errorData);
        if (searchFilters.mode === 'ai') {
          // log server return body for AI mode too
          console.warn('AI Search Error response:', errorData);
        }
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
      // Show user-friendly error
      alert('Unable to connect to server. Please ensure the backend is running on http://localhost:8000');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSearch = (newFilters: Record<string, string>) => {
    fetchDoctors(newFilters);
    const hasActiveFilters = Object.values(newFilters).some(value => value && value !== '');
    setHasFilters(hasActiveFilters);
  };

  const handleClearFilters = () => {
    setHasFilters(false);
    fetchDoctors({});
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
          
          {/* Results count and clear filters */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <p className="text-sm text-muted-foreground">
              {!loading && (
                <span className="font-semibold text-foreground">
                  {totalResults} {totalResults === 1 ? 'doctor' : 'doctors'} found
                </span>
              )}
            </p>
            {hasFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleClearFilters}
                className="text-primary hover:text-primary-muted"
              >
                Clear all filters
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
          {/* Left: Doctor List */}
          <div className="space-y-4">
            {loading ? (
              // Loading skeleton
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl border border-border/50 p-6 animate-pulse">
                    <div className="flex gap-6">
                      <div className="h-32 w-32 bg-surface rounded-xl shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-6 bg-surface rounded w-1/3" />
                        <div className="h-4 bg-surface rounded w-1/2" />
                        <div className="h-4 bg-surface rounded w-2/3" />
                        <div className="flex gap-2 mt-4">
                          <div className="h-8 bg-surface rounded w-20" />
                          <div className="h-8 bg-surface rounded w-24" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : doctors.length > 0 ? (
              doctors.map((doctor) => (
                <DoctorCard key={doctor.profile_id} doctor={doctor} />
              ))
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border border-border">
                <p className="text-muted-foreground mb-2">No doctors found matching your criteria.</p>
                {hasFilters && (
                  <Button variant="link" onClick={handleClearFilters}>Clear Filters</Button>
                )}
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
