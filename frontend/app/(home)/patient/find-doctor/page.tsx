"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/ui/navbar";
import { DoctorCard } from "@/components/doctor/doctor-card";
import { SearchFilters } from "@/components/doctor/search-filters";
import { MapView } from "@/components/doctor/map-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, AlertCircle, Activity, Stethoscope, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// AI Analysis summary component
function AIAnalysisSummary({ analysis }: { analysis: any }) {
  if (!analysis || analysis.error) return null;
  
  const symptoms = analysis.symptoms || [];
  const specialties = analysis.specialties || [];
  const severity = analysis.severity || "medium";
  const language = analysis.language_detected || "en";
  
  const severityColors: Record<string, string> = {
    low: "bg-green-100 text-green-800 border-green-200",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200",
    high: "bg-red-100 text-red-800 border-red-200"
  };
  
  return (
    <Card className="border-primary/20 bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-primary">AI Analysis</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {language === "bn" ? "Bangla" : language === "mixed" ? "Mixed" : "English"}
          </Badge>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {/* Detected Symptoms */}
          {symptoms.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="w-3.5 h-3.5" />
                <span className="font-medium">Symptoms Detected</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {symptoms.slice(0, 4).map((s: any, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Suggested Specialties */}
          {specialties.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Stethoscope className="w-3.5 h-3.5" />
                <span className="font-medium">Specialties</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {specialties.map((s: any, i: number) => (
                  <Badge key={i} className="text-xs bg-primary/10 text-primary border-primary/20">
                    {s.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Severity */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-medium">Urgency Level</span>
            </div>
            <Badge className={`text-xs ${severityColors[severity]}`}>
              {severity === "high" ? "Urgent - Seek Care Soon" : 
               severity === "medium" ? "Moderate Priority" : "Routine Visit"}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Ambiguity clarification prompt
function AmbiguityClarification({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium text-yellow-800">
              We need more details to find the right doctor
            </p>
            <p className="text-sm text-yellow-700">
              Please describe your symptoms in more detail, or use the standard search filters to find doctors by specialty.
            </p>
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
              Try Again
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FindDoctorPage() {
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
    distance_km?: number;
    latitude?: number;
    longitude?: number;
  };

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [showAmbiguityPrompt, setShowAmbiguityPrompt] = useState(false);

  const fetchDoctors = async (searchFilters: any = {}) => {
    setLoading(true);
    setAiAnalysis(null);
    setShowAmbiguityPrompt(false);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      let url = `${backendUrl}/doctor/search`;
      let options: RequestInit = {};

      if (searchFilters.mode === 'ai') {
         url = `${backendUrl}/ai/search`;
         const payload: any = {
            user_text: searchFilters.prompt,
            location: searchFilters.location || null,
            consultation_mode: searchFilters.consultation_mode || null
         };
         
         // Include user coordinates for distance-based ranking
         if (searchFilters.user_location) {
           payload.user_location = searchFilters.user_location;
         }

         console.log('AI Search Request payload:', payload);

         options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
         };
      } else {
        const params = new URLSearchParams();
        Object.entries(searchFilters).forEach(([key, value]) => {
            if (value && key !== 'mode' && key !== 'user_location') {
              params.append(key, value as string);
            }
        });
        url = `${url}?${params.toString()}`;
      }
      
      console.log('Fetching doctors from:', url); 
      
      const res = await fetch(url, options);
      if (res.ok) {
        const data = await res.json();
        
        if (searchFilters.mode === 'ai') {
          console.log('AI Search Response:', data);
          if (data.medical_intent) {
            console.log('AI Medical Intent:', data.medical_intent);
            setAiAnalysis(data.medical_intent);
          }
          
          // Check for high ambiguity
          if (data.ambiguity === 'high' && data.doctors.length === 0) {
            setShowAmbiguityPrompt(true);
          }
        }
        
        setDoctors(data.doctors);
        setTotalResults(data.total || data.doctors.length);
      } else {
        console.error('API Error:', res.status, res.statusText);
        const errorData = await res.text();
        console.error('Error details:', errorData);
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
      alert('Unable to connect to server. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSearch = (newFilters: Record<string, any>) => {
    fetchDoctors(newFilters);
    const hasActiveFilters = Object.values(newFilters).some(value => value && value !== '');
    setHasFilters(hasActiveFilters);
  };

  const handleClearFilters = () => {
    setHasFilters(false);
    setAiAnalysis(null);
    setShowAmbiguityPrompt(false);
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
          
          {/* AI Analysis Summary */}
          {aiAnalysis && !aiAnalysis.error && (
            <div className="mt-4">
              <AIAnalysisSummary analysis={aiAnalysis} />
            </div>
          )}
          
          {/* Ambiguity Clarification */}
          {showAmbiguityPrompt && (
            <div className="mt-4">
              <AmbiguityClarification onRetry={handleClearFilters} />
            </div>
          )}
          
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
            <MapView doctors={doctors} />
          </div>
        </div>
      </main>
    </div>
  );
}
