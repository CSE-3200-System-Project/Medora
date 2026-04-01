"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2, MapPin, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select-native"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { ScheduleSetter } from "@/components/doctor/schedule-setter"
import { LocationPicker } from "@/components/ui/location-picker"
import { MedoraLoader } from "@/components/ui/medora-loader"
import { updateDoctorOnboarding, completeOnboarding, getDoctorOnboardingData } from "@/lib/auth-actions"
import { uploadMediaFile, type MediaCategory } from "@/lib/file-storage-actions"
import { useRouter } from "next/navigation"

const STEPS = [
  { id: 1, title: "Personal Identity", shortName: "Identity" },
  { id: 2, title: "Professional Credentials", shortName: "Credentials" },
  { id: 3, title: "Specialization & Services", shortName: "Specialization" },
  { id: 4, title: "Experience & Work History", shortName: "Experience" },
  { id: 5, title: "Practice Details", shortName: "Practice" },
  { id: 6, title: "Consultation Setup", shortName: "Consultation" },
  { id: 7, title: "About & Bio", shortName: "About" },
  { id: 8, title: "Preferences & Consent", shortName: "Consent" },
]

const DOCTOR_ONBOARDING_TIME_ESTIMATE = "10-12 minutes"
const DOCTOR_ONBOARDING_AHA =
  "Once your profile, chambers, and schedule are complete, patients can discover and book you with greater trust."

const DOCTOR_STEP_GUIDANCE: Record<number, string> = {
  1: "Identity details to build a trusted professional profile.",
  2: "Credentials that help patients and admins verify your practice.",
  3: "Specialties and services to improve patient matching.",
  4: "Career history that strengthens clinical credibility.",
  5: "Practice locations and map pins for precise discoverability.",
  6: "Consultation fees and schedule setup for booking readiness.",
  7: "A concise bio so patients understand your expertise.",
  8: "Language, telemedicine, and consent preferences.",
}

interface Education {
  degree: string
  institution: string
  year: string
  country: string
}

interface WorkExperience {
  position: string
  hospital: string
  from_year: string
  to_year: string
  current: boolean
}

interface PracticeLocation {
  id: string
  locationName: string
  locationType: string
  locationText: string
  displayName: string
  address: string
  city: string
  country: string
  latitude?: number
  longitude?: number
  availableDays: string[]
  dayTimeSlots: Record<string, string[]>
  appointmentDuration?: number
  isPrimary: boolean
}

type Speciality = {
  id: number
  name: string
}

function createPracticeLocation(isPrimary: boolean): PracticeLocation {
  return {
    id: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
    locationName: "",
    locationType: isPrimary ? "HOSPITAL" : "CHAMBER",
    locationText: "",
    displayName: "",
    address: "",
    city: "",
    country: "Bangladesh",
    availableDays: [],
    dayTimeSlots: {},
    appointmentDuration: undefined,
    isPrimary,
  }
}

