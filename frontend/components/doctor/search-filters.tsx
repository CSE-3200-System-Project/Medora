import React from "react";
import { Search, Sparkles, MapPin, SlidersHorizontal } from "lucide-react";
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
import { VoiceInputButton } from "@/components/doctor/voice-input-button";
import { VoiceTranscriptionReview } from "@/components/doctor/voice-transcription-review";
import { ButtonLoader } from "@/components/ui/medora-loader";

interface UserLocation {
  latitude: number;
  longitude: number;
}

interface SearchFiltersProps {
  onSearch: (filters: Record<string, any>) => void;
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

export function SearchFilters({ onSearch }: SearchFiltersProps) {
  const [isAiMode, setIsAiMode] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("");
  
  const [query, setQuery] = React.useState("");
  const [specialityId, setSpecialityId] = React.useState("");
  const [city, setCity] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [consultationType, setConsultationType] = React.useState("");
  const [specialities, setSpecialities] = React.useState<Speciality[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  // Geolocation state for distance-based ranking
  const [userLocation, setUserLocation] = React.useState<UserLocation | null>(null);
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  // Voice input state
  const [voiceTranscription, setVoiceTranscription] = React.useState<VoiceTranscription | null>(null);
  const [showVoiceReview, setShowVoiceReview] = React.useState(false);
  const [voiceError, setVoiceError] = React.useState<string | null>(null);

  // Voice recorder hook
  const voiceRecorder = useVoiceRecorder({
    maxDuration: 60,
    onRecordingComplete: handleRecordingComplete
  });

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
    } catch (error) {
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

  React.useEffect(() => {
    fetchSpecialities();
  }, []);

  const fetchSpecialities = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const res = await fetch(`${backendUrl}/specialities/`);
      if (res.ok) {
        const data = await res.json();
        setSpecialities(data.specialities || []);
      }
    } catch (error) {
      console.error("Failed to fetch specialities:", error);
    } finally {
      setLoading(false);
    }
  };

  // Request user's location for distance-based ranking
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported");
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
      (error) => {
        setLocationError("Location access denied");
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

  // Filter controls component (reused for both desktop and mobile)
  const FilterControls = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={isMobile ? "space-y-5" : "grid grid-cols-2 lg:grid-cols-4 gap-3"}>
      <FilterSection title="Gender" className={isMobile ? "" : "space-y-1.5"}>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="bg-background border-border w-full">
            <SelectValue placeholder="All Genders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genders</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </FilterSection>

      <FilterSection title="Speciality" className={isMobile ? "" : "space-y-1.5"}>
        <SearchableSelect
          options={specialities.map(s => s.name)}
          value={specialityId ? specialities.find(s => s.id.toString() === specialityId)?.name : ""}
          onValueChange={(value) => {
            const speciality = specialities.find(s => s.name === value);
            setSpecialityId(speciality ? speciality.id.toString() : "");
          }}
          placeholder="All Specialities"
          emptyMessage="No specialities found."
          className="bg-background border-border"
        />
      </FilterSection>

      <FilterSection title="Location" className={isMobile ? "" : "space-y-1.5"}>
        <SearchableSelect
          options={BANGLADESH_DISTRICTS}
          value={city}
          onValueChange={setCity}
          placeholder="Select District"
          emptyMessage="No districts found."
          className="bg-background border-border"
        />
      </FilterSection>

      <FilterSection title="Consultation Type" className={isMobile ? "" : "space-y-1.5"}>
        <Select value={consultationType} onValueChange={setConsultationType}>
          <SelectTrigger className="bg-background border-border w-full">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="offline">In-Person</SelectItem>
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
            {isAiMode ? "AI Assistant Mode Active" : "Standard Search Mode"}
         </span>
         <Button 
            variant={isAiMode ? "default" : "outline"} 
            size="sm"
            onClick={() => setIsAiMode(!isAiMode)}
            className={`w-full sm:w-auto touch-target ${isAiMode ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" : ""}`}
         >
            <Sparkles className="w-4 h-4 mr-2" />
            {isAiMode ? "Switch to Standard" : "Try AI Search"}
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
                onTextChange={(text) => setVoiceTranscription({ ...voiceTranscription, text })}
                onConfirm={handleVoiceConfirm}
                onRetry={handleVoiceRetry}
                onCancel={handleVoiceCancel}
              />
           ) : (
           <div className="space-y-2">
              <label className="text-base font-semibold text-foreground flex items-center gap-2">
                 <Sparkles className="w-4 h-4 text-primary" /> Describe your health concern
              </label>
              
              {/* Textarea with Voice Input Button */}
              <div className="relative">
                <Textarea 
                  placeholder="Ex: My father has severe chest pain since morning and history of diabetes. (Bangla/English) - Or click mic to speak"
                  className="min-h-[100px] sm:min-h-[120px] text-base bg-background/80 focus:bg-background border-primary/20 focus:border-primary resize-none pr-14"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  disabled={voiceRecorder.state === "recording" || voiceRecorder.state === "processing"}
                />
                
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
                  {voiceRecorder.error || voiceError}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                 Medora AI will analyze your symptoms and suggest relevant specialists. You can type or use the microphone.
              </p>
           </div>
           )}
           
           {/* AI Mode Filters - Mobile-first grid */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                  <label className="text-sm font-medium">Location (Optional)</label>
                  <SearchableSelect
                    options={BANGLADESH_DISTRICTS}
                    value={city}
                    onValueChange={setCity}
                    placeholder="Select District"
                    emptyMessage="No districts found."
                    className="bg-background"
                  />
              </div>
               <div className="space-y-1.5">
                  <label className="text-sm font-medium">Consultation Type</label>
                   <Select value={consultationType} onValueChange={setConsultationType}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Any Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Type</SelectItem>
                      <SelectItem value="online">Video Consultation</SelectItem>
                      <SelectItem value="in-person">Chamber Visit</SelectItem>
                    </SelectContent>
                  </Select>
               </div>
               {/* Geolocation button for distance-based ranking */}
               <div className="space-y-1.5">
                  <label className="text-sm font-medium">Your Location</label>
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
                    {userLocation ? "Location Set" : "Use My Location"}
                  </Button>
                  {locationError && (
                    <p className="text-xs text-destructive">{locationError}</p>
                  )}
               </div>
               <div className="flex items-end">
                  <Button size="lg" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 touch-target" onClick={handleSearch}>
                    Find Doctors with AI
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
                placeholder="Search doctors, symptoms..." 
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
              >
                <FilterControls isMobile />
              </MobileFilterSheet>
              
              <Button size="lg" className="flex-1 h-12" onClick={handleSearch}>
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
            
            {/* Desktop: Just the search button */}
            <Button size="lg" className="hidden sm:flex h-12 px-8" onClick={handleSearch}>
              Search
            </Button>
          </div>

          {/* Desktop Filters - Hidden on mobile */}
          <div className="hidden sm:block">
            <FilterControls isMobile={false} />
          </div>
        </>
      )}
    </div>
  );
}
