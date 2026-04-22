import React from "react";
import { Search, Sparkles, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MobileFilterSheet, FilterSection } from "@/components/ui/mobile-filter-sheet";
import { BANGLADESH_DISTRICTS } from "@/lib/bangladesh-data";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { transcribeVoice } from "@/lib/voice-actions";
import { AIDoctorSearchVapiAssistant } from "@/components/doctor/ai-search-vapi-assistant";
import { VoiceInputButton } from "@/components/doctor/voice-input-button";
import { VoiceTranscriptionReview } from "@/components/doctor/voice-transcription-review";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { useT } from "@/i18n/client";

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface SearchFiltersProps {
  onSearch: (filters: Record<string, unknown>) => void;
}

type Speciality = {
  id: number;
  name: string;
};

// Voice transcription result state
interface VoiceTranscription {
  text: string;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  languageDetected: string;
}

const AI_UI_COPY = {
  aiModeActive: "AI Assistant Mode Active",
  standardMode: "Standard Search Mode",
  switchToStandard: "Switch to Standard",
  tryAiSearch: "Try AI Search",
  describeConcern: "Describe Your Concern",
  concernPlaceholder: "Describe symptoms in English, or use voice input...",
  helperText: "Medora AI will analyze your symptoms and suggest relevant specialists.",
  locationOptional: "Location (Optional)",
  consultationType: "Consultation Type",
  anyType: "Any Type",
  videoConsultation: "Video Consultation",
  chamberVisit: "Chamber Visit",
  yourLocation: "Your Location",
  locationSet: "Location Added",
  useMyLocation: "Use My Location",
  findDoctorsWithAi: "Find Doctors with AI",
  voiceGenericError: "Something went wrong with voice input. Please try again.",
  locationNotSupported: "Geolocation is not supported on this device.",
  locationDenied: "Location access denied. Please allow location access.",
} as const;

const AI_VOICE_ERROR_MAP: Record<string, string> = {
  "no speech detected in audio. please try again.": "No speech detected. Please try again.",
  "transcription failed. please try again.": "Transcription failed. Please try again.",
  "failed to connect to server. please try again.": "Failed to connect to the server. Please try again.",
  "backend url not configured": "Backend URL is not configured.",
  "voice recording is not supported in this browser": "Voice recording is not supported in this browser.",
  "recording failed. please try again.": "Recording failed. Please try again.",
  "microphone access denied. please allow microphone access and try again.": "Microphone access denied. Please allow access and try again.",
  "no microphone found. please connect a microphone and try again.": "No microphone found. Please connect one and try again.",
  "failed to start recording. please try again.": "Failed to start recording. Please try again.",
  "geolocation not supported": AI_UI_COPY.locationNotSupported,
  "location access denied": AI_UI_COPY.locationDenied,
};

