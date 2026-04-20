"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { DoctorCard } from "@/components/doctor/doctor-card";
import { SearchFilters } from "@/components/doctor/search-filters";
import { PatientContextDisplay } from "@/components/doctor/patient-context-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, AlertCircle, Activity, Stethoscope, Clock, Map, History, User, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getPreviouslyVisitedDoctors } from "@/lib/appointment-actions";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { useAppI18n, useT } from "@/i18n/client";

const MapView = dynamic(
  () => import("@/components/doctor/map-view").then((module) => module.MapView),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex h-full min-h-30 items-center justify-center">
          <MedoraLoader size="sm" />
        </div>
        <CardSkeleton className="h-40" />
      </div>
    ),
  },
);

function toIntlLocale(locale: string) {
  return locale === "bn" ? "bn-BD" : "en-US";
}

type Translator = (key: string, values?: Record<string, string | number | Date>) => string;

function getCookieValue(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }

  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : "";
}

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
  hospital_latitude?: number;
  hospital_longitude?: number;
  chamber_name?: string;
  chamber_address?: string;
  chamber_city?: string;
  chamber_latitude?: number;
  chamber_longitude?: number;
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

type AIAnalysisTag = {
  name: string;
};

type AIAnalysisData = {
  symptoms?: AIAnalysisTag[];
  specialties?: AIAnalysisTag[];
  severity?: string;
  language_detected?: string;
  error?: string | null;
};

type PatientContextFactor = {
  category: string;
  value: string;
  influence: string;
};

type PreviouslyVisitedDoctor = {
  doctor_id?: string;
  profile_id?: string;
  photo_url?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  specialization?: string;
  last_visit?: string;
};

type UserLocation = {
  latitude: number;
  longitude: number;
};

type DoctorSearchFilters = {
  mode?: string;
  prompt?: string;
  location?: string | null;
  consultation_mode?: string | null;
  user_location?: UserLocation | null;
  query?: string;
  speciality_id?: string;
  city?: string;
  gender?: string;
};

type DoctorSearchResponse = {
  doctors: Doctor[];
  total?: number;
  medical_intent?: AIAnalysisData;
  patient_context_factors?: PatientContextFactor[];
  ambiguity?: string;
};

function isUserLocation(value: unknown): value is UserLocation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.latitude === "number" && typeof candidate.longitude === "number";
}

