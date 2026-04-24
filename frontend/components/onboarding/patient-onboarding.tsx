"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select-native"
import { RadioGroup } from "@/components/ui/radio-group-native"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { MedicationManager, type Medication } from "@/components/medicine"
import { MedicalTestSearch } from "@/components/medical-test"
import { MedoraLoader } from "@/components/ui/medora-loader"
import { updatePatientOnboarding, completeOnboarding, getPatientOnboardingData } from "@/lib/auth-actions"
import { uploadMediaFile, type MediaCategory } from "@/lib/file-storage-actions"
import {
  toBackendPatientMedication,
  toPatientMedication,
  type BackendPatientMedication,
} from "@/lib/patient-medication"
import { useRouter } from "next/navigation"
import { useT } from "@/i18n/client"
import { getOnboardingStrings } from "./onboarding-i18n"
import { cn } from "@/lib/utils"

const translatedSteps = [
  { id: 1, title: "Personal Identity", shortName: "Identity" },
  { id: 2, title: "Physical & Address", shortName: "Profile" },
  { id: 3, title: "Chronic Conditions", shortName: "Conditions" },
  { id: 4, title: "Medications & Allergies", shortName: "Meds" },
  { id: 5, title: "Medical History", shortName: "History" },
  { id: 6, title: "Family History", shortName: "Family" },
  { id: 7, title: "Lifestyle & Mental Health", shortName: "Lifestyle" },
  { id: 8, title: "Preferences & Consent", shortName: "Consent" },
]

type ChronicConditionKey =
  | "hasDiabetes"
  | "hasHypertension"
  | "hasHeartDisease"
  | "hasAsthma"
  | "hasCancer"
  | "hasThyroid"
  | "hasKidneyDisease"
  | "hasLiverDisease"
  | "hasArthritis"
  | "hasStroke"
  | "hasEpilepsy"
  | "hasMentalHealth"

type FamilyHistoryConditionKey =
  | "familyHasDiabetes"
  | "familyHasHeartDisease"
  | "familyHasCancer"
  | "familyHasHypertension"
  | "familyHasStroke"
  | "familyHasAsthma"
  | "familyHasThalassemia"
  | "familyHasBloodDisorders"
  | "familyHasMentalHealth"
  | "familyHasKidneyDisease"
  | "familyHasThyroid"

type HistoryAccordionSection = "surgeries" | "hospitalizations" | "vaccinations" | "medicalTests"
type LifestyleAccordionSection = "substance" | "activitySleep" | "diet" | "mentalHealth"

const translatedChronicConditions: Array<{ key: ChronicConditionKey; label: string }> = [
  { key: "hasDiabetes", label: "Diabetes" },
  { key: "hasHypertension", label: "Hypertension (High BP)" },
  { key: "hasHeartDisease", label: "Heart Disease" },
  { key: "hasAsthma", label: "Asthma" },
  { key: "hasCancer", label: "Cancer" },
  { key: "hasThyroid", label: "Thyroid Disorder" },
  { key: "hasKidneyDisease", label: "Kidney Disease" },
  { key: "hasLiverDisease", label: "Liver Disease" },
  { key: "hasArthritis", label: "Arthritis" },
  { key: "hasStroke", label: "Stroke History" },
  { key: "hasEpilepsy", label: "Epilepsy" },
  { key: "hasMentalHealth", label: "Mental Health Condition" },
]

const translatedFamilyHistory: Array<{ key: FamilyHistoryConditionKey; label: string }> = [
  { key: "familyHasDiabetes", label: "Diabetes" },
  { key: "familyHasHeartDisease", label: "Heart Disease" },
  { key: "familyHasCancer", label: "Cancer" },
  { key: "familyHasHypertension", label: "Hypertension" },
  { key: "familyHasStroke", label: "Stroke" },
  { key: "familyHasAsthma", label: "Asthma" },
  { key: "familyHasThalassemia", label: "Thalassemia" },
  { key: "familyHasBloodDisorders", label: "Blood Disorders" },
  { key: "familyHasMentalHealth", label: "Mental Health Conditions" },
  { key: "familyHasKidneyDisease", label: "Kidney Disease" },
  { key: "familyHasThyroid", label: "Thyroid Disorders" },
]

const VISIBLE_CHRONIC_CONDITION_COUNT = 6
const VISIBLE_FAMILY_HISTORY_COUNT = 6
const PATIENT_ONBOARDING_TIME_ESTIMATE = "8-10 minutes"
const PATIENT_ONBOARDING_AHA = "Complete this once and doctors can review your history faster in every future consultation."
const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const translatedStepGuidance: Record<number, string> = {
  1: "Basic identity details so your records stay accurate.",
  2: "Physical profile and address details for better care context.",
  3: "Common chronic conditions first, advanced history only if needed.",
  4: "Current medicines and allergies that affect treatment safety.",
  5: "Key medical history with optional deeper records.",
  6: "Important family conditions linked to long-term risk.",
  7: "Lifestyle signals that help care feel more personalized.",
  8: "Preferences, emergency contacts, and consent choices.",
}

const ONBOARDING_ACCORDION_TRIGGER_CLASS =
  "rounded-md px-2 py-3 text-left transition-colors duration-200 hover:bg-muted/40 hover:no-underline motion-reduce:transition-none"

interface DrugAllergy {
  drug_name: string
  reaction: string
  severity: string
}

interface Surgery {
  name: string
  year: string
  hospital: string
}

interface Hospitalization {
  reason: string
  year: string
  duration: string
}

interface Vaccination {
  name: string
  date: string
  next_due: string
}

interface MedicalTest {
  test_name: string
  test_id?: number
  test_date: string
  result: string
  result_value: string
  result_unit: string
  normal_range: string
  status: string
  prescribing_doctor: string
  hospital_lab: string
  notes: string
  document_url: string
}