export function SearchFilters({ onSearch }: SearchFiltersProps) {
  const tCommon = useT("common");
  const aiLanguageNotice = tCommon("findDoctor.search.aiEnglishOnlyNotice");
  const [isAiMode, setIsAiMode] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("");
  
  const [query, setQuery] = React.useState("");
  const [specialityId, setSpecialityId] = React.useState("");
  const [city, setCity] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [consultationType, setConsultationType] = React.useState("");
  const [specialities, setSpecialities] = React.useState<Speciality[]>([]);
  
  // Geolocation state for distance-based ranking
  const [userLocation, setUserLocation] = React.useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  // Voice input state
  const [voiceTranscription, setVoiceTranscription] = React.useState<VoiceTranscription | null>(null);
  const [showVoiceReview, setShowVoiceReview] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);

  const normalizeVoiceError = React.useCallback(
    (message: string | null | undefined) => {
      if (!message) {
        return null;
      }

      const normalized = message.trim().toLowerCase();
      const mappedMessage = AI_VOICE_ERROR_MAP[normalized];
      if (mappedMessage) {
        return mappedMessage;
      }

      return message.trim() || AI_UI_COPY.voiceGenericError;
    },
    [],
  );

  // Voice recorder hook
  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: handleRecordingComplete
  });

  const displayedVoiceError = normalizeVoiceError(voiceRecorder.error || voiceError);

  // Handle recording completion - send to backend for transcription
  async function handleRecordingComplete(audioBlob: Blob) {
    try {
      setVoiceError(null);
      
      // Create FormData with audio file
      const formData = new FormData();
      formData.append("audio_file", audioBlob, "recording.webm");
      
      // Send to backend
      const result = await transcribeVoice(formData);
      
      if (result.success) {
        setVoiceTranscription({
          text: result.normalized_text,
          confidence: result.confidence,
          confidenceLevel: result.confidence_level,
          languageDetected: result.language_detected
        });
        setShowVoiceReview(true);
        voiceRecorder.resetRecorder();
      } else {
        setVoiceError(result.error);
        voiceRecorder.resetRecorder();
      }
    } catch {
      setVoiceError("Transcription failed. Please try again.");
      voiceRecorder.resetRecorder();
    }
  }

  // Handle voice transcription confirmation
  const handleVoiceConfirm = () => {
    if (voiceTranscription) {
      setAiPrompt(voiceTranscription.text);
      setShowVoiceReview(false);
      setVoiceTranscription(null);
    }
  };

  // Handle voice retry
  const handleVoiceRetry = () => {
    setShowVoiceReview(false);
    setVoiceTranscription(null);
    setVoiceError(null);
    voiceRecorder.resetRecorder();
  };

  // Handle voice cancel
  const handleVoiceCancel = () => {
    setShowVoiceReview(false);
    setVoiceTranscription(null);
    setVoiceError(null);
    voiceRecorder.resetRecorder();
  };

  async function fetchSpecialities() {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/specialities/`);
      if (res.ok) {
        const data = await res.json();
        setSpecialities(data.specialities || []);
      }
    } catch (_error) {
      console.error("Failed to fetch specialities:", _error);
    }
  }

  React.useEffect(() => {
    fetchSpecialities();
  }, []);

  // Request user's location for distance-based ranking
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(AI_UI_COPY.locationNotSupported);
      return;
    }
    
    setLocationLoading(true);
    setLocationError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationLoading(false);
      },
      () => {
        setLocationError(AI_UI_COPY.locationDenied);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSearch = () => {
    if (isAiMode) {
      onSearch({
        mode: 'ai',
        prompt: aiPrompt,
        location: city === "all" ? "" : city,
        consultation_mode: consultationType === "all" ? "" : consultationType,
        user_location: userLocation, // Include coordinates for distance ranking
      });
    } else {
      onSearch({
        query,
        speciality_id: specialityId === "all" ? "" : specialityId,
        city: city === "all" ? "" : city,
        gender: gender === "all" ? "" : gender,
        consultation_mode: consultationType === "all" ? "" : consultationType,
      });
    }
  };

  // Count active filters for badge
  const activeFilterCount = [
    gender && gender !== "all",
    specialityId && specialityId !== "all",
    city && city !== "all",
    consultationType && consultationType !== "all",
  ].filter(Boolean).length;

  // Reset all filters
  const handleResetFilters = () => {
    setGender("");
    setSpecialityId("");
    setCity("");
    setConsultationType("");
  };

  // Reused filter controls markup for desktop and mobile layouts.
  const renderFilterControls = (isMobile = false) => (
    <div className={isMobile ? "space-y-5" : "grid grid-cols-2 lg:grid-cols-4 gap-3"}>
      <FilterSection title={tCommon("findDoctor.filters.gender")} className={isMobile ? "" : "space-y-1.5"}>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="bg-background border-border w-full">
            <SelectValue placeholder={tCommon("findDoctor.filters.allGenders")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("findDoctor.filters.allGenders")}</SelectItem>
            <SelectItem value="male">{tCommon("findDoctor.filters.male")}</SelectItem>
            <SelectItem value="female">{tCommon("findDoctor.filters.female")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection title={tCommon("findDoctor.filters.speciality")} className={isMobile ? "" : "space-y-1.5"}>
        <SearchableSelect
          options={specialities.map(s => s.name)}
          value={specialityId ? specialities.find(s => s.id.toString() === specialityId)?.name : ""}
          onValueChange={(value) => {
            const speciality = specialities.find(s => s.name === value);
            setSpecialityId(speciality ? speciality.id.toString() : "");
          }}
          placeholder={tCommon("findDoctor.filters.allSpecialities")}
          emptyMessage={tCommon("findDoctor.filters.noSpecialitiesFound")}
          className="bg-background border-border"
        />
      </FilterSection>

      <FilterSection title={tCommon("findDoctor.filters.location")} className={isMobile ? "" : "space-y-1.5"}>
        <SearchableSelect
          options={BANGLADESH_DISTRICTS}
          value={city}
          onValueChange={setCity}
          placeholder={tCommon("findDoctor.filters.selectDistrict")}
          emptyMessage={tCommon("findDoctor.filters.noDistrictsFound")}
          className="bg-background border-border"
        />
      </FilterSection>

      <FilterSection title={tCommon("findDoctor.filters.consultationType")} className={isMobile ? "" : "space-y-1.5"}>
        <Select value={consultationType} onValueChange={setConsultationType}>
          <SelectTrigger className="bg-background border-border w-full">
            <SelectValue placeholder={tCommon("findDoctor.filters.allTypes")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{tCommon("findDoctor.filters.allTypes")}</SelectItem>
            <SelectItem value="online">{tCommon("findDoctor.filters.online")}</SelectItem>
            <SelectItem value="offline">{tCommon("findDoctor.filters.offlineInPerson")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterSection>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* AI Toggle - Mobile-first responsive */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-muted/30 p-3 sm:p-2 rounded-lg">
         <span className="text-sm font-medium text-muted-foreground">
         {isAiMode ? AI_UI_COPY.aiModeActive : AI_UI_COPY.standardMode}
         </span>
         <Button 
            variant={isAiMode ? "default" : "outline"} 
            size="sm"
            onClick={() => setIsAiMode(!isAiMode)}
          className={`w-full sm:w-auto touch-target ${isAiMode ? "bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" : ""}`}
         >
            <Sparkles className="w-4 h-4 mr-2" />
          {isAiMode ? AI_UI_COPY.switchToStandard : AI_UI_COPY.tryAiSearch}
         </Button>
      </div>

      {isAiMode ? (
        <div className="space-y-4 p-4 sm:p-6 border-2 border-primary/20 rounded-xl bg-primary/5 transition-all duration-300">
           {/* Voice Transcription Review (shown after recording) */}
           {showVoiceReview && voiceTranscription ? (
              <VoiceTranscriptionReview
                text={voiceTranscription.text}
                confidence={voiceTranscription.confidence}
                confidenceLevel={voiceTranscription.confidenceLevel}
                languageDetected={voiceTranscription.languageDetected}
                languageNotice={aiLanguageNotice}
                onTextChange={(text) => setVoiceTranscription({ ...voiceTranscription, text })}
                onConfirm={handleVoiceConfirm}
                onRetry={handleVoiceRetry}
                onCancel={handleVoiceCancel}
              />
           ) : (
           <div className="space-y-2">
              <label className="text-base font-semibold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> {AI_UI_COPY.describeConcern}
              </label>

              <AIDoctorSearchVapiAssistant
                location={city}
                consultationMode={consultationType}
                userLocation={userLocation}
                languageNotice={aiLanguageNotice}
                onTranscriptDetected={(text) => {
                  if (!text.trim()) {
                    return;
                  }
                  setAiPrompt(text.trim());
                }}
              />
              
              {/* Textarea with Voice Input Button */}
              <div className="relative">
                <Textarea 
                  placeholder={AI_UI_COPY.concernPlaceholder}
                  className="min-h-25 sm:min-h-30 text-base bg-background/80 focus:bg-background border-primary/20 focus:border-primary resize-none pr-14"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={voiceRecorder.state === "recording" || voiceRecorder.state === "processing"}
                />

                <p className="mt-2 text-[11px] text-muted-foreground">{aiLanguageNotice}</p>
                
                {/* Voice Input Button (positioned inside textarea) */}
                <div className="absolute right-2 top-2">
                  <VoiceInputButton
                    state={voiceRecorder.state}
                    duration={voiceRecorder.duration}
                    isSupported={voiceRecorder.isSupported}
                    error={voiceRecorder.error || voiceError}
                    onStartRecording={voiceRecorder.startRecording}
                    onStopRecording={voiceRecorder.stopRecording}
                  />
                </div>
              </div>
              
              {/* Voice error message */}
              {(voiceRecorder.error || voiceError) && (
                <p className="text-xs text-destructive">
                  {displayedVoiceError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                  {AI_UI_COPY.helperText}
              </p>
           </div>
           )}
           
           {/* AI Mode Filters - Mobile-first grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                  <label className="text-sm font-medium">{AI_UI_COPY.locationOptional}</label>
                  <SearchableSelect
                    options={BANGLADESH_DISTRICTS}
                    value={city}
                    onValueChange={setCity}
                    placeholder="Select district"
                    emptyMessage="No districts found"
                    className="bg-background"
                  />
              </div>
               <div className="space-y-1.5">
                  <label className="text-sm font-medium">{AI_UI_COPY.consultationType}</label>
                   <Select value={consultationType} onValueChange={setConsultationType}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={AI_UI_COPY.anyType} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{AI_UI_COPY.anyType}</SelectItem>
                      <SelectItem value="online">{AI_UI_COPY.videoConsultation}</SelectItem>
                      <SelectItem value="in-person">{AI_UI_COPY.chamberVisit}</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               {/* Geolocation button for distance-based ranking */}
               <div className="space-y-1.5">
                  <label className="text-sm font-medium">{AI_UI_COPY.yourLocation}</label>
                  <Button 
                    variant={userLocation ? "secondary" : "outline"}
                    className="w-full touch-target"
                    onClick={requestLocation}
                    disabled={locationLoading}
                  >
                    {locationLoading ? (
                      <ButtonLoader className="w-4 h-4 mr-2" />
                    ) : (
                      <MapPin className="w-4 h-4 mr-2" />
                    )}
                    {userLocation ? AI_UI_COPY.locationSet : AI_UI_COPY.useMyLocation}
                  </Button>
                  {locationError && (
                    <p className="text-xs text-destructive">{locationError}</p>
                  )}
               </div>
               <div className="flex items-end">
                <Button size="lg" className="w-full bg-linear-to-r from-blue-600 to-indigo-600 touch-target" onClick={handleSearch}>
                  {AI_UI_COPY.findDoctorsWithAi}
                  </Button>
               </div>
           </div>
        </div>
      ) : (
        <>
          {/* Main Search Bar - Mobile-first */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Input 
                placeholder={tCommon("findDoctor.search.searchPlaceholder")} 
                className="h-12 text-base shadow-sm bg-background border-border"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            
            {/* Mobile: Filter button + Search button side by side */}
            <div className="flex gap-2 sm:hidden">
              <MobileFilterSheet
                activeFilterCount={activeFilterCount}
                onApply={handleSearch}
                onReset={handleResetFilters}
                title={tCommon("findDoctor.mobileFilters.title")}
                triggerLabel={tCommon("findDoctor.mobileFilters.triggerLabel")}
                closeLabel={tCommon("findDoctor.mobileFilters.close")}
                resetLabel={tCommon("findDoctor.mobileFilters.reset")}
                applyLabel={tCommon("findDoctor.mobileFilters.apply")}
              >
                {renderFilterControls(true)}
              </MobileFilterSheet>
              
              <Button size="lg" className="flex-1 h-12" onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                {tCommon("findDoctor.search.searchButton")}
              </Button>
            </div>
            
            {/* Desktop: Just the search button */}
            <Button size="lg" className="hidden sm:flex h-12 px-8" onClick={handleSearch}>
              {tCommon("findDoctor.search.searchButton")}
            </Button>
          </div>

          {/* Desktop Filters - Hidden on mobile */}
          <div className="hidden sm:block">
            {renderFilterControls(false)}
          </div>
        </>
      )}
    </div>
  );
}