// AI Analysis summary component
function AIAnalysisSummary({
  analysis,
  tCommon,
}: {
  analysis: AIAnalysisData | null;
  tCommon: Translator;
}) {
  if (!analysis || analysis.error) return null;

  const symptoms = analysis.symptoms || [];
  const specialties = analysis.specialties || [];
  const severity = analysis.severity || "medium";
  const language = analysis.language_detected || "en";

  const severityVariant: "destructive" | "warning" | "success" =
    severity === "high" ? "destructive" : severity === "medium" ? "warning" : "success";

  return (
    <Card className="border-primary/10 bg-linear-to-r from-primary-more-light/50 to-accent/50 dark:from-primary/10 dark:to-accent/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-primary">{tCommon("findDoctor.aiAnalysis.title")}</span>
          <Badge variant="outline" className="ml-auto text-xs" aria-label={`language-${language}`}>
            {language === "bn"
              ? tCommon("findDoctor.aiAnalysis.languageBangla")
              : language === "mixed"
                ? tCommon("findDoctor.aiAnalysis.languageMixed")
                : tCommon("findDoctor.aiAnalysis.languageEnglish")}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          {/* Detected Symptoms */}
          {symptoms.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Activity className="w-3.5 h-3.5" />
                <span className="font-medium">{tCommon("findDoctor.aiAnalysis.symptomsDetected")}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {symptoms.slice(0, 4).map((s, i: number) => (
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
                <span className="font-medium">{tCommon("findDoctor.aiAnalysis.specialties")}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {specialties.map((s, i: number) => (
                  <Badge key={i} variant="secondary" className="text-xs">
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
              <span className="font-medium">{tCommon("findDoctor.aiAnalysis.urgencyLevel")}</span>
            </div>
            <Badge variant={severityVariant} className="text-xs">
              {severity === "high"
                ? tCommon("findDoctor.aiAnalysis.urgencyHigh")
                : severity === "medium"
                  ? tCommon("findDoctor.aiAnalysis.urgencyMedium")
                  : tCommon("findDoctor.aiAnalysis.urgencyLow")}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Ambiguity clarification prompt
function AmbiguityClarification({ onRetry, tCommon }: { onRetry: () => void; tCommon: Translator }) {
  return (
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="font-medium text-yellow-800">
              {tCommon("findDoctor.ambiguity.title")}
            </p>
            <p className="text-sm text-yellow-700">
              {tCommon("findDoctor.ambiguity.description")}
            </p>
            <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
              {tCommon("findDoctor.ambiguity.tryAgain")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Previously visited doctors section
function PreviouslyVisitedDoctors({ 
  doctors, 
  loading,
  onDoctorClick,
  tCommon,
  locale,
}: { 
  doctors: PreviouslyVisitedDoctor[]; 
  loading: boolean;
  onDoctorClick?: (doctorId: string) => void;
  tCommon: Translator;
  locale: string;
}) {
  if (loading) {
    return (
      <Card className="border-primary/10 bg-linear-to-r from-primary-more-light/50 to-accent/50 dark:from-primary/10 dark:to-accent/10">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-primary">{tCommon("findDoctor.previouslyVisited.title")}</span>
          </div>
          <div className="mb-3 flex items-center justify-center">
            <MedoraLoader size="sm" label={tCommon("findDoctor.page.loadingVisitedDoctors")} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton className="h-24" />
            <CardSkeleton className="h-24" />
            <CardSkeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (doctors.length === 0) return null;

  return (
    <Card className="border-primary/10 bg-linear-to-r from-primary-more-light/50 to-accent/50 dark:from-primary/10 dark:to-accent/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm text-primary">{tCommon("findDoctor.previouslyVisited.title")}</span>
          <Badge variant="secondary" className="text-xs ml-auto">
            {tCommon("findDoctor.previouslyVisited.quickBook")}
          </Badge>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {doctors.map((doc, index) => {
            const docId = doc.doctor_id || doc.profile_id;
            return (
            <button
              key={docId || `doctor-${index}`}
              onClick={() => docId && onDoctorClick?.(docId)}
              className="shrink-0 w-52 bg-card dark:bg-card rounded-xl p-3 hover:shadow-md transition-shadow text-left group border border-transparent hover:border-primary/20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {doc.photo_url ? (
                    <Image
                      src={doc.photo_url}
                      alt={`${doc.first_name ?? tCommon("findDoctor.page.doctorFallback")} ${doc.last_name ?? ""}`}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <User className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">
                    {doc.title} {doc.first_name} {doc.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {doc.specialization}
                  </p>
                  <p className="text-xs text-primary/70 mt-0.5">
                    {tCommon("findDoctor.previouslyVisited.lastPrefix")}: {doc.last_visit
                      ? new Date(doc.last_visit).toLocaleDateString(toIntlLocale(locale))
                      : tCommon("findDoctor.previouslyVisited.recently")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function FindDoctorPage() {
  const router = useRouter();
  const { locale } = useAppI18n();
  const tCommon = useT("common");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalResults, setTotalResults] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisData | null>(null);
  const [patientContextFactors, setPatientContextFactors] = useState<PatientContextFactor[]>([]);
  const [showAmbiguityPrompt, setShowAmbiguityPrompt] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMap, setShowMap] = useState(false); // Mobile map toggle
  const [previouslyVisited, setPreviouslyVisited] = useState<PreviouslyVisitedDoctor[]>([]);
  const [loadingPrevious, setLoadingPrevious] = useState(true);

  // Fetch previously visited doctors on mount
  useEffect(() => {
    const loadPreviouslyVisited = async () => {
      try {
        const data = (await getPreviouslyVisitedDoctors()) as { doctors?: PreviouslyVisitedDoctor[] };
        setPreviouslyVisited(Array.isArray(data.doctors) ? data.doctors : []);
      } catch (error) {
        console.error("Failed to load previously visited doctors:", error);
      } finally {
        setLoadingPrevious(false);
      }
    };
    loadPreviouslyVisited();
  }, []);

  const handleDoctorClick = (doctorId: string) => {
    router.push(`/patient/doctor/${doctorId}`);
  };

  const fetchDoctors = async (searchFilters: DoctorSearchFilters = {}) => {
    setLoading(true);
    setAiAnalysis(null);
    setShowAmbiguityPrompt(false);
    
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      let url = `${backendUrl}/doctor/search`;
      let options: RequestInit = {};

      if (searchFilters.mode === 'ai') {
         url = `${backendUrl}/ai/search`;
        const sessionToken = getCookieValue("session_token");
      const payload: {
        user_text: string;
        location: string | null;
        consultation_mode: string | null;
        user_location?: UserLocation;
      } = {
        user_text: typeof searchFilters.prompt === "string" ? searchFilters.prompt : "",
        location: typeof searchFilters.location === "string" ? searchFilters.location : null,
        consultation_mode: typeof searchFilters.consultation_mode === "string" ? searchFilters.consultation_mode : null
         };
         
         // Include user coordinates for distance-based ranking
      if (isUserLocation(searchFilters.user_location)) {
           payload.user_location = searchFilters.user_location;
         }

         options = {
            method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
            body: JSON.stringify(payload)
         };
      } else {
        const params = new URLSearchParams();
        Object.entries(searchFilters).forEach(([key, value]) => {
            if (typeof value === "string" && value && key !== 'mode' && key !== 'user_location') {
              params.append(key, value);
            }
        });
        url = `${url}?${params.toString()}`;
      }
      
      const res = await fetch(url, options);
      if (res.ok) {
        const data = (await res.json()) as DoctorSearchResponse;
        
        if (searchFilters.mode === 'ai') {
          if (data.medical_intent) {
            setAiAnalysis(data.medical_intent);
          }
          
          // Capture patient context factors from AI search response
          if (Array.isArray(data.patient_context_factors) && data.patient_context_factors.length > 0) {
            setPatientContextFactors(data.patient_context_factors);
          } else {
            setPatientContextFactors([]);
          }
          
          // Check for high ambiguity
          if (data.ambiguity === 'high' && data.doctors.length === 0) {
            setShowAmbiguityPrompt(true);
          }
        } else {
          // Clear patient context when not using AI search
          setPatientContextFactors([]);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleSearch = (newFilters: Record<string, unknown>) => {
    // Capture user location if provided
    if (isUserLocation(newFilters.user_location)) {
      setUserLocation(newFilters.user_location);
    }
    fetchDoctors(newFilters as DoctorSearchFilters);
    const hasActiveFilters = Object.values(newFilters).some((value) => {
      if (value === null || value === undefined) {
        return false;
      }
      if (typeof value === "string") {
        return value.trim() !== "";
      }
      return true;
    });
    setHasFilters(hasActiveFilters);
  };

  const handleClearFilters = () => {
    setHasFilters(false);
    setAiAnalysis(null);
    setPatientContextFactors([]);
    setShowAmbiguityPrompt(false);
    fetchDoctors({});
  };

  return (
    <AppBackground>
      <Navbar />
      
      <main className="max-w-6xl mx-auto container-padding py-8 pt-(--nav-content-offset) animate-page-enter">
        {/* Header Section */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{tCommon("findDoctor.page.title")}</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">
            {tCommon("findDoctor.page.subtitle")}
          </p>
          
          {/* Previously Visited Doctors */}
          {(loadingPrevious || previouslyVisited.length > 0) && !hasFilters && (
            <div className="mb-4 sm:mb-6">
              <PreviouslyVisitedDoctors 
                doctors={previouslyVisited} 
                loading={loadingPrevious}
                onDoctorClick={handleDoctorClick}
                tCommon={tCommon}
                locale={locale}
              />
            </div>
          )}
          
          <SearchFilters onSearch={handleSearch} />
          
          {/* AI Analysis Summary */}
          {aiAnalysis && !aiAnalysis.error && (
            <div className="mt-4">
              <AIAnalysisSummary analysis={aiAnalysis} tCommon={tCommon} />
            </div>
          )}
          
          {/* Patient Context Display - Shows how medical history influenced the search */}
          {patientContextFactors && patientContextFactors.length > 0 && (
            <div className="mt-4">
              <PatientContextDisplay factors={patientContextFactors} />
            </div>
          )}
          
          {/* Ambiguity Clarification */}
          {showAmbiguityPrompt && (
            <div className="mt-4">
              <AmbiguityClarification onRetry={handleClearFilters} tCommon={tCommon} />
            </div>
          )}
          
          {/* Results count and controls - Mobile-first responsive */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-4 mb-2 gap-2">
            <p className="text-sm text-muted-foreground">
              {!loading && (
                <span className="font-semibold text-foreground">
                  {totalResults === 1
                    ? tCommon("findDoctor.page.resultsFoundOne", { count: totalResults })
                    : tCommon("findDoctor.page.resultsFoundMany", { count: totalResults })}
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              {/* Mobile Map Toggle */}
              <Button
                variant={showMap ? "default" : "outline"}
                size="sm"
                onClick={() => setShowMap(!showMap)}
                className="lg:hidden touch-target"
              >
                <Map className="w-4 h-4 mr-2" />
                {showMap ? tCommon("findDoctor.page.hideMap") : tCommon("findDoctor.page.showMap")}
              </Button>
              
              {hasFilters && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleClearFilters}
                  className="text-primary hover:text-primary-muted"
                >
                  {tCommon("findDoctor.page.clearAllFilters")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 md:gap-6">
          {/* Left: Doctor List with stagger animation */}
          <div className={`space-y-4 ${showMap ? 'hidden lg:block' : 'block'}`}>
            {loading ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-2">
                  <MedoraLoader size="md" label={tCommon("findDoctor.page.loadingDoctors")} />
                </div>
                <CardSkeleton className="h-48" />
                <CardSkeleton className="h-48" />
                <CardSkeleton className="h-48" />
              </div>
            ) : doctors.length > 0 ? (
              <div className="stagger-enter space-y-4">
                {doctors.map((doctor) => (
                  <DoctorCard key={doctor.profile_id} doctor={doctor} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-2xl border border-border">
                <p className="text-muted-foreground mb-2">{tCommon("findDoctor.page.noDoctorsFound")}</p>
                {hasFilters && (
                  <Button variant="link" onClick={handleClearFilters}>{tCommon("findDoctor.page.clearAllFilters")}</Button>
                )}
              </div>
            )}
          </div>

          {/* Right: Map View */}
          {/* Desktop: Always visible and sticky */}
          <div className="hidden lg:block lg:sticky lg:top-28 lg:min-h-[75vh] lg:max-h-[calc(100vh-8rem)]">
            <MapView doctors={doctors} userLocation={userLocation} />
          </div>
          
          {/* Mobile: Toggleable full-width map */}
          {showMap && (
            <div className="lg:hidden fixed inset-0 z-40 bg-background pt-(--nav-content-offset)">
              <div className="h-full w-full p-4">
                <div className="h-full w-full rounded-2xl overflow-hidden">
                  <MapView doctors={doctors} userLocation={userLocation} />
                </div>
              </div>
              <Button
                variant="default"
                size="default"
                onClick={() => setShowMap(false)}
                className="absolute top-24 right-4 shadow-lg touch-target"
              >
                {tCommon("findDoctor.page.closeMap")}
              </Button>
            </div>
          )}
        </div>
      </main>
    </AppBackground>
  );
}