export function PatientOnboarding() {
  const t = useT("onboarding")
  const strings = getOnboardingStrings(t)
  const translatedSteps = React.useMemo(() => strings.getSteps(), [strings])
  const translatedChronicConditions = React.useMemo(() => strings.getChronicConditions(), [strings])
  const translatedFamilyHistory = React.useMemo(() => strings.getFamilyHistory(), [strings])
  const translatedStepGuidance = React.useMemo(() => strings.getStepGuidance(), [strings])
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [showCompletionState, setShowCompletionState] = useState(false)
  const [completionCountdown, setCompletionCountdown] = useState(3)
  const [showAllChronicConditions, setShowAllChronicConditions] = useState(false)
  const [showAllFamilyHistoryConditions, setShowAllFamilyHistoryConditions] = useState(false)
  const [historyAccordionValue, setHistoryAccordionValue] = useState<HistoryAccordionSection[]>([])
  const [lifestyleAccordionValue, setLifestyleAccordionValue] = useState<LifestyleAccordionSection[]>(["substance"])
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [stepError, setStepError] = useState<string | null>(null)
  const [hasAttemptedContinue, setHasAttemptedContinue] = useState(false)
  const router = useRouter()
  const [formData, setFormData] = useState({
    // Step 1 - Personal Identity
    firstName: "",
    lastName: "",
    dob: "",
    gender: "",
    phone: "",
    email: "",
    nidNumber: "",
    profile_photo_url: "",
    maritalStatus: "",
    
    // Step 2 - Physical & Address
    height: "",
    weight: "",
    bloodGroup: "",
    address: "",
    district: "",
    postalCode: "",
    city: "",
    country: "Bangladesh",
    occupation: "",
    medical_summary_url: "",
    
    // Step 3 - Chronic Conditions (checkboxes)
    hasDiabetes: false,
    hasHypertension: false,
    hasHeartDisease: false,
    hasAsthma: false,
    hasCancer: false,
    hasThyroid: false,
    hasKidneyDisease: false,
    hasLiverDisease: false,
    hasArthritis: false,
    hasStroke: false,
    hasEpilepsy: false,
    hasMentalHealth: false,
    otherConditions: "",
    conditionDetails: "",
    
    // Step 4 - Medications & Allergies
    takingMeds: "no",
    medications: [] as Medication[],
    drugAllergies: [] as DrugAllergy[],
    foodAllergies: "",
    environmentalAllergies: "",
    
    // Step 5 - Medical History
    surgeries: [] as Surgery[],
    hospitalizations: [] as Hospitalization[],
    ongoingTreatments: "no",
    ongoingTreatmentDetails: "",
    previousDoctors: "",
    lastCheckupDate: "",
    vaccinations: [] as Vaccination[],
    hasMedicalTests: "no",
    medicalTests: [] as MedicalTest[],
    
    // Step 6 - Family History
    familyHasDiabetes: false,
    familyHasHeartDisease: false,
    familyHasCancer: false,
    familyHasHypertension: false,
    familyHasStroke: false,
    familyHasAsthma: false,
    familyHasThalassemia: false,
    familyHasBloodDisorders: false,
    familyHasMentalHealth: false,
    familyHasKidneyDisease: false,
    familyHasThyroid: false,
    familyHistoryNotes: "",
    
    // Step 7 - Lifestyle & Mental Health
    smoking: "never",
    smokingAmount: "",
    alcohol: "never",
    alcoholFrequency: "",
    activityLevel: "moderate",
    exerciseType: "",
    sleepDuration: "",
    sleepQuality: "",
    stressLevel: "moderate",
    diet: "omnivore",
    dietaryRestrictions: "",
    waterIntake: "",
    caffeine: "moderate",
    mentalHealthConcerns: "",
    currentlyInTherapy: false,
    
    // Step 8 - Preferences & Consent
    language: "English",
    languagesSpoken: [] as string[],
    notifications: true,
    preferredContactMethod: "phone",
    emergencyName: "",
    emergencyRelation: "",
    emergencyPhone: "",
    secondaryEmergencyName: "",
    secondaryEmergencyPhone: "",
    consentStorage: false,
    consentAI: false,
    consentDoctor: false,
    consentResearch: false,
  })

  // Fetch existing data on mount
  useEffect(() => {
    async function fetchExistingData() {
      try {
        const data = await getPatientOnboardingData()
        if (data) {
          setFormData(prev => ({
            ...prev,
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            dob: data.dob || "",
            gender: data.gender || "",
            phone: data.phone || "",
            email: data.email || "",
            nidNumber: data.nid_number || "",
            profile_photo_url: data.profile_photo_url || "",
            maritalStatus: data.marital_status || "",
            
            height: data.height?.toString() || "",
            weight: data.weight?.toString() || "",
            bloodGroup: data.blood_group || "",
            address: data.address || "",
            district: data.district || "",
            postalCode: data.postal_code || "",
            city: data.city || "",
            country: data.country || "Bangladesh",
            occupation: data.occupation || "",
            medical_summary_url: data.medical_summary_url || "",
            
            hasDiabetes: data.has_diabetes || false,
            hasHypertension: data.has_hypertension || false,
            hasHeartDisease: data.has_heart_disease || false,
            hasAsthma: data.has_asthma || false,
            hasCancer: data.has_cancer || false,
            hasThyroid: data.has_thyroid || false,
            hasKidneyDisease: data.has_kidney_disease || false,
            hasLiverDisease: data.has_liver_disease || false,
            hasArthritis: data.has_arthritis || false,
            hasStroke: data.has_stroke || false,
            hasEpilepsy: data.has_epilepsy || false,
            hasMentalHealth: data.has_mental_health || false,
            otherConditions: data.other_conditions || "",
            conditionDetails: data.condition_details || "",
            
            takingMeds: data.taking_meds ? "yes" : "no",
            medications: (data.medications || []).map((med: BackendPatientMedication) =>
              toPatientMedication(med),
            ),
            drugAllergies: data.drug_allergies || [],
            foodAllergies: data.food_allergies || "",
            environmentalAllergies: data.environmental_allergies || "",
            
            surgeries: data.surgeries || [],
            hospitalizations: data.hospitalizations || [],
            ongoingTreatments: data.ongoing_treatments || "no",
            ongoingTreatmentDetails: data.ongoing_treatment_details || "",
            previousDoctors: data.previous_doctors || "",
            lastCheckupDate: data.last_checkup_date || "",
            vaccinations: data.vaccinations || [],
            hasMedicalTests: data.has_medical_tests === "yes" ? "yes" : "no",
            medicalTests: data.medical_tests || [],
            
            familyHasDiabetes: data.family_has_diabetes || false,
            familyHasHeartDisease: data.family_has_heart_disease || false,
            familyHasCancer: data.family_has_cancer || false,
            familyHasHypertension: data.family_has_hypertension || false,
            familyHasStroke: data.family_has_stroke || false,
            familyHasAsthma: data.family_has_asthma || false,
            familyHasThalassemia: data.family_has_thalassemia || false,
            familyHasBloodDisorders: data.family_has_blood_disorders || false,
            familyHasMentalHealth: data.family_has_mental_health || false,
            familyHasKidneyDisease: data.family_has_kidney_disease || false,
            familyHasThyroid: data.family_has_thyroid || false,
            familyHistoryNotes: data.family_history_notes || "",
            
            smoking: data.smoking || "never",
            smokingAmount: data.smoking_amount || "",
            alcohol: data.alcohol || "never",
            alcoholFrequency: data.alcohol_frequency || "",
            activityLevel: data.activity_level || "moderate",
            exerciseType: data.exercise_type || "",
            sleepDuration: data.sleep_duration || "",
            sleepQuality: data.sleep_quality || "",
            stressLevel: data.stress_level || "moderate",
            diet: data.diet || "omnivore",
            dietaryRestrictions: data.dietary_restrictions || "",
            waterIntake: data.water_intake || "",
            caffeine: data.caffeine || "moderate",
            mentalHealthConcerns: data.mental_health_concerns || "",
            currentlyInTherapy: data.currently_in_therapy || false,
            
            language: data.language || "English",
            languagesSpoken: data.languages_spoken || [],
            notifications: data.notifications ?? true,
            preferredContactMethod: data.preferred_contact_method || "phone",
            emergencyName: data.emergency_name || "",
            emergencyRelation: data.emergency_relation || "",
            emergencyPhone: data.emergency_phone || "",
            secondaryEmergencyName: data.secondary_emergency_name || "",
            secondaryEmergencyPhone: data.secondary_emergency_phone || "",
            consentStorage: data.consent_storage || false,
            consentAI: data.consent_ai || false,
            consentDoctor: data.consent_doctor || false,
            consentResearch: data.consent_research || false,
          }))

          if (
            data.has_kidney_disease ||
            data.has_liver_disease ||
            data.has_arthritis ||
            data.has_stroke ||
            data.has_epilepsy ||
            data.has_mental_health
          ) {
            setShowAllChronicConditions(true)
          }

          if (
            data.family_has_thalassemia ||
            data.family_has_blood_disorders ||
            data.family_has_mental_health ||
            data.family_has_kidney_disease ||
            data.family_has_thyroid
          ) {
            setShowAllFamilyHistoryConditions(true)
          }

          const nextHistoryAccordionValue: HistoryAccordionSection[] = []
          if ((data.surgeries || []).length > 0) {
            nextHistoryAccordionValue.push("surgeries")
          }
          if ((data.hospitalizations || []).length > 0) {
            nextHistoryAccordionValue.push("hospitalizations")
          }
          if ((data.vaccinations || []).length > 0) {
            nextHistoryAccordionValue.push("vaccinations")
          }
          if (data.has_medical_tests === "yes" || (data.medical_tests || []).length > 0) {
            nextHistoryAccordionValue.push("medicalTests")
          }
          setHistoryAccordionValue(nextHistoryAccordionValue)

          const nextLifestyleAccordionValue: LifestyleAccordionSection[] = ["substance"]
          if (
            (data.activity_level && data.activity_level !== "moderate") ||
            data.exercise_type ||
            data.sleep_duration ||
            data.sleep_quality
          ) {
            nextLifestyleAccordionValue.push("activitySleep")
          }
          if (
            (data.diet && data.diet !== "omnivore") ||
            data.dietary_restrictions ||
            data.water_intake ||
            (data.caffeine && data.caffeine !== "moderate")
          ) {
            nextLifestyleAccordionValue.push("diet")
          }
          if ((data.stress_level && data.stress_level !== "moderate") || data.mental_health_concerns || data.currently_in_therapy) {
            nextLifestyleAccordionValue.push("mentalHealth")
          }
          setLifestyleAccordionValue(nextLifestyleAccordionValue)
        }
      } catch (error) {
        console.error("Failed to fetch existing data:", error)
      } finally {
        setInitialLoading(false)
      }
    }
    
    fetchExistingData()
  }, [])

  useEffect(() => {
    if (!showCompletionState) {
      return
    }

    if (completionCountdown <= 0) {
      router.push("/patient/home")
      return
    }

    const timer = window.setTimeout(() => {
      setCompletionCountdown((prev) => prev - 1)
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [showCompletionState, completionCountdown, router])

  const validateField = (field: string, value: unknown, data: typeof formData): string | null => {
    const normalized = typeof value === "string" ? value.trim() : value

    if (field === "firstName") {
      if (!normalized) return strings.validation.firstNameRequired
      if (String(normalized).length < 2) return strings.validation.firstNameMin
      return null
    }

    if (field === "lastName") {
      if (!normalized) return strings.validation.lastNameRequired
      if (String(normalized).length < 2) return strings.validation.lastNameMin
      return null
    }

    if (field === "dob") {
      if (!normalized) return strings.validation.dateOfBirthRequired
      const dob = new Date(String(normalized))
      if (Number.isNaN(dob.getTime())) return strings.validation.dateOfBirthInvalid
      if (dob > new Date()) return strings.validation.dateOfBirthFuture
      return null
    }

    if (field === "gender") {
      if (!normalized) return strings.validation.genderRequired
      return null
    }

    if (field === "phone") {
      if (!normalized) return strings.validation.phoneRequired
      if (!PHONE_REGEX.test(String(normalized))) return strings.validation.phoneInvalid
      return null
    }

    if (field === "email") {
      if (!normalized) return null
      if (!EMAIL_REGEX.test(String(normalized))) return strings.validation.emailInvalid
      return null
    }

    if (field === "height") {
      if (!normalized) return null
      const height = Number(normalized)
      if (Number.isNaN(height) || height < 40 || height > 260) return strings.validation.heightInvalid
      return null
    }

    if (field === "weight") {
      if (!normalized) return null
      const weight = Number(normalized)
      if (Number.isNaN(weight) || weight < 2 || weight > 350) return strings.validation.weightInvalid
      return null
    }

    if (field === "emergencyName") {
      if (!normalized) return strings.validation.emergencyNameRequired
      return null
    }

    if (field === "emergencyRelation") {
      if (!normalized) return strings.validation.emergencyRelationRequired
      return null
    }

    if (field === "emergencyPhone") {
      if (!normalized) return strings.validation.emergencyPhoneRequired
      if (!PHONE_REGEX.test(String(normalized))) return strings.validation.emergencyPhoneInvalid
      return null
    }

    if (field === "secondaryEmergencyPhone") {
      if (!normalized) return null
      if (!PHONE_REGEX.test(String(normalized))) return strings.validation.secondaryPhoneInvalid
      if (!data.secondaryEmergencyName.trim()) return strings.validation.secondaryNameRequired
      return null
    }

    if (field === "secondaryEmergencyName") {
      if (!normalized) return data.secondaryEmergencyPhone.trim() ? strings.validation.secondaryNameRequired : null
      return null
    }

    if (field === "consentStorage") {
      if (value !== true) return strings.validation.storageConsentRequired
      return null
    }

    if (field === "consentDoctor") {
      if (value !== true) return strings.validation.doctorAccessConsentRequired
      return null
    }

    return null
  }

  const validateStep = (step: number, data: typeof formData) => {
    const stepFields: Record<number, string[]> = {
      1: ["firstName", "lastName", "dob", "gender", "phone", "email"],
      2: ["height", "weight"],
      8: ["emergencyName", "emergencyRelation", "emergencyPhone", "secondaryEmergencyName", "secondaryEmergencyPhone", "consentStorage", "consentDoctor"],
    }

    const errors: Record<string, string> = {}
    for (const field of stepFields[step] ?? []) {
      const message = validateField(field, (data as Record<string, unknown>)[field], data)
      if (message) errors[field] = message
    }

    if (step === 4 && data.takingMeds === "yes" && data.medications.length === 0) {
      errors.medications = strings.validation.medicationsRequired
    }

    if (step === 5 && data.hasMedicalTests === "yes" && data.medicalTests.length === 0) {
      errors.medicalTests = strings.validation.medicalTestsRequired
    }

    return errors
  }

  const currentStepErrors = validateStep(currentStep, formData)

  const getErrorMessage = (field: string) => {
    if (fieldErrors[field]) return fieldErrors[field]
    if (hasAttemptedContinue) return currentStepErrors[field]
    return null
  }

  const handleInputChange = (field: string, value: any) => {
    const normalizedValue = value === "indeterminate" ? false : value

    setFormData((prev) => {
      const next = { ...prev, [field]: normalizedValue }

      setFieldErrors((current) => {
        const nextErrors = { ...current }
        const message = validateField(field, normalizedValue, next)

        if (message) nextErrors[field] = message
        else delete nextErrors[field]

        if (field === "secondaryEmergencyName" || field === "secondaryEmergencyPhone") {
          const counterpartField = field === "secondaryEmergencyName" ? "secondaryEmergencyPhone" : "secondaryEmergencyName"
          const counterpartValue = next[counterpartField as keyof typeof next]
          const counterpartMessage = validateField(counterpartField, counterpartValue, next)
          if (counterpartMessage) nextErrors[counterpartField] = counterpartMessage
          else delete nextErrors[counterpartField]
        }

        return nextErrors
      })

      return next
    })

    setStepError(null)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const fieldToCategory: Record<string, MediaCategory> = {
          profile_photo_url: "profile_photo",
          medical_summary_url: "medical_document",
        }

        const category = fieldToCategory[field] || "general"

        try {
          const result = await uploadMediaFile({
            file,
            category,
            entityType: "patient_onboarding",
            visibility: "public",
          })
          handleInputChange(field, result.url || result.file.public_url || "")
          alert("File uploaded successfully!")
        } catch {
          // Fallback to legacy upload endpoint to avoid breaking existing onboarding flow
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

  const preparePayload = () => {
    return {
      first_name: formData.firstName,
      last_name: formData.lastName,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      email: formData.email,
      nid_number: formData.nidNumber,
      profile_photo_url: formData.profile_photo_url,
      marital_status: formData.maritalStatus,
      
      height: formData.height ? parseFloat(formData.height) : undefined,
      weight: formData.weight ? parseFloat(formData.weight) : undefined,
      blood_group: formData.bloodGroup,
      address: formData.address,
      district: formData.district,
      postal_code: formData.postalCode,
      city: formData.city,
      country: formData.country,
      occupation: formData.occupation,
      medical_summary_url: formData.medical_summary_url,
      
      has_diabetes: formData.hasDiabetes,
      has_hypertension: formData.hasHypertension,
      has_heart_disease: formData.hasHeartDisease,
      has_asthma: formData.hasAsthma,
      has_cancer: formData.hasCancer,
      has_thyroid: formData.hasThyroid,
      has_kidney_disease: formData.hasKidneyDisease,
      has_liver_disease: formData.hasLiverDisease,
      has_arthritis: formData.hasArthritis,
      has_stroke: formData.hasStroke,
      has_epilepsy: formData.hasEpilepsy,
      has_mental_health: formData.hasMentalHealth,
      other_conditions: formData.otherConditions,
      condition_details: formData.conditionDetails,
      
      taking_meds: formData.takingMeds,
      medications: (formData.medications || []).map((medication) =>
        toBackendPatientMedication(medication),
      ),
      drug_allergies: formData.drugAllergies,
      food_allergies: formData.foodAllergies,
      environmental_allergies: formData.environmentalAllergies,
      
      surgeries: formData.surgeries,
      hospitalizations: formData.hospitalizations,
      ongoing_treatments: formData.ongoingTreatments,
      ongoing_treatment_details: formData.ongoingTreatmentDetails,
      previous_doctors: formData.previousDoctors,
      last_checkup_date: formData.lastCheckupDate,
      vaccinations: formData.vaccinations,
      has_medical_tests: formData.hasMedicalTests,
      medical_tests: formData.medicalTests,
      
      family_has_diabetes: formData.familyHasDiabetes,
      family_has_heart_disease: formData.familyHasHeartDisease,
      family_has_cancer: formData.familyHasCancer,
      family_has_hypertension: formData.familyHasHypertension,
      family_has_stroke: formData.familyHasStroke,
      family_has_asthma: formData.familyHasAsthma,
      family_has_thalassemia: formData.familyHasThalassemia,
      family_has_blood_disorders: formData.familyHasBloodDisorders,
      family_has_mental_health: formData.familyHasMentalHealth,
      family_has_kidney_disease: formData.familyHasKidneyDisease,
      family_has_thyroid: formData.familyHasThyroid,
      family_history_notes: formData.familyHistoryNotes,
      
      smoking: formData.smoking,
      smoking_amount: formData.smokingAmount,
      alcohol: formData.alcohol,
      alcohol_frequency: formData.alcoholFrequency,
      activity_level: formData.activityLevel,
      exercise_type: formData.exerciseType,
      sleep_duration: formData.sleepDuration,
      sleep_quality: formData.sleepQuality,
      stress_level: formData.stressLevel,
      diet: formData.diet,
      dietary_restrictions: formData.dietaryRestrictions,
      water_intake: formData.waterIntake,
      caffeine: formData.caffeine,
      mental_health_concerns: formData.mentalHealthConcerns,
      currently_in_therapy: formData.currentlyInTherapy,
      
      language: formData.language,
      languages_spoken: formData.languagesSpoken,
      notifications: formData.notifications,
      preferred_contact_method: formData.preferredContactMethod,
      emergency_name: formData.emergencyName,
      emergency_relation: formData.emergencyRelation,
      emergency_phone: formData.emergencyPhone,
      secondary_emergency_name: formData.secondaryEmergencyName,
      secondary_emergency_phone: formData.secondaryEmergencyPhone,
      consent_storage: formData.consentStorage,
      consent_ai: formData.consentAI,
      consent_doctor: formData.consentDoctor,
      consent_research: formData.consentResearch,
    }
  }

  const nextStep = async () => {
    setHasAttemptedContinue(true)
    setStepError(null)

    const errors = validateStep(currentStep, formData)
    if (Object.keys(errors).length > 0) {
      setFieldErrors((prev) => ({ ...prev, ...errors }))
      return
    }

    setLoading(true)

    if (currentStep < translatedSteps.length) {
      try {
        await updatePatientOnboarding(preparePayload())
        setFieldErrors({})
        setHasAttemptedContinue(false)
        setCurrentStep((prev) => prev + 1)
        window.scrollTo(0, 0)
      } catch (error) {
        console.error("Failed to save progress", error)
        setStepError("We couldn't save this step. Check your connection and try again. Your entries are still here.")
      } finally {
        setLoading(false)
      }
    } else {
      try {
        await updatePatientOnboarding(preparePayload())
        await completeOnboarding()
        setFieldErrors({})
        setHasAttemptedContinue(false)
        setCompletionCountdown(3)
        setShowCompletionState(true)
      } catch (error) {
        console.error("Failed to complete onboarding", error)
        setStepError("We couldn't complete your setup. Review highlighted fields or retry in a moment.")
      } finally {
        setLoading(false)
      }
    }
  }

  const prevStep = () => {
    if (currentStep > 1) {
      setStepError(null)
      setHasAttemptedContinue(false)
      setCurrentStep((prev) => prev - 1)
      window.scrollTo(0, 0)
    }
  }

  const goToStep = (stepId: number) => {
    setCurrentStep(stepId)
    setStepError(null)
    setHasAttemptedContinue(false)
    window.scrollTo(0, 0)
  }

  const handleSkipOnboarding = async () => {
    setLoading(true)
    try {
      // Skip onboarding WITHOUT marking it as completed
      // User can return later to complete their profile
      // Mark skip so middleware allows access to protected routes, but keep the banner showing
      document.cookie = "onboarding_skipped=true; path=/; max-age=604800"; // 7 days
      // Use window.location for hard navigation to ensure proper cookie refresh
      window.location.href = "/patient/home"
    } catch (error) {
      console.error("Failed to skip onboarding", error)
      setLoading(false)
      setShowSkipDialog(false)
    }
  }

  // Helper functions for dynamic lists
  const handleMedicationsUpdate = async (medications: Medication[]) => {
    setFormData(prev => ({ ...prev, medications }))

    // Auto-save medications when they change
    try {
      const backendMedications = medications.map((medication) =>
        toBackendPatientMedication(medication),
      )

      await updatePatientOnboarding({
        taking_meds: medications.length > 0 ? "yes" : "no",
        medications: backendMedications
      })
    } catch (error) {
      console.error("Failed to auto-save medications:", error)
    }
  }
  
  const addDrugAllergy = () => {
    setFormData(prev => ({
      ...prev,
      drugAllergies: [...prev.drugAllergies, { drug_name: "", reaction: "", severity: "mild" }]
    }))
  }

  const updateDrugAllergy = (index: number, field: string, value: any) => {
    const newAllergies = [...formData.drugAllergies]
    // @ts-ignore
    newAllergies[index][field] = value
    setFormData(prev => ({ ...prev, drugAllergies: newAllergies }))
  }

  const removeDrugAllergy = (index: number) => {
    setFormData(prev => ({
      ...prev,
      drugAllergies: prev.drugAllergies.filter((_, i) => i !== index)
    }))
  }

  const ensureHistorySectionOpen = (section: HistoryAccordionSection) => {
    setHistoryAccordionValue((prev) => (prev.includes(section) ? prev : [...prev, section]))
  }

  const addSurgery = () => {
    ensureHistorySectionOpen("surgeries")
    setFormData(prev => ({
      ...prev,
      surgeries: [...prev.surgeries, { name: "", year: "", hospital: "" }]
    }))
  }

  const updateSurgery = (index: number, field: string, value: any) => {
    const newSurgeries = [...formData.surgeries]
    // @ts-ignore
    newSurgeries[index][field] = value
    setFormData(prev => ({ ...prev, surgeries: newSurgeries }))
  }

  const removeSurgery = (index: number) => {
    setFormData(prev => ({
      ...prev,
      surgeries: prev.surgeries.filter((_, i) => i !== index)
    }))
  }

  const addHospitalization = () => {
    ensureHistorySectionOpen("hospitalizations")
    setFormData(prev => ({
      ...prev,
      hospitalizations: [...prev.hospitalizations, { reason: "", year: "", duration: "" }]
    }))
  }

  const updateHospitalization = (index: number, field: string, value: any) => {
    const newHosp = [...formData.hospitalizations]
    // @ts-ignore
    newHosp[index][field] = value
    setFormData(prev => ({ ...prev, hospitalizations: newHosp }))
  }

  const removeHospitalization = (index: number) => {
    setFormData(prev => ({
      ...prev,
      hospitalizations: prev.hospitalizations.filter((_, i) => i !== index)
    }))
  }

  const addVaccination = () => {
    ensureHistorySectionOpen("vaccinations")
    setFormData(prev => ({
      ...prev,
      vaccinations: [...prev.vaccinations, { name: "", date: "", next_due: "" }]
    }))
  }

  const updateVaccination = (index: number, field: string, value: any) => {
    const newVacc = [...formData.vaccinations]
    // @ts-ignore
    newVacc[index][field] = value
    setFormData(prev => ({ ...prev, vaccinations: newVacc }))
  }

  const removeVaccination = (index: number) => {
    setFormData(prev => ({
      ...prev,
      vaccinations: prev.vaccinations.filter((_, i) => i !== index)
    }))
  }

  const addMedicalTest = () => {
    ensureHistorySectionOpen("medicalTests")
    setFormData(prev => ({
      ...prev,
      medicalTests: [...prev.medicalTests, {
        test_name: "",
        test_date: "",
        result: "",
        result_value: "",
        result_unit: "",
        normal_range: "",
        status: "",
        prescribing_doctor: "",
        hospital_lab: "",
        notes: "",
        document_url: ""
      }]
    }))
  }

  const updateMedicalTest = (index: number, field: string, value: any) => {
    const newTests = [...formData.medicalTests]
    // @ts-ignore
    newTests[index][field] = value
    setFormData(prev => ({ ...prev, medicalTests: newTests }))
  }

  const removeMedicalTest = (index: number) => {
    setFormData(prev => ({
      ...prev,
      medicalTests: prev.medicalTests.filter((_, i) => i !== index)
    }))
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  placeholder="John"
                  aria-invalid={!!getErrorMessage("firstName")}
                  className={cn(getErrorMessage("firstName") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                />
                {getErrorMessage("firstName") ? <p className="text-xs text-destructive">{getErrorMessage("firstName")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  placeholder="Doe"
                  aria-invalid={!!getErrorMessage("lastName")}
                  className={cn(getErrorMessage("lastName") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                />
                {getErrorMessage("lastName") ? <p className="text-xs text-destructive">{getErrorMessage("lastName")}</p> : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) => handleInputChange("dob", e.target.value)}
                aria-invalid={!!getErrorMessage("dob")}
                className={cn(getErrorMessage("dob") ? "border-destructive focus-visible:ring-destructive/30" : "")}
              />
              {getErrorMessage("dob") ? <p className="text-xs text-destructive">{getErrorMessage("dob")}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                  aria-invalid={!!getErrorMessage("gender")}
                  className={cn(getErrorMessage("gender") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
                {getErrorMessage("gender") ? <p className="text-xs text-destructive">{getErrorMessage("gender")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select id="maritalStatus" value={formData.maritalStatus} onChange={(e) => handleInputChange("maritalStatus", e.target.value)}>
                  <option value="">Select Status</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                placeholder="+880 1XXX XXXXXX"
                aria-invalid={!!getErrorMessage("phone")}
                className={cn(getErrorMessage("phone") ? "border-destructive focus-visible:ring-destructive/30" : "")}
              />
              {getErrorMessage("phone") ? <p className="text-xs text-destructive">{getErrorMessage("phone")}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="john@example.com"
                aria-invalid={!!getErrorMessage("email")}
                className={cn(getErrorMessage("email") ? "border-destructive focus-visible:ring-destructive/30" : "")}
              />
              {getErrorMessage("email") ? <p className="text-xs text-destructive">{getErrorMessage("email")}</p> : null}
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
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  value={formData.height}
                  onChange={(e) => handleInputChange("height", e.target.value)}
                  placeholder="175"
                  aria-invalid={!!getErrorMessage("height")}
                  className={cn(getErrorMessage("height") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                />
                {getErrorMessage("height") ? <p className="text-xs text-destructive">{getErrorMessage("height")}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  placeholder="70"
                  aria-invalid={!!getErrorMessage("weight")}
                  className={cn(getErrorMessage("weight") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                />
                {getErrorMessage("weight") ? <p className="text-xs text-destructive">{getErrorMessage("weight")}</p> : null}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select id="bloodGroup" value={formData.bloodGroup} onChange={(e) => handleInputChange("bloodGroup", e.target.value)}>
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </Select>
            </div>
            
            <Separator className="my-4" />
            <h4 className="font-medium">Address Details</h4>
            
            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input id="address" value={formData.address} onChange={(e) => handleInputChange("address", e.target.value)} placeholder="House/Road/Area" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" value={formData.district} onChange={(e) => handleInputChange("district", e.target.value)} placeholder="Dhaka" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" value={formData.postalCode} onChange={(e) => handleInputChange("postalCode", e.target.value)} placeholder="1205" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={formData.city} onChange={(e) => handleInputChange("city", e.target.value)} placeholder="Dhaka" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={formData.country} onChange={(e) => handleInputChange("country", e.target.value)} placeholder="Bangladesh" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={formData.occupation} onChange={(e) => handleInputChange("occupation", e.target.value)} placeholder="Software Engineer" />
            </div>
            
            <div className="rounded-lg border border-dashed p-4 text-center mt-4">
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <h4 className="text-sm font-medium">Upload Medical Summary (Optional)</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Input type="file" className="hidden" id="medical-summary-upload" onChange={(e) => handleFileUpload(e, "medical_summary_url")} />
                  <Label htmlFor="medical-summary-upload">
                    <div className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 cursor-pointer">
                      Choose File
                    </div>
                  </Label>
                  {formData.medical_summary_url && <span className="text-xs text-green-600">Uploaded</span>}
                </div>
              </div>
            </div>
          </div>
        )
      case 3: {
        const visibleChronicConditionOptions = showAllChronicConditions
          ? translatedChronicConditions
          : translatedChronicConditions.slice(0, VISIBLE_CHRONIC_CONDITION_COUNT)

        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Start with common conditions. You can add the rest only if relevant.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {visibleChronicConditionOptions.map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox id={key} checked={formData[key]} onCheckedChange={(checked) => handleInputChange(key, checked)} />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>

            {translatedChronicConditions.length > VISIBLE_CHRONIC_CONDITION_COUNT ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-0 text-sm text-primary hover:bg-transparent"
                onClick={() => setShowAllChronicConditions((prev) => !prev)}
              >
                {showAllChronicConditions ? "Show fewer conditions" : "Show more conditions"}
              </Button>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="otherConditions">Other Conditions</Label>
              <Input id="otherConditions" value={formData.otherConditions} onChange={(e) => handleInputChange("otherConditions", e.target.value)} placeholder="Any other conditions not listed above" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="conditionDetails">Additional Details</Label>
              <Textarea id="conditionDetails" value={formData.conditionDetails} onChange={(e) => handleInputChange("conditionDetails", e.target.value)} placeholder="Provide details about your conditions, when diagnosed, current status..." />
            </div>
          </div>
        )
      }
      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Are you currently taking any medications?</Label>
              <RadioGroup
                name="takingMeds"
                value={formData.takingMeds}
                onChange={(val) => handleInputChange("takingMeds", val)}
                options={[
                  { label: "No", value: "no" },
                  { label: "Yes", value: "yes" },
                ]}
              />
            </div>

            {formData.takingMeds === "yes" && (
              <div className="animate-in fade-in slide-in-from-top-4">
                <MedicationManager
                  medications={formData.medications}
                  onUpdate={handleMedicationsUpdate}
                  showStatus={true}
                  title="Current & Past Medications"
                  description="Search and add your medications from our database"
                />
              </div>
            )}

            <Separator />
            
            <h4 className="font-medium">Drug Allergies</h4>
            <div className="space-y-4">
              {formData.drugAllergies.map((allergy, index) => (
                <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeDrugAllergy(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Drug Name</Label>
                      <Input value={allergy.drug_name} onChange={(e) => updateDrugAllergy(index, "drug_name", e.target.value)} placeholder="Penicillin" />
                    </div>
                    <div className="space-y-2">
                      <Label>Reaction</Label>
                      <Input value={allergy.reaction} onChange={(e) => updateDrugAllergy(index, "reaction", e.target.value)} placeholder="Rash, Swelling" />
                    </div>
                    <div className="space-y-2">
                      <Label>Severity</Label>
                      <Select value={allergy.severity} onChange={(e) => updateDrugAllergy(index, "severity", e.target.value)}>
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={addDrugAllergy} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add Drug Allergy
              </Button>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="foodAllergies">Food Allergies</Label>
              <Input id="foodAllergies" value={formData.foodAllergies} onChange={(e) => handleInputChange("foodAllergies", e.target.value)} placeholder="e.g. Peanuts, Shellfish, Dairy" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="environmentalAllergies">Environmental Allergies</Label>
              <Input id="environmentalAllergies" value={formData.environmentalAllergies} onChange={(e) => handleInputChange("environmentalAllergies", e.target.value)} placeholder="e.g. Dust, Pollen, Pet dander" />
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Add key history first. Expand optional sections only for records you want to keep.</p>

            <div className="space-y-3">
              <Label>Ongoing Treatments?</Label>
              <RadioGroup
                name="ongoingTreatments"
                value={formData.ongoingTreatments}
                onChange={(val) => handleInputChange("ongoingTreatments", val)}
                options={[
                  { label: "No", value: "no" },
                  { label: "Yes", value: "yes" },
                ]}
              />
            </div>

            {formData.ongoingTreatments === "yes" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
                <Label htmlFor="ongoingTreatmentDetails">Treatment Details</Label>
                <Textarea id="ongoingTreatmentDetails" value={formData.ongoingTreatmentDetails} onChange={(e) => handleInputChange("ongoingTreatmentDetails", e.target.value)} placeholder="Describe ongoing treatments..." />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="previousDoctors">Previous Doctors</Label>
                <Input id="previousDoctors" value={formData.previousDoctors} onChange={(e) => handleInputChange("previousDoctors", e.target.value)} placeholder="Names of treating doctors" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastCheckupDate">Last Health Checkup</Label>
                <Input id="lastCheckupDate" type="date" value={formData.lastCheckupDate} onChange={(e) => handleInputChange("lastCheckupDate", e.target.value)} />
              </div>
            </div>

            <Accordion
              type="multiple"
              value={historyAccordionValue}
              onValueChange={(value) => setHistoryAccordionValue(value as HistoryAccordionSection[])}
              className="rounded-lg border border-border/60 bg-background/40 px-4"
            >
              <AccordionItem value="surgeries">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Past Surgeries</p>
                    <p className="text-xs text-muted-foreground">{formData.surgeries.length > 0 ? `${formData.surgeries.length} added` : "Optional"}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {formData.surgeries.map((surgery, index) => (
                    <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeSurgery(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Surgery Name</Label>
                          <Input value={surgery.name} onChange={(e) => updateSurgery(index, "name", e.target.value)} placeholder="Appendectomy" />
                        </div>
                        <div className="space-y-2">
                          <Label>Year</Label>
                          <Input type="number" value={surgery.year} onChange={(e) => updateSurgery(index, "year", e.target.value)} placeholder="2020" />
                        </div>
                        <div className="space-y-2">
                          <Label>Hospital</Label>
                          <Input value={surgery.hospital} onChange={(e) => updateSurgery(index, "hospital", e.target.value)} placeholder="Hospital name" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addSurgery} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Surgery
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="hospitalizations">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Hospitalizations</p>
                    <p className="text-xs text-muted-foreground">{formData.hospitalizations.length > 0 ? `${formData.hospitalizations.length} added` : "Optional"}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {formData.hospitalizations.map((hosp, index) => (
                    <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeHospitalization(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Reason</Label>
                          <Input value={hosp.reason} onChange={(e) => updateHospitalization(index, "reason", e.target.value)} placeholder="Reason for admission" />
                        </div>
                        <div className="space-y-2">
                          <Label>Year</Label>
                          <Input type="number" value={hosp.year} onChange={(e) => updateHospitalization(index, "year", e.target.value)} placeholder="2020" />
                        </div>
                        <div className="space-y-2">
                          <Label>Duration</Label>
                          <Input value={hosp.duration} onChange={(e) => updateHospitalization(index, "duration", e.target.value)} placeholder="5 days" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addHospitalization} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Hospitalization
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="vaccinations">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Vaccination History</p>
                    <p className="text-xs text-muted-foreground">{formData.vaccinations.length > 0 ? `${formData.vaccinations.length} added` : "Optional"}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  {formData.vaccinations.map((vacc, index) => (
                    <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                      <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeVaccination(index)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="space-y-2">
                          <Label>Vaccine Name</Label>
                          <Input value={vacc.name} onChange={(e) => updateVaccination(index, "name", e.target.value)} placeholder="COVID-19, Flu, etc." />
                        </div>
                        <div className="space-y-2">
                          <Label>Date Taken</Label>
                          <Input type="date" value={vacc.date} onChange={(e) => updateVaccination(index, "date", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Next Due</Label>
                          <Input type="date" value={vacc.next_due} onChange={(e) => updateVaccination(index, "next_due", e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={addVaccination} className="w-full">
                    <Plus className="mr-2 h-4 w-4" /> Add Vaccination
                  </Button>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="medicalTests">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Medical Tests / Lab Reports</p>
                    <p className="text-xs text-muted-foreground">{formData.medicalTests.length > 0 ? `${formData.medicalTests.length} added` : "Optional"}</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-3">
                    <Label>Do you have any past medical test records?</Label>
                    <RadioGroup
                      name="hasMedicalTests"
                      value={formData.hasMedicalTests}
                      onChange={(val) => {
                        handleInputChange("hasMedicalTests", val)
                        if (val === "yes") {
                          ensureHistorySectionOpen("medicalTests")
                        }
                      }}
                      options={[
                        { label: "No", value: "no" },
                        { label: "Yes", value: "yes" },
                      ]}
                    />
                  </div>

                  {formData.hasMedicalTests === "yes" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                      {formData.medicalTests.map((test, index) => (
                        <div key={index} className="relative rounded-lg border p-4 space-y-4">
                          <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeMedicalTest(index)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Test Name *</Label>
                              <MedicalTestSearch
                                value={test.test_name}
                                onChange={(testName, testId) => {
                                  updateMedicalTest(index, "test_name", testName)
                                  if (testId) updateMedicalTest(index, "test_id", testId)
                                }}
                                placeholder="Search or type test name..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>When was it done?</Label>
                              <Input type="date" value={test.test_date} onChange={(e) => updateMedicalTest(index, "test_date", e.target.value)} />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Which doctor prescribed it?</Label>
                              <Input value={test.prescribing_doctor} onChange={(e) => updateMedicalTest(index, "prescribing_doctor", e.target.value)} placeholder="Doctor&apos;s name (if you remember)" />
                            </div>
                            <div className="space-y-2">
                              <Label>Where was it done?</Label>
                              <Input value={test.hospital_lab} onChange={(e) => updateMedicalTest(index, "hospital_lab", e.target.value)} placeholder="Hospital or Lab name" />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>What was the result?</Label>
                            <Select value={test.status} onChange={(e) => updateMedicalTest(index, "status", e.target.value)}>
                              <option value="">I don&apos;t remember</option>
                              <option value="normal">Normal / Everything was fine</option>
                              <option value="abnormal">Abnormal / Doctor mentioned some issue</option>
                              <option value="critical">Critical / Needed immediate attention</option>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Any details you remember?</Label>
                            <Textarea value={test.notes} onChange={(e) => updateMedicalTest(index, "notes", e.target.value)} placeholder="e.g. Doctor said cholesterol was high, sugar level was 110..." rows={2} />
                          </div>
                        </div>
                      ))}
                      <Button type="button" variant="outline" onClick={addMedicalTest} className="w-full">
                        <Plus className="mr-2 h-4 w-4" /> Add Medical Test
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )
      case 6: {
        const visibleFamilyHistoryOptions = showAllFamilyHistoryConditions
          ? translatedFamilyHistory
          : translatedFamilyHistory.slice(0, VISIBLE_FAMILY_HISTORY_COUNT)

        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Start with common family conditions. Add less common history only if needed.</p>

            <div className="grid gap-4 sm:grid-cols-2">
              {visibleFamilyHistoryOptions.map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox id={key} checked={formData[key]} onCheckedChange={(checked) => handleInputChange(key, checked)} />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>

            {translatedFamilyHistory.length > VISIBLE_FAMILY_HISTORY_COUNT ? (
              <Button
                type="button"
                variant="ghost"
                className="h-auto px-0 text-sm text-primary hover:bg-transparent"
                onClick={() => setShowAllFamilyHistoryConditions((prev) => !prev)}
              >
                {showAllFamilyHistoryConditions ? "Show fewer conditions" : "Show more conditions"}
              </Button>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="familyHistoryNotes">Additional Family History Notes</Label>
              <Textarea id="familyHistoryNotes" value={formData.familyHistoryNotes} onChange={(e) => handleInputChange("familyHistoryNotes", e.target.value)} placeholder="Any other family health history details, specify which relative had which condition..." />
            </div>
          </div>
        )
      }
      case 7:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Keep this simple for now. Expand a section only when you want to add details.</p>

            <Accordion
              type="multiple"
              value={lifestyleAccordionValue}
              onValueChange={(value) => setLifestyleAccordionValue(value as LifestyleAccordionSection[])}
              className="rounded-lg border border-border/60 bg-background/40 px-4"
            >
              <AccordionItem value="substance">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Substance Use</p>
                    <p className="text-xs text-muted-foreground">Smoking, alcohol, and caffeine</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="smoking">Smoking Status</Label>
                      <Select id="smoking" value={formData.smoking} onChange={(e) => handleInputChange("smoking", e.target.value)}>
                        <option value="never">Never Smoked</option>
                        <option value="former">Former Smoker</option>
                        <option value="current">Current Smoker</option>
                      </Select>
                    </div>
                    {formData.smoking === "current" && (
                      <div className="space-y-2">
                        <Label htmlFor="smokingAmount">Amount per day</Label>
                        <Input id="smokingAmount" value={formData.smokingAmount} onChange={(e) => handleInputChange("smokingAmount", e.target.value)} placeholder="e.g. 10 cigarettes" />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="alcohol">Alcohol Consumption</Label>
                      <Select id="alcohol" value={formData.alcohol} onChange={(e) => handleInputChange("alcohol", e.target.value)}>
                        <option value="never">Never</option>
                        <option value="occasional">Occasional</option>
                        <option value="moderate">Moderate</option>
                        <option value="frequent">Frequent</option>
                      </Select>
                    </div>
                    {formData.alcohol !== "never" && (
                      <div className="space-y-2">
                        <Label htmlFor="alcoholFrequency">Frequency</Label>
                        <Input id="alcoholFrequency" value={formData.alcoholFrequency} onChange={(e) => handleInputChange("alcoholFrequency", e.target.value)} placeholder="e.g. 2-3 times/week" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="caffeine">Caffeine Intake</Label>
                    <Select id="caffeine" value={formData.caffeine} onChange={(e) => handleInputChange("caffeine", e.target.value)}>
                      <option value="none">None</option>
                      <option value="low">Low (1-2 cups/day)</option>
                      <option value="moderate">Moderate (3-4 cups/day)</option>
                      <option value="high">High (5+ cups/day)</option>
                    </Select>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="activitySleep">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Physical Activity & Sleep</p>
                    <p className="text-xs text-muted-foreground">Exercise habits and sleep quality</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="activityLevel">Activity Level</Label>
                      <Select id="activityLevel" value={formData.activityLevel} onChange={(e) => handleInputChange("activityLevel", e.target.value)}>
                        <option value="sedentary">Sedentary</option>
                        <option value="light">Light (1-2 times/week)</option>
                        <option value="moderate">Moderate (3-4 times/week)</option>
                        <option value="active">Active (5+ times/week)</option>
                        <option value="very_active">Very Active (Daily)</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exerciseType">Type of Exercise</Label>
                      <Input id="exerciseType" value={formData.exerciseType} onChange={(e) => handleInputChange("exerciseType", e.target.value)} placeholder="Walking, Gym, Swimming..." />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="sleepDuration">Sleep Duration (hours)</Label>
                      <Input id="sleepDuration" type="number" value={formData.sleepDuration} onChange={(e) => handleInputChange("sleepDuration", e.target.value)} placeholder="7" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sleepQuality">Sleep Quality</Label>
                      <Select id="sleepQuality" value={formData.sleepQuality} onChange={(e) => handleInputChange("sleepQuality", e.target.value)}>
                        <option value="">Select</option>
                        <option value="poor">Poor</option>
                        <option value="fair">Fair</option>
                        <option value="good">Good</option>
                        <option value="excellent">Excellent</option>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="diet">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Diet</p>
                    <p className="text-xs text-muted-foreground">Diet pattern, hydration, and restrictions</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="diet">Diet Preference</Label>
                      <Select id="diet" value={formData.diet} onChange={(e) => handleInputChange("diet", e.target.value)}>
                        <option value="omnivore">Omnivore</option>
                        <option value="vegetarian">Vegetarian</option>
                        <option value="vegan">Vegan</option>
                        <option value="pescatarian">Pescatarian</option>
                        <option value="keto">Keto</option>
                        <option value="halal">Halal</option>
                        <option value="other">Other</option>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="waterIntake">Water Intake (glasses/day)</Label>
                      <Input id="waterIntake" type="number" value={formData.waterIntake} onChange={(e) => handleInputChange("waterIntake", e.target.value)} placeholder="8" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dietaryRestrictions">Dietary Restrictions</Label>
                    <Input id="dietaryRestrictions" value={formData.dietaryRestrictions} onChange={(e) => handleInputChange("dietaryRestrictions", e.target.value)} placeholder="Low sodium, Low sugar, Gluten-free..." />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="mentalHealth">
                <AccordionTrigger className={ONBOARDING_ACCORDION_TRIGGER_CLASS}>
                  <div className="space-y-1">
                    <p className="font-medium">Mental Health</p>
                    <p className="text-xs text-muted-foreground">Stress and emotional wellbeing</p>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stressLevel">Stress Level</Label>
                    <Select id="stressLevel" value={formData.stressLevel} onChange={(e) => handleInputChange("stressLevel", e.target.value)}>
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="very_high">Very High</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mentalHealthConcerns">Mental Health Concerns</Label>
                    <Textarea id="mentalHealthConcerns" value={formData.mentalHealthConcerns} onChange={(e) => handleInputChange("mentalHealthConcerns", e.target.value)} placeholder="Any anxiety, depression, or other concerns..." />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="currentlyInTherapy" checked={formData.currentlyInTherapy} onCheckedChange={(checked) => handleInputChange("currentlyInTherapy", checked)} />
                    <Label htmlFor="currentlyInTherapy">Currently receiving therapy/counseling</Label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )
      case 8:
        return (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">Preferred Language</Label>
                <Select id="language" value={formData.language} onChange={(e) => handleInputChange("language", e.target.value)}>
                  <option value="English">English</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Arabic">Arabic</option>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preferredContactMethod">Preferred Contact</Label>
                <Select id="preferredContactMethod" value={formData.preferredContactMethod} onChange={(e) => handleInputChange("preferredContactMethod", e.target.value)}>
                  <option value="phone">Phone</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="whatsapp">WhatsApp</option>
                </Select>
              </div>
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
            
            <div className="flex items-center space-x-2">
              <Checkbox id="notifications" checked={formData.notifications} onCheckedChange={(checked) => handleInputChange("notifications", checked)} />
              <Label htmlFor="notifications">Enable Notifications</Label>
            </div>

            <Separator />

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Primary Emergency Contact</h4>
              <div className="space-y-2">
                <Label htmlFor="emergencyName">Name</Label>
                <Input
                  id="emergencyName"
                  value={formData.emergencyName}
                  onChange={(e) => handleInputChange("emergencyName", e.target.value)}
                  aria-invalid={!!getErrorMessage("emergencyName")}
                  className={cn(getErrorMessage("emergencyName") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                />
                {getErrorMessage("emergencyName") ? <p className="text-xs text-destructive">{getErrorMessage("emergencyName")}</p> : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelation">Relation</Label>
                  <Input
                    id="emergencyRelation"
                    value={formData.emergencyRelation}
                    onChange={(e) => handleInputChange("emergencyRelation", e.target.value)}
                    placeholder="Spouse, Parent, Sibling..."
                    aria-invalid={!!getErrorMessage("emergencyRelation")}
                    className={cn(getErrorMessage("emergencyRelation") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                  />
                  {getErrorMessage("emergencyRelation") ? <p className="text-xs text-destructive">{getErrorMessage("emergencyRelation")}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone</Label>
                  <Input
                    id="emergencyPhone"
                    value={formData.emergencyPhone}
                    onChange={(e) => handleInputChange("emergencyPhone", e.target.value)}
                    aria-invalid={!!getErrorMessage("emergencyPhone")}
                    className={cn(getErrorMessage("emergencyPhone") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                  />
                  {getErrorMessage("emergencyPhone") ? <p className="text-xs text-destructive">{getErrorMessage("emergencyPhone")}</p> : null}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Secondary Emergency Contact (Optional)</h4>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="secondaryEmergencyName">Name</Label>
                  <Input
                    id="secondaryEmergencyName"
                    value={formData.secondaryEmergencyName}
                    onChange={(e) => handleInputChange("secondaryEmergencyName", e.target.value)}
                    aria-invalid={!!getErrorMessage("secondaryEmergencyName")}
                    className={cn(getErrorMessage("secondaryEmergencyName") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                  />
                  {getErrorMessage("secondaryEmergencyName") ? <p className="text-xs text-destructive">{getErrorMessage("secondaryEmergencyName")}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryEmergencyPhone">Phone</Label>
                  <Input
                    id="secondaryEmergencyPhone"
                    value={formData.secondaryEmergencyPhone}
                    onChange={(e) => handleInputChange("secondaryEmergencyPhone", e.target.value)}
                    aria-invalid={!!getErrorMessage("secondaryEmergencyPhone")}
                    className={cn(getErrorMessage("secondaryEmergencyPhone") ? "border-destructive focus-visible:ring-destructive/30" : "")}
                  />
                  {getErrorMessage("secondaryEmergencyPhone") ? <p className="text-xs text-destructive">{getErrorMessage("secondaryEmergencyPhone")}</p> : null}
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Consent</h4>
              <div className="flex items-start space-x-2">
                <Checkbox id="consentStorage" checked={formData.consentStorage} onCheckedChange={(checked) => handleInputChange("consentStorage", checked)} />
                <Label htmlFor="consentStorage" className={cn("text-sm leading-none", getErrorMessage("consentStorage") ? "text-destructive" : "")}>
                  I consent to the secure storage of my medical data.
                </Label>
              </div>
              {getErrorMessage("consentStorage") ? <p className="text-xs text-destructive">{getErrorMessage("consentStorage")}</p> : null}
              <div className="flex items-start space-x-2">
                <Checkbox id="consentAI" checked={formData.consentAI} onCheckedChange={(checked) => handleInputChange("consentAI", checked)} />
                <Label htmlFor="consentAI" className="text-sm leading-none">
                  I allow AI assistance to analyze my data for health insights.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="consentDoctor" checked={formData.consentDoctor} onCheckedChange={(checked) => handleInputChange("consentDoctor", checked)} />
                <Label htmlFor="consentDoctor" className={cn("text-sm leading-none", getErrorMessage("consentDoctor") ? "text-destructive" : "")}>
                  I allow authorized doctors to access my medical records.
                </Label>
              </div>
              {getErrorMessage("consentDoctor") ? <p className="text-xs text-destructive">{getErrorMessage("consentDoctor")}</p> : null}
              <div className="flex items-start space-x-2">
                <Checkbox id="consentResearch" checked={formData.consentResearch} onCheckedChange={(checked) => handleInputChange("consentResearch", checked)} />
                <Label htmlFor="consentResearch" className="text-sm leading-none">
                  I consent to anonymized data use for medical research (optional).
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
            <CardTitle className="text-xl sm:text-2xl">Profile Setup Complete</CardTitle>
            <CardDescription>
              Your medical profile is ready. Doctors can now understand your history faster and give more focused care.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Redirecting to your dashboard in {completionCountdown} seconds...</p>
            <Button onClick={() => router.push("/patient/home")} className="w-full sm:w-auto" variant="medical">
              Go to Dashboard
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
              <CardTitle className="text-base sm:text-lg">Set up your profile in about {PATIENT_ONBOARDING_TIME_ESTIMATE}</CardTitle>
              <CardDescription className="text-foreground/90">{PATIENT_ONBOARDING_AHA}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid gap-2 text-sm text-foreground/90 sm:grid-cols-3">
                <p>1. Add essentials first</p>
                <p>2. Expand optional details only when relevant</p>
                <p>3. Review and finish with consent preferences</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowSkipDialog(true)}
                  className="min-h-9 transition-colors duration-200 motion-reduce:transition-none"
                >
                  Skip for now
                </Button>
                <p className="text-xs text-muted-foreground">You can return later from dashboard settings.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <StepIndicator steps={translatedSteps} currentStep={currentStep} onStepClick={goToStep} />

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
                <CardTitle>{translatedSteps[currentStep - 1].title}</CardTitle>
                <CardDescription className="space-y-1">
                  <span className="block text-sm font-medium text-foreground/90">Step {currentStep} of {translatedSteps.length}</span>
                  <span className="block text-xs text-muted-foreground">{translatedStepGuidance[currentStep]}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {stepError ? (
                  <div className="space-y-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <p>{stepError}</p>
                    <p className="text-xs text-destructive/90">
                      Recovery: retry now, or use &quot;Skip for now&quot; and complete this later from your dashboard.
                    </p>
                  </div>
                ) : null}

                {hasAttemptedContinue && Object.keys(currentStepErrors).length > 0 ? (
                  <div className="space-y-1.5 rounded-md border border-amber-300/50 bg-amber-100/40 p-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
                    <p className="font-medium">Complete the highlighted fields before continuing.</p>
                    <p className="text-xs">
                      {Object.keys(currentStepErrors).length} required check{Object.keys(currentStepErrors).length > 1 ? "s" : ""} remaining on this step.
                    </p>
                  </div>
                ) : null}

                {renderStepContent()}
              </CardContent>
              <CardFooter className="flex flex-col-reverse gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1 || loading}
                    className="w-full transition-colors duration-200 motion-reduce:transition-none sm:w-auto"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowSkipDialog(true)} 
                    disabled={loading}
                    className="w-full text-muted-foreground transition-colors duration-200 hover:text-foreground motion-reduce:transition-none sm:w-auto"
                  >
                    Skip for Now
                  </Button>
                </div>
                <div className="w-full sm:w-auto">
                  <Button
                    onClick={nextStep}
                    disabled={loading || Object.keys(currentStepErrors).length > 0}
                    className="w-full transition-colors duration-200 motion-reduce:transition-none sm:w-auto"
                  >
                    {loading ? "Saving..." : (currentStep === translatedSteps.length ? "Finish Setup" : "Next")}
                    {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
                  </Button>
                  {Object.keys(currentStepErrors).length > 0 ? (
                    <p className="mt-2 text-center text-xs text-muted-foreground sm:text-right">
                      {Object.keys(currentStepErrors).length} required check{Object.keys(currentStepErrors).length > 1 ? "s" : ""} pending.
                    </p>
                  ) : null}
                </div>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Skip Onboarding Confirmation Dialog */}
        {showSkipDialog && (
          <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/50 p-4 sm:items-center">
            <Card className="max-h-[90dvh] w-full max-w-md overflow-y-auto">
              <CardHeader>
                <CardTitle>Skip Onboarding?</CardTitle>
                <CardDescription>
                  You can complete your medical profile later from your dashboard settings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  A complete medical profile helps doctors provide better care. We recommend filling out all sections for accurate diagnosis and treatment.
                </p>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowSkipDialog(false)}
                  disabled={loading}
                  className="transition-colors duration-200 motion-reduce:transition-none"
                >
                  Cancel
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={handleSkipOnboarding}
                  disabled={loading}
                  className="transition-colors duration-200 motion-reduce:transition-none"
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