export function DoctorOnboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [showCompletionState, setShowCompletionState] = useState(false)
  const [completionCountdown, setCompletionCountdown] = useState(3)
  const [specialities, setSpecialities] = useState<Speciality[]>([])
  const [mapPickerLocationId, setMapPickerLocationId] = useState<string | null>(null)
  const [scheduleLocationId, setScheduleLocationId] = useState<string | null>(null)
  const router = useRouter()
  
  const [formData, setFormData] = useState({
    // Step 1 - Personal Identity
    firstName: "",
    lastName: "",
    title: "",
    gender: "",
    dob: "",
    phone: "",
    email: "",
    nidNumber: "",
    profile_photo_url: "",
    
    // Step 2 - Professional Credentials
    registrationNumber: "",
    bmdc_document_url: "",
    qualifications: "",
    degree: "",
    degree_certificates_url: "",
    education: [] as Education[],
    
    // Step 3 - Specialization
    specialityId: "",
    specialization: "",
    subSpecializations: [] as string[],
    services: [] as string[],
    newService: "",
    
    // Step 4 - Experience
    experience: "",
    workExperience: [] as WorkExperience[],
    
    // Step 5 - Practice Details
    hospitalName: "",
    hospitalAddress: "",
    hospitalCity: "",
    hospitalCountry: "Bangladesh",
    chamberName: "",
    chamberAddress: "",
    chamberCity: "",
    practiceLocations: [] as PracticeLocation[],
    practiceLocation: "",
    consultationMode: "both",
    affiliation_letter_url: "",
    institution: "",
    
    // Step 6 - Consultation Setup
    consultationFee: "",
    followUpFee: "",
    visitingHours: "",
    availableDays: [] as string[],
    timeSlots: "",
    dayTimeSlots: {} as Record<string, string[]>,  // NEW: per-day schedules
    appointmentDuration: "",
    emergencyAvailability: false,
    emergencyContact: "",
    
    // Step 7 - About & Bio
    about: "",
    
    // Step 8 - Preferences & Consent
    language: "English",
    languagesSpoken: [] as string[],
    caseTypes: "",
    aiAssistance: true,
    allowPatientAIVisibility: true,
    termsAccepted: false,
    telemedicineAvailable: false,
    telemedicinePlatforms: [] as string[],
  })

  // Fetch existing data on mount
  useEffect(() => {
    async function fetchExistingData() {
      try {
        const data = await getDoctorOnboardingData()
        if (data) {
          const fromBackendLocations: PracticeLocation[] = Array.isArray(data.practice_locations)
            ? data.practice_locations.map((location: Record<string, unknown>, index: number) => ({
                id: (location.id as string | undefined) || (typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}-${index}`),
                locationName: (location.location_name as string | undefined) || "",
                locationType: (location.location_type as string | undefined) || (index === 0 ? "HOSPITAL" : "CHAMBER"),
                locationText: (location.location_text as string | undefined) || "",
                displayName: (location.display_name as string | undefined) || "",
                address: (location.address as string | undefined) || "",
                city: (location.city as string | undefined) || "",
                country: (location.country as string | undefined) || "Bangladesh",
                latitude: typeof location.latitude === "number" ? location.latitude : undefined,
                longitude: typeof location.longitude === "number" ? location.longitude : undefined,
                availableDays: Array.isArray(location.available_days) ? (location.available_days as string[]) : [],
                dayTimeSlots:
                  location.day_time_slots && typeof location.day_time_slots === "object"
                    ? (location.day_time_slots as Record<string, string[]>)
                    : {},
                appointmentDuration: typeof location.appointment_duration === "number" ? location.appointment_duration : undefined,
                isPrimary: Boolean(location.is_primary) || index === 0,
              }))
            : []

          const legacyLocations: PracticeLocation[] = []
          if (fromBackendLocations.length === 0 && (data.hospital_name || data.hospital_address || data.hospital_city)) {
            legacyLocations.push({
              id: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
              locationName: data.hospital_name || "Primary Location",
              locationType: "HOSPITAL",
              locationText: [data.hospital_name, data.hospital_address, data.hospital_city, data.hospital_country || "Bangladesh"].filter(Boolean).join(", "),
              displayName: "",
              address: data.hospital_address || "",
              city: data.hospital_city || "",
              country: data.hospital_country || "Bangladesh",
              latitude: undefined,
              longitude: undefined,
              availableDays: data.available_days || [],
              dayTimeSlots: data.day_time_slots || {},
              appointmentDuration: data.appointment_duration || undefined,
              isPrimary: true,
            })
          }

          if (fromBackendLocations.length === 0 && (data.chamber_name || data.chamber_address || data.chamber_city)) {
            legacyLocations.push({
              id: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10),
              locationName: data.chamber_name || "Chamber",
              locationType: "CHAMBER",
              locationText: [data.chamber_name, data.chamber_address, data.chamber_city, "Bangladesh"].filter(Boolean).join(", "),
              displayName: "",
              address: data.chamber_address || "",
              city: data.chamber_city || "",
              country: "Bangladesh",
              latitude: undefined,
              longitude: undefined,
              availableDays: data.available_days || [],
              dayTimeSlots: data.day_time_slots || {},
              appointmentDuration: data.appointment_duration || undefined,
              isPrimary: legacyLocations.length === 0,
            })
          }

          const hydratedLocations = fromBackendLocations.length > 0 ? fromBackendLocations : legacyLocations

          setFormData(prev => ({
            ...prev,
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            title: data.title || "",
            gender: data.gender || "",
            dob: data.dob || "",
            phone: data.phone || "",
            email: data.email || "",
            nidNumber: data.nid_number || "",
            profile_photo_url: data.profile_photo_url || "",
            
            registrationNumber: data.registration_number || "",
            bmdc_document_url: data.bmdc_document_url || "",
            qualifications: data.qualifications || "",
            degree: data.degree || "",
            degree_certificates_url: data.degree_certificates_url || "",
            education: data.education || [],
            
            specialityId: data.speciality_id?.toString() || "",
            specialization: data.specialization || "",
            subSpecializations: data.sub_specializations || [],
            services: data.services || [],
            
            experience: data.experience || "",
            workExperience: data.work_experience || [],
            
            hospitalName: data.hospital_name || "",
            hospitalAddress: data.hospital_address || "",
            hospitalCity: data.hospital_city || "",
            hospitalCountry: data.hospital_country || "Bangladesh",
            chamberName: data.chamber_name || "",
            chamberAddress: data.chamber_address || "",
            chamberCity: data.chamber_city || "",
            practiceLocations: hydratedLocations,
            practiceLocation: data.practice_location || "",
            consultationMode: data.consultation_mode || "both",
            affiliation_letter_url: data.affiliation_letter_url || "",
            institution: data.institution || "",
            
            consultationFee: data.consultation_fee || "",
            followUpFee: data.follow_up_fee || "",
            visitingHours: data.visiting_hours || "",
            // Use day_time_slots if present (authoritative), otherwise fall back to available_days/time_slots
            dayTimeSlots: data.day_time_slots || {},
            availableDays: data.day_time_slots && Object.keys(data.day_time_slots).length > 0 ? Object.keys(data.day_time_slots) : (data.available_days || []),
            timeSlots: data.time_slots || "",
            appointmentDuration: data.appointment_duration?.toString() || "",
            emergencyAvailability: data.emergency_availability || false,
            emergencyContact: data.emergency_contact || "",
            
            about: data.about || "",
            
            language: data.language || "English",
            languagesSpoken: data.languages_spoken || [],
            caseTypes: data.case_types || "",
            aiAssistance: data.ai_assistance ?? true,
            allowPatientAIVisibility: data.allow_patient_ai_visibility ?? true,
            termsAccepted: data.terms_accepted || false,
            telemedicineAvailable: data.telemedicine_available || false,
            telemedicinePlatforms: data.telemedicine_platforms || [],
          }))
        }
      } catch (error) {
        console.error("Failed to fetch existing data:", error)
      } finally {
        setInitialLoading(false)
      }
    }
    
    fetchExistingData()
  }, [])

  // Fetch specialities from API
  useEffect(() => {
    async function fetchSpecialities() {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const res = await fetch(`${backendUrl}/specialities/`);
        if (res.ok) {
          const data = await res.json();
          setSpecialities(data.specialities || []);
        }
      } catch (error) {
        console.error("Failed to fetch specialities:", error);
      }
    }
    fetchSpecialities();
  }, []);

  useEffect(() => {
    if (!showCompletionState) {
      return
    }

    if (completionCountdown <= 0) {
      router.push("/doctor/home")
      return
    }

    const timer = window.setTimeout(() => {
      setCompletionCountdown((prev) => prev - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [showCompletionState, completionCountdown, router])

  const handleInputChange = <K extends keyof typeof formData>(field: K, value: (typeof formData)[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof typeof formData) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const fieldToCategory: Record<string, MediaCategory> = {
          profile_photo_url: "profile_photo",
          bmdc_document_url: "doctor_document",
          degree_certificates_url: "doctor_document",
          affiliation_letter_url: "doctor_document",
        }

        const category = fieldToCategory[field] || "general"

        try {
          const result = await uploadMediaFile({
            file,
            category,
            entityType: "doctor_onboarding",
            visibility: "public",
          })
          handleInputChange(field, result.url || result.file.public_url || "")
          alert("File uploaded successfully!")
        } catch {
          // Fallback for compatibility with existing environments
          const formDataUpload = new FormData()
          formDataUpload.append("file", file)
          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/upload/`, {
            method: 'POST',
            body: formDataUpload,
          })
          if (res.ok) {
            const data = await res.json()
            handleInputChange(field, data.url)
            alert("File uploaded successfully!")
          } else {
            alert("Upload failed")
          }
        }
      } catch (err) {
        console.error(err)
        alert("Upload error")
      }
    }
  }

  // Education helpers
  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { degree: "", institution: "", year: "", country: "Bangladesh" }]
    }))
  }

  const updateEducation = (index: number, field: keyof Education, value: string) => {
    const newEducation = [...formData.education]
    newEducation[index][field] = value
    setFormData(prev => ({ ...prev, education: newEducation }))
  }

  const removeEducation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      education: prev.education.filter((_, i) => i !== index)
    }))
  }

  // Work experience helpers
  const addWorkExperience = () => {
    setFormData(prev => ({
      ...prev,
      workExperience: [...prev.workExperience, { position: "", hospital: "", from_year: "", to_year: "", current: false }]
    }))
  }

  const updateWorkExperience = <K extends keyof WorkExperience>(
    index: number,
    field: K,
    value: WorkExperience[K]
  ) => {
    const newExp = [...formData.workExperience]
    newExp[index][field] = value
    setFormData(prev => ({ ...prev, workExperience: newExp }))
  }

  const removeWorkExperience = (index: number) => {
    setFormData(prev => ({
      ...prev,
      workExperience: prev.workExperience.filter((_, i) => i !== index)
    }))
  }

  // Services helpers
  const addService = () => {
    if (formData.newService.trim()) {
      setFormData(prev => ({
        ...prev,
        services: [...prev.services, prev.newService.trim()],
        newService: ""
      }))
    }
  }

  const removeService = (index: number) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.filter((_, i) => i !== index)
    }))
  }

  useEffect(() => {
    if (!initialLoading && formData.practiceLocations.length === 0) {
      setFormData(prev => ({
        ...prev,
        practiceLocations: [createPracticeLocation(true)],
      }))
    }
  }, [initialLoading, formData.practiceLocations.length])

  const updatePracticeLocation = (locationId: string, updates: Partial<PracticeLocation>) => {
    setFormData(prev => ({
      ...prev,
      practiceLocations: prev.practiceLocations.map(location =>
        location.id === locationId ? { ...location, ...updates } : location
      )
    }))
  }

  const addPracticeLocation = () => {
    setFormData(prev => ({
      ...prev,
      practiceLocations: [...prev.practiceLocations, createPracticeLocation(false)],
    }))
  }

  const removePracticeLocation = (locationId: string) => {
    setFormData(prev => {
      const filtered = prev.practiceLocations.filter(location => location.id !== locationId)
      if (filtered.length > 0 && !filtered.some(location => location.isPrimary)) {
        filtered[0] = { ...filtered[0], isPrimary: true, locationType: "HOSPITAL" }
      }

      return {
        ...prev,
        practiceLocations: filtered,
      }
    })
  }

  const setPrimaryLocation = (locationId: string) => {
    setFormData(prev => ({
      ...prev,
      practiceLocations: prev.practiceLocations.map(location => {
        const isPrimary = location.id === locationId
        return {
          ...location,
          isPrimary,
          locationType: isPrimary ? "HOSPITAL" : location.locationType,
        }
      }),
    }))
  }

  const selectedMapLocation = formData.practiceLocations.find(location => location.id === mapPickerLocationId)
  const selectedScheduleLocation = formData.practiceLocations.find(location => location.id === scheduleLocationId)

  const preparePayload = () => {
    const normalizedPracticeLocations = formData.practiceLocations
      .filter(location => location.locationName.trim() || location.locationText.trim() || location.address.trim())
      .map((location, index) => {
        const fallbackDaySlots = location.dayTimeSlots && Object.keys(location.dayTimeSlots).length > 0
          ? location.dayTimeSlots
          : formData.dayTimeSlots

        return {
          id: location.id,
          location_name: location.locationName.trim(),
          location_type: location.locationType,
          location_text: location.locationText.trim() || [
            location.locationName,
            location.address,
            location.city,
            location.country || "Bangladesh",
          ].filter(Boolean).join(", "),
          display_name: location.displayName,
          address: location.address,
          city: location.city,
          country: location.country || "Bangladesh",
          latitude: location.latitude,
          longitude: location.longitude,
          available_days: location.availableDays.length > 0 ? location.availableDays : Object.keys(fallbackDaySlots || {}),
          day_time_slots: fallbackDaySlots,
          appointment_duration: location.appointmentDuration || (formData.appointmentDuration ? parseInt(formData.appointmentDuration) : undefined),
          is_primary: location.isPrimary || index === 0,
        }
      })

    const primaryLocation = normalizedPracticeLocations.find(location => location.is_primary) || normalizedPracticeLocations[0]
    const secondaryLocation = normalizedPracticeLocations.find(location => location !== primaryLocation)

    return {
      first_name: formData.firstName,
      last_name: formData.lastName,
      title: formData.title,
      gender: formData.gender,
      dob: formData.dob,
      phone: formData.phone,
      email: formData.email,
      nid_number: formData.nidNumber,
      profile_photo_url: formData.profile_photo_url,
      
      registration_number: formData.registrationNumber,
      bmdc_document_url: formData.bmdc_document_url,
      qualifications: formData.qualifications,
      degree: formData.degree,
      degree_certificates_url: formData.degree_certificates_url,
      education: formData.education,
      
      speciality_id: formData.specialityId ? parseInt(formData.specialityId) : null,
      specialization: formData.specialization,
      sub_specializations: formData.subSpecializations,
      services: formData.services,
      
      experience: formData.experience,
      work_experience: formData.workExperience,
      
      hospital_name: primaryLocation?.location_name || formData.hospitalName,
      hospital_address: primaryLocation?.address || formData.hospitalAddress,
      hospital_city: primaryLocation?.city || formData.hospitalCity,
      hospital_country: primaryLocation?.country || formData.hospitalCountry,
      chamber_name: secondaryLocation?.location_name || formData.chamberName,
      chamber_address: secondaryLocation?.address || formData.chamberAddress,
      chamber_city: secondaryLocation?.city || formData.chamberCity,
      practice_locations: normalizedPracticeLocations,
      practice_location: formData.practiceLocation,
      consultation_mode: formData.consultationMode,
      affiliation_letter_url: formData.affiliation_letter_url,
      institution: formData.institution,
      
      consultation_fee: formData.consultationFee,
      follow_up_fee: formData.followUpFee,
      visiting_hours: formData.visitingHours,
      available_days: formData.availableDays,
      time_slots: formData.timeSlots,
      day_time_slots: formData.dayTimeSlots, // NEW: per-day schedules
      appointment_duration: formData.appointmentDuration ? parseInt(formData.appointmentDuration) : undefined,
      emergency_availability: formData.emergencyAvailability,
      emergency_contact: formData.emergencyContact,
      
      about: formData.about,
      
      language: formData.language,
      languages_spoken: formData.languagesSpoken,
      case_types: formData.caseTypes,
      ai_assistance: formData.aiAssistance,
      allow_patient_ai_visibility: formData.allowPatientAIVisibility,
      terms_accepted: formData.termsAccepted,
      telemedicine_available: formData.telemedicineAvailable,
      telemedicine_platforms: formData.telemedicinePlatforms,
    }
  }

  const nextStep = async () => {
    if (currentStep < STEPS.length) {
      if (currentStep === 5) {
        const validLocations = formData.practiceLocations.filter(location =>
          location.locationName.trim() || location.locationText.trim() || location.address.trim()
        )

        if (validLocations.length === 0) {
          alert("Add at least one practice location to continue.")
          return
        }

        const invalidLocation = validLocations.find(location => {
          const hasAddress = Boolean(location.address.trim() || location.locationText.trim())
          const hasCity = Boolean(location.city.trim())
          const hasCoords = Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
          return !location.locationName.trim() || !hasAddress || !hasCity || !hasCoords
        })

        if (invalidLocation) {
          alert("Each location must include name, address/city, and a map pin before continuing.")
          return
        }
      }

      try {
        await updateDoctorOnboarding(preparePayload())
        setCurrentStep((prev) => prev + 1)
        window.scrollTo(0, 0)
      } catch (error) {
        console.error("Failed to save progress", error)
      }
    } else {
      setLoading(true)
      try {
        await updateDoctorOnboarding(preparePayload())
        await completeOnboarding()
        setCompletionCountdown(3)
        setShowCompletionState(true)
      } catch (error) {
        console.error("Failed to complete onboarding", error)
      } finally {
        setLoading(false)
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo(0, 0)
    }
  }

  const handleSkipOnboarding = async () => {
    setLoading(true)
    try {
      // Skip onboarding WITHOUT marking it as completed
      // User can return later to complete their profile
      // Mark skip so middleware allows access to protected routes, but keep the banner showing
      document.cookie = "onboarding_skipped=true; path=/; max-age=604800"; // 7 days
      // Use window.location for hard navigation to ensure proper cookie refresh
      window.location.href = "/doctor/home"
    } catch (error) {
      console.error("Failed to skip onboarding", error)
      setLoading(false)
      setShowSkipDialog(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title/Designation</Label>
              <Select id="title" value={formData.title} onChange={(e) => handleInputChange("title", e.target.value)}>
                <option value="">Select Title</option>
                <option value="Dr.">Dr.</option>
                <option value="Prof. Dr.">Prof. Dr.</option>
                <option value="Assoc. Prof. Dr.">Assoc. Prof. Dr.</option>
                <option value="Asst. Prof. Dr.">Asst. Prof. Dr.</option>
                <option value="Brig. Gen. Dr.">Brig. Gen. Dr.</option>
                <option value="Maj. Gen. Dr.">Maj. Gen. Dr.</option>
                <option value="Col. Dr.">Col. Dr.</option>
                <option value="Lt. Col. Dr.">Lt. Col. Dr.</option>
              </Select>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} placeholder="Shubharthi" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} placeholder="Kar" />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select id="gender" value={formData.gender} onChange={(e) => handleInputChange("gender", e.target.value)}>
                <option value="">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input id="dob" type="date" value={formData.dob} onChange={(e) => handleInputChange("dob", e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="+880 1XXX XXXXXX" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="doctor@hospital.com" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="nidNumber">National ID Number (Optional)</Label>
              <Input id="nidNumber" value={formData.nidNumber} onChange={(e) => handleInputChange("nidNumber", e.target.value)} placeholder="NID Number" />
            </div>
            
            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Profile Photo (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="file" className="hidden" id="profile-photo-upload" onChange={(e) => handleFileUpload(e, "profile_photo_url")} />
                  <Label htmlFor="profile-photo-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.profile_photo_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
        
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">BMDC Registration Number *</Label>
              <Input id="registrationNumber" value={formData.registrationNumber} onChange={(e) => handleInputChange("registrationNumber", e.target.value)} placeholder="A-12345" />
            </div>
            
            <div className="rounded-lg border border-dashed p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload BMDC Certificate (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="file" className="hidden" id="bmdc-upload" onChange={(e) => handleFileUpload(e, "bmdc_document_url")} />
                  <Label htmlFor="bmdc-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.bmdc_document_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-2">
              <Label htmlFor="qualifications">Full Qualifications</Label>
              <Input id="qualifications" value={formData.qualifications} onChange={(e) => handleInputChange("qualifications", e.target.value)} placeholder="MBBS(CMC), BCS(Health), MD(Nephrology, BSMMU)" />
              <p className="text-xs text-muted-foreground">Enter all your degrees and qualifications separated by commas</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="degree">Primary Medical Degree</Label>
              <Select id="degree" value={formData.degree} onChange={(e) => handleInputChange("degree", e.target.value)}>
                <option value="">Select Primary Degree</option>
                <option value="MBBS">MBBS</option>
                <option value="BDS">BDS</option>
                <option value="BAMS">BAMS</option>
                <option value="BHMS">BHMS</option>
                <option value="BUMS">BUMS</option>
              </Select>
            </div>
            
            <div className="rounded-lg border border-dashed p-4 text-center">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Degree Certificates (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="file" className="hidden" id="degree-upload" onChange={(e) => handleFileUpload(e, "degree_certificates_url")} />
                  <Label htmlFor="degree-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.degree_certificates_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Education History</Label>
                <Button type="button" variant="outline" size="sm" onClick={addEducation}>
                  <Plus className="h-4 w-4 mr-1" /> Add Education
                </Button>
              </div>
              
              {formData.education.map((edu, index) => (
                <div key={index} className="relative grid gap-3 rounded-lg border p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeEducation(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Degree</Label>
                      <Input value={edu.degree} onChange={(e) => updateEducation(index, "degree", e.target.value)} placeholder="MD (Nephrology)" />
                    </div>
                    <div className="space-y-2">
                      <Label>Year</Label>
                      <Input type="number" value={edu.year} onChange={(e) => updateEducation(index, "year", e.target.value)} placeholder="2015" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Institution</Label>
                    <Input value={edu.institution} onChange={(e) => updateEducation(index, "institution", e.target.value)} placeholder="BSMMU, Dhaka" />
                  </div>
                  <div className="space-y-2">
                    <Label>Country</Label>
                    <Input value={edu.country} onChange={(e) => updateEducation(index, "country", e.target.value)} placeholder="Bangladesh" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
        
      case 3:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialityId">Primary Specialization *</Label>
              <Select id="specialityId" value={formData.specialityId} onChange={(e) => handleInputChange("specialityId", e.target.value)}>
                <option value="">Select Specialization</option>
                {specialities.map((spec) => (
                  <option key={spec.id} value={spec.id.toString()}>
                    {spec.name}
                  </option>
                ))}
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Sub-Specializations (Optional)</Label>
              <div className="grid grid-cols-2 gap-2">
                {["Interventional Cardiology", "Pediatric Cardiology", "Neuro Surgery", "Spine Surgery", "Kidney Transplant", "Liver Transplant"].map((subSpec) => (
                  <div key={subSpec} className="flex items-center space-x-2">
                    <Checkbox
                      id={subSpec}
                      checked={formData.subSpecializations.includes(subSpec)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleInputChange("subSpecializations", [...formData.subSpecializations, subSpec])
                        } else {
                          handleInputChange("subSpecializations", formData.subSpecializations.filter(s => s !== subSpec))
                        }
                      }}
                    />
                    <Label htmlFor={subSpec} className="text-sm">{subSpec}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <Label>Services Offered</Label>
              <div className="flex gap-2">
                <Input value={formData.newService} onChange={(e) => handleInputChange("newService", e.target.value)} placeholder="Add a service (e.g., Dialysis, Kidney Biopsy)" onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())} />
                <Button type="button" variant="outline" onClick={addService}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {formData.services.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.services.map((service, index) => (
                    <div key={index} className="flex items-center gap-1 bg-secondary/50 rounded-full px-3 py-1">
                      <span className="text-sm">{service}</span>
                      <button type="button" onClick={() => removeService(index)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
        
      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience *</Label>
              <Input id="experience" type="number" value={formData.experience} onChange={(e) => handleInputChange("experience", e.target.value)} placeholder="19" />
            </div>
            
            <Separator className="my-4" />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Work Experience History</Label>
                <Button type="button" variant="outline" size="sm" onClick={addWorkExperience}>
                  <Plus className="h-4 w-4 mr-1" /> Add Position
                </Button>
              </div>
              
              {formData.workExperience.map((exp, index) => (
                <div key={index} className="relative grid gap-3 rounded-lg border p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeWorkExperience(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="space-y-2">
                    <Label>Position/Designation</Label>
                    <Input value={exp.position} onChange={(e) => updateWorkExperience(index, "position", e.target.value)} placeholder="Associate Professor" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hospital/Institution</Label>
                    <Input value={exp.hospital} onChange={(e) => updateWorkExperience(index, "hospital", e.target.value)} placeholder="Mount Adora Hospital" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>From Year</Label>
                      <Input type="number" value={exp.from_year} onChange={(e) => updateWorkExperience(index, "from_year", e.target.value)} placeholder="2015" />
                    </div>
                    <div className="space-y-2">
                      <Label>To Year</Label>
                      <Input type="number" value={exp.to_year} onChange={(e) => updateWorkExperience(index, "to_year", e.target.value)} placeholder="2023" disabled={exp.current} />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id={`current-${index}`} checked={exp.current} onCheckedChange={(checked) => updateWorkExperience(index, "current", checked === true)} />
                    <Label htmlFor={`current-${index}`}>Currently working here</Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
        
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium">Practice Locations</h4>
              <p className="text-xs text-muted-foreground">
                Add every chamber/clinic where you consult. Pin each one on the map so patients can discover you accurately.
              </p>
            </div>

            <div className="space-y-4">
              {formData.practiceLocations.map((location, index) => (
                <div key={location.id} className="space-y-4 rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">
                      {location.isPrimary ? "Primary Practice" : `Practice Location ${index + 1}`}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!location.isPrimary && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setPrimaryLocation(location.id)}>
                          Make Primary
                        </Button>
                      )}
                      {formData.practiceLocations.length > 1 && (
                        <Button type="button" variant="destructive" size="sm" onClick={() => removePracticeLocation(location.id)}>
                          <Trash2 className="mr-1 h-4 w-4" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Location Name</Label>
                      <Input
                        value={location.locationName}
                        onChange={(e) => updatePracticeLocation(location.id, { locationName: e.target.value })}
                        placeholder="Apollo Hospital, Dhanmondi"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Location Type</Label>
                      <Select
                        value={location.locationType}
                        onChange={(e) => updatePracticeLocation(location.id, { locationType: e.target.value })}
                      >
                        <option value="HOSPITAL">Hospital</option>
                        <option value="CLINIC">Clinic</option>
                        <option value="CHAMBER">Chamber</option>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Manual Address</Label>
                    <Input
                      value={location.address}
                      onChange={(e) => updatePracticeLocation(location.id, { address: e.target.value })}
                      placeholder="Road, Area, Landmark"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>City</Label>
                      <Input
                        value={location.city}
                        onChange={(e) => updatePracticeLocation(location.id, { city: e.target.value })}
                        placeholder="Dhaka"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input
                        value={location.country}
                        onChange={(e) => updatePracticeLocation(location.id, { country: e.target.value })}
                        placeholder="Bangladesh"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-accent/40 px-3 py-2 text-xs">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    {Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
                      ? `Pinned: ${location.latitude?.toFixed(6)}, ${location.longitude?.toFixed(6)}`
                      : "No map pin selected yet"}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setMapPickerLocationId(location.id)}>
                      <MapPin className="mr-1 h-4 w-4" /> Pick on Map
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => setScheduleLocationId(location.id)}>
                      Set Availability
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addPracticeLocation} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Add Another Chamber
            </Button>

            <Separator className="my-4" />
            
            <div className="space-y-2">
              <Label htmlFor="consultationMode">Consultation Mode</Label>
              <Select id="consultationMode" value={formData.consultationMode} onChange={(e) => handleInputChange("consultationMode", e.target.value)}>
                <option value="online">Online Only</option>
                <option value="in-person">In-Person Only</option>
                <option value="both">Both</option>
              </Select>
            </div>
            
            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Affiliation Letter (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="file" className="hidden" id="affiliation-upload" onChange={(e) => handleFileUpload(e, "affiliation_letter_url")} />
                  <Label htmlFor="affiliation-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.affiliation_letter_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
        
      case 6:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="consultationFee">Consultation Fee (BDT)</Label>
                <Input id="consultationFee" type="number" value={formData.consultationFee} onChange={(e) => handleInputChange("consultationFee", e.target.value)} placeholder="1000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="followUpFee">Follow-up Fee (BDT)</Label>
                <Input id="followUpFee" type="number" value={formData.followUpFee} onChange={(e) => handleInputChange("followUpFee", e.target.value)} placeholder="500" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="visitingHours">Visiting Hours (optional)</Label>
              <Input id="visitingHours" value={formData.visitingHours} onChange={(e) => handleInputChange("visitingHours", e.target.value)} placeholder="Sat Sun Mon Tue Wed 03:00 PM - 08:00 PM" />
              <p className="text-xs text-muted-foreground">Example: Sat Sun Mon Tue Wed 03:00 PM - 08:00 PM</p>
            </div>

            {/* Use ScheduleSetter for structured time slot input */}
            <div className="space-y-2">
              <Label>Set Your Weekly Schedule</Label>
              <p className="text-xs text-muted-foreground">Use the structured schedule editor to add multiple ranges per day. This helps ensure consistent time slot parsing.</p>

              <div className="mt-4">
                <ScheduleSetter
                  initialDayTimeSlots={formData.dayTimeSlots}
                  initialAvailableDays={formData.availableDays}
                  initialTimeSlots={formData.timeSlots}
                  appointmentDuration={parseInt(formData.appointmentDuration || '30')}
                  onSave={async (dayTimeSlots, duration) => {
                    // Create updated form data locally to ensure synchronous payload creation
                    const updatedFormData = {
                      ...formData,
                      dayTimeSlots: dayTimeSlots,
                      availableDays: Object.keys(dayTimeSlots),
                      appointmentDuration: duration.toString()
                    };
                    
                    // Update state
                    setFormData(updatedFormData);
                    
                    // Prepare payload with the updated local object instead of state
                    const payload = {
                      onboarding_completed: false, // Don't mark complete yet
                      
                      // ... map other fields from updatedFormData
                      first_name: updatedFormData.firstName,
                      last_name: updatedFormData.lastName,
                      phone: updatedFormData.phone,
                      
                      title: updatedFormData.title,
                      gender: updatedFormData.gender,
                      dob: updatedFormData.dob,
                      profile_photo_url: updatedFormData.profile_photo_url,
                      nid_number: updatedFormData.nidNumber,
                      
                      registration_number: updatedFormData.registrationNumber,
                      bmdc_document_url: updatedFormData.bmdc_document_url,
                      qualifications: updatedFormData.qualifications,
                      degree: updatedFormData.degree,
                      degree_certificates_url: updatedFormData.degree_certificates_url,
                      education: updatedFormData.education,
                      
                      speciality_id: updatedFormData.specialityId ? parseInt(updatedFormData.specialityId) : undefined,
                      specialization: updatedFormData.specialization,
                      sub_specializations: updatedFormData.subSpecializations,
                      services: updatedFormData.services,
                      
                      experience: updatedFormData.experience,
                      work_experience: updatedFormData.workExperience,
                      
                      hospital_name: updatedFormData.hospitalName,
                      hospital_address: updatedFormData.hospitalAddress,
                      hospital_city: updatedFormData.hospitalCity,
                      hospital_country: updatedFormData.hospitalCountry,
                      
                      chamber_name: updatedFormData.chamberName,
                      chamber_address: updatedFormData.chamberAddress,
                      chamber_city: updatedFormData.chamberCity,
                      
                      consultation_fee: updatedFormData.consultationFee,
                      follow_up_fee: updatedFormData.followUpFee,
                      visiting_hours: updatedFormData.visitingHours,
                      available_days: updatedFormData.availableDays, // Use updated available days
                      time_slots: updatedFormData.timeSlots,
                      day_time_slots: updatedFormData.dayTimeSlots, // Use updated day slots
                      appointment_duration: updatedFormData.appointmentDuration ? parseInt(updatedFormData.appointmentDuration) : undefined,
                      emergency_availability: updatedFormData.emergencyAvailability,
                      emergency_contact: updatedFormData.emergencyContact,
                      
                      about: updatedFormData.about,
                      
                      language: updatedFormData.language,
                      languages_spoken: updatedFormData.languagesSpoken,
                      case_types: updatedFormData.caseTypes,
                      ai_assistance: updatedFormData.aiAssistance,
                      allow_patient_ai_visibility: updatedFormData.allowPatientAIVisibility,
                      terms_accepted: updatedFormData.termsAccepted,
                      telemedicine_available: updatedFormData.telemedicineAvailable,
                      telemedicine_platforms: updatedFormData.telemedicinePlatforms,
                    };

                    try {
                      await updateDoctorOnboarding(payload)
                    } catch (e) {
                      console.error('Failed to save schedule during onboarding', e)
                      alert('Failed to save schedule')
                    }
                  }}
                />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex items-center space-x-2">
              <Checkbox id="emergencyAvailability" checked={formData.emergencyAvailability} onCheckedChange={(checked) => handleInputChange("emergencyAvailability", checked === true)} />
              <Label htmlFor="emergencyAvailability">Available for Emergencies</Label>
            </div>

            {formData.emergencyAvailability && (
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Emergency Contact Number</Label>
                <Input id="emergencyContact" type="tel" value={formData.emergencyContact} onChange={(e) => handleInputChange("emergencyContact", e.target.value)} placeholder="+880 1XXX XXXXXX" />
              </div>
            )}
          </div>
        )
        
      case 7:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="about">About / Professional Bio</Label>
              <Textarea
                id="about"
                value={formData.about}
                onChange={(e) => handleInputChange("about", e.target.value)}
                placeholder="Write about your professional background, expertise, achievements, and what patients can expect..."
                className="min-h-50"
              />
              <p className="text-xs text-muted-foreground">
                This will be displayed on your public profile. Include your expertise, achievements, and any special interests.
              </p>
            </div>
          </div>
        )
        
      case 8:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="language">Primary Language</Label>
              <Select id="language" value={formData.language} onChange={(e) => handleInputChange("language", e.target.value)}>
                <option value="English">English</option>
                <option value="Bengali">Bengali</option>
                <option value="Hindi">Hindi</option>
                <option value="Arabic">Arabic</option>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Languages Spoken</Label>
              <div className="flex flex-wrap gap-2">
                {["Bengali", "English", "Hindi", "Arabic", "Urdu"].map((lang) => (
                  <div key={lang} className="flex items-center space-x-2">
                    <Checkbox
                      id={`lang-${lang}`}
                      checked={formData.languagesSpoken.includes(lang)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleInputChange("languagesSpoken", [...formData.languagesSpoken, lang])
                        } else {
                          handleInputChange("languagesSpoken", formData.languagesSpoken.filter(l => l !== lang))
                        }
                      }}
                    />
                    <Label htmlFor={`lang-${lang}`} className="text-sm">{lang}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="caseTypes">Case Types Handled</Label>
              <Input id="caseTypes" value={formData.caseTypes} onChange={(e) => handleInputChange("caseTypes", e.target.value)} placeholder="e.g. General, Emergency, Surgery" />
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h4 className="font-medium">Telemedicine</h4>
              <div className="flex items-center space-x-2">
                <Checkbox id="telemedicineAvailable" checked={formData.telemedicineAvailable} onCheckedChange={(checked) => handleInputChange("telemedicineAvailable", checked === true)} />
                <Label htmlFor="telemedicineAvailable">I offer telemedicine consultations</Label>
              </div>
              
              {formData.telemedicineAvailable && (
                <div className="space-y-2 ml-6">
                  <Label>Platforms Used</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Zoom", "Google Meet", "WhatsApp Video", "Skype", "Custom Platform"].map((platform) => (
                      <div key={platform} className="flex items-center space-x-2">
                        <Checkbox
                          id={`platform-${platform}`}
                          checked={formData.telemedicinePlatforms.includes(platform)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              handleInputChange("telemedicinePlatforms", [...formData.telemedicinePlatforms, platform])
                            } else {
                              handleInputChange("telemedicinePlatforms", formData.telemedicinePlatforms.filter(p => p !== platform))
                            }
                          }}
                        />
                        <Label htmlFor={`platform-${platform}`} className="text-sm">{platform}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <Separator />

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Consent & Terms</h4>
              <div className="flex items-start space-x-2">
                <Checkbox id="aiAssistance" checked={formData.aiAssistance} onCheckedChange={(checked) => handleInputChange("aiAssistance", checked === true)} />
                <Label htmlFor="aiAssistance" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to use AI assistance for preliminary diagnosis support. I understand that AI suggestions are advisory only.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="allowPatientAIVisibility" checked={formData.allowPatientAIVisibility} onCheckedChange={(checked) => handleInputChange("allowPatientAIVisibility", checked === true)} />
                <Label htmlFor="allowPatientAIVisibility" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I allow patients to view my identity in patient-facing Chorui AI care-team responses.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="termsAccepted" checked={formData.termsAccepted} onCheckedChange={(checked) => handleInputChange("termsAccepted", checked === true)} />
                <Label htmlFor="termsAccepted" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I accept the Terms of Service and Professional Responsibilities. I confirm that all information provided is accurate.
                </Label>
              </div>
            </div>
          </div>
        )
        
      default:
        return null
    }
  }

  if (initialLoading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <MedoraLoader size="md" label="Loading your profile..." />
      </div>
    )
  }

  if (showCompletionState) {
    return (
      <div className="mx-auto flex w-full max-w-2xl px-2 py-8 sm:px-4">
        <Card className="w-full border-border bg-card shadow-xl">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-9 w-9 text-success" />
            </div>
            <CardTitle className="text-xl sm:text-2xl">Doctor Profile Ready</CardTitle>
            <CardDescription>
              Onboarding is complete. Patients can now discover your profile, locations, and consultation availability.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Redirecting to your home dashboard in {completionCountdown} seconds...</p>
            <Button onClick={() => router.push("/doctor/home")} className="w-full sm:w-auto" variant="medical">
              Go to Doctor Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-1 sm:px-2">
      <div className="space-y-6">
        {currentStep === 1 && (
          <Card className="border-primary/20 bg-primary-more-light/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Set up your doctor profile in about {DOCTOR_ONBOARDING_TIME_ESTIMATE}</CardTitle>
              <CardDescription className="text-foreground/90">{DOCTOR_ONBOARDING_AHA}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid gap-2 text-sm text-foreground/90 sm:grid-cols-3">
                <p>1. Confirm identity and credentials</p>
                <p>2. Add chambers and map locations</p>
                <p>3. Set fees, schedule, and finish consent</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setShowSkipDialog(true)}>
                  Skip for now
                </Button>
                <p className="text-xs text-muted-foreground">You can finish onboarding later from settings.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={(id) => setCurrentStep(id)} />

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="border-border shadow-xl bg-card">
              <CardHeader>
                <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                <CardDescription className="space-y-1">
                  <span className="block">Step {currentStep} of {STEPS.length}</span>
                  <span className="block text-xs">{DOCTOR_STEP_GUIDANCE[currentStep]}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderStepContent()}
              </CardContent>
              <CardFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button variant="outline" onClick={prevStep} disabled={currentStep === 1 || loading} className="w-full sm:w-auto">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowSkipDialog(true)} 
                    disabled={loading}
                    className="w-full text-muted-foreground hover:text-foreground sm:w-auto"
                  >
                    Skip for Now
                  </Button>
                </div>
                <Button onClick={nextStep} disabled={loading} className="w-full sm:w-auto">
                  {loading ? "Completing..." : (currentStep === STEPS.length ? "Complete Onboarding" : "Next")} 
                  {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>

        <Dialog open={Boolean(mapPickerLocationId)} onOpenChange={(open) => !open && setMapPickerLocationId(null)}>
          <DialogContent fullScreenOnMobile className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Pick Practice Location on Map</DialogTitle>
              <DialogDescription>
                Search by address if possible, then drag the pin if needed. Coordinates are required for discoverability.
              </DialogDescription>
            </DialogHeader>

            {selectedMapLocation && (
              <div className="space-y-4">
                <LocationPicker
                  label={selectedMapLocation.locationName || "Practice location"}
                  value={{
                    address: selectedMapLocation.address,
                    city: selectedMapLocation.city,
                    latitude: selectedMapLocation.latitude,
                    longitude: selectedMapLocation.longitude,
                  }}
                  onChange={(picked) => {
                    updatePracticeLocation(selectedMapLocation.id, {
                      address: picked.address,
                      city: picked.city,
                      latitude: picked.latitude,
                      longitude: picked.longitude,
                      locationText: [
                        selectedMapLocation.locationName,
                        picked.address,
                        picked.city,
                        selectedMapLocation.country || "Bangladesh",
                      ].filter(Boolean).join(", "),
                    })
                  }}
                />

                <div className="flex justify-end">
                  <Button type="button" onClick={() => setMapPickerLocationId(null)}>Done</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(scheduleLocationId)} onOpenChange={(open) => !open && setScheduleLocationId(null)}>
          <DialogContent fullScreenOnMobile className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Set Location Availability</DialogTitle>
              <DialogDescription>
                Define weekly availability for this specific chamber/clinic.
              </DialogDescription>
            </DialogHeader>

            {selectedScheduleLocation && (
              <ScheduleSetter
                initialDayTimeSlots={selectedScheduleLocation.dayTimeSlots}
                initialAvailableDays={selectedScheduleLocation.availableDays}
                initialTimeSlots={formData.timeSlots}
                appointmentDuration={selectedScheduleLocation.appointmentDuration || parseInt(formData.appointmentDuration || "30")}
                onSave={async (dayTimeSlots, duration) => {
                  updatePracticeLocation(selectedScheduleLocation.id, {
                    dayTimeSlots,
                    availableDays: Object.keys(dayTimeSlots),
                    appointmentDuration: duration,
                  })
                  setScheduleLocationId(null)
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Skip Onboarding Confirmation Dialog */}
        {showSkipDialog && (
          <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <Card className="max-h-[90dvh] w-full max-w-md overflow-y-auto bg-card">
              <CardHeader>
                <CardTitle className="text-black">Skip Onboarding?</CardTitle>
                <CardDescription className="text-foreground">
                  You can complete your profile information later from your dashboard settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Having a complete profile helps patients find and trust you. We recommend completing all sections.
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSkipDialog(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={handleSkipOnboarding}
                  disabled={loading}
                >
                  {loading ? "Skipping..." : "Skip Onboarding"}
                </Button>
              </CardFooter>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}


