"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select-native"
import { RadioGroup } from "@/components/ui/radio-group-native"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { updatePatientOnboarding, completeOnboarding, getPatientOnboardingData } from "@/lib/auth-actions"
import { useRouter } from "next/navigation"

const STEPS = [
  { id: 1, title: "Personal Identity", shortName: "Identity" },
  { id: 2, title: "Physical & Address", shortName: "Profile" },
  { id: 3, title: "Chronic Conditions", shortName: "Conditions" },
  { id: 4, title: "Medications & Allergies", shortName: "Meds" },
  { id: 5, title: "Medical History", shortName: "History" },
  { id: 6, title: "Family History", shortName: "Family" },
  { id: 7, title: "Lifestyle & Mental Health", shortName: "Lifestyle" },
  { id: 8, title: "Preferences & Consent", shortName: "Consent" },
]

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

export function PatientOnboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
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
    medications: [] as { name: string; dosage: string; frequency: string; duration: string }[],
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
        console.log("Fetching patient onboarding data...")
        const data = await getPatientOnboardingData()
        console.log("Received data:", data)
        if (data) {
          console.log("Setting form data with received data")
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
            
            takingMeds: data.taking_meds || "no",
            medications: data.medications || [],
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
        }
      } catch (error) {
        console.error("Failed to fetch existing data:", error)
      } finally {
        setInitialLoading(false)
      }
    }
    
    fetchExistingData()
  }, [])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0]
    if (file) {
      const formDataUpload = new FormData()
      formDataUpload.append("file", file)
      try {
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
      medications: formData.medications,
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
    if (currentStep < STEPS.length) {
      try {
        await updatePatientOnboarding(preparePayload())
        setCurrentStep((prev) => prev + 1)
        window.scrollTo(0, 0)
      } catch (error) {
        console.error("Failed to save progress", error)
      }
    } else {
      setLoading(true)
      try {
        await updatePatientOnboarding(preparePayload())
        await completeOnboarding()
        router.push("/patient/home")
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

  // Helper functions for dynamic lists
  const addMedication = () => {
    setFormData(prev => ({
      ...prev,
      medications: [...prev.medications, { name: "", dosage: "", frequency: "", duration: "" }]
    }))
  }

  const updateMedication = (index: number, field: string, value: any) => {
    const newMeds = [...formData.medications]
    // @ts-ignore
    newMeds[index][field] = value
    setFormData(prev => ({ ...prev, medications: newMeds }))
  }

  const removeMedication = (index: number) => {
    setFormData(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index)
    }))
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

  const addSurgery = () => {
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

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={formData.firstName} onChange={(e) => handleInputChange("firstName", e.target.value)} placeholder="John" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={formData.lastName} onChange={(e) => handleInputChange("lastName", e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dob">Date of Birth *</Label>
              <Input id="dob" type="date" value={formData.dob} onChange={(e) => handleInputChange("dob", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Gender *</Label>
                <Select id="gender" value={formData.gender} onChange={(e) => handleInputChange("gender", e.target.value)}>
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </Select>
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
              <Input id="phone" type="tel" value={formData.phone} onChange={(e) => handleInputChange("phone", e.target.value)} placeholder="+880 1XXX XXXXXX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange("email", e.target.value)} placeholder="john@example.com" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input id="height" type="number" value={formData.height} onChange={(e) => handleInputChange("height", e.target.value)} placeholder="175" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input id="weight" type="number" value={formData.weight} onChange={(e) => handleInputChange("weight", e.target.value)} placeholder="70" />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input id="district" value={formData.district} onChange={(e) => handleInputChange("district", e.target.value)} placeholder="Dhaka" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input id="postalCode" value={formData.postalCode} onChange={(e) => handleInputChange("postalCode", e.target.value)} placeholder="1205" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
      case 3:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Select any chronic conditions you have been diagnosed with:</p>
            
            <div className="grid grid-cols-2 gap-4">
              {[
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
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={formData[key as keyof typeof formData] as boolean}
                    onCheckedChange={(checked) => handleInputChange(key, checked)}
                  />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>
            
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
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                {formData.medications.map((med, index) => (
                  <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                    <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeMedication(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <div className="space-y-2">
                      <Label>Medicine Name</Label>
                      <Input value={med.name} onChange={(e) => updateMedication(index, "name", e.target.value)} placeholder="e.g. Metformin" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Dosage</Label>
                        <Input value={med.dosage} onChange={(e) => updateMedication(index, "dosage", e.target.value)} placeholder="500mg" />
                      </div>
                      <div className="space-y-2">
                        <Label>Frequency</Label>
                        <Input value={med.frequency} onChange={(e) => updateMedication(index, "frequency", e.target.value)} placeholder="Twice daily" />
                      </div>
                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Input value={med.duration} onChange={(e) => updateMedication(index, "duration", e.target.value)} placeholder="Ongoing" />
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addMedication} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Add Medication
                </Button>
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
            <h4 className="font-medium">Past Surgeries</h4>
            <div className="space-y-4">
              {formData.surgeries.map((surgery, index) => (
                <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeSurgery(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-3 gap-4">
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
              <Button variant="outline" onClick={addSurgery} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add Surgery
              </Button>
            </div>

            <Separator />
            
            <h4 className="font-medium">Hospitalizations</h4>
            <div className="space-y-4">
              {formData.hospitalizations.map((hosp, index) => (
                <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeHospitalization(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-3 gap-4">
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
              <Button variant="outline" onClick={addHospitalization} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add Hospitalization
              </Button>
            </div>

            <Separator />

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="previousDoctors">Previous Doctors</Label>
                <Input id="previousDoctors" value={formData.previousDoctors} onChange={(e) => handleInputChange("previousDoctors", e.target.value)} placeholder="Names of treating doctors" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastCheckupDate">Last Health Checkup</Label>
                <Input id="lastCheckupDate" type="date" value={formData.lastCheckupDate} onChange={(e) => handleInputChange("lastCheckupDate", e.target.value)} />
              </div>
            </div>

            <Separator />
            
            <h4 className="font-medium">Vaccination History</h4>
            <div className="space-y-4">
              {formData.vaccinations.map((vacc, index) => (
                <div key={index} className="relative grid gap-4 rounded-lg border p-4">
                  <Button variant="ghost" size="icon" className="absolute right-2 top-2 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeVaccination(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-3 gap-4">
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
              <Button variant="outline" onClick={addVaccination} className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add Vaccination
              </Button>
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Select conditions that run in your family (parents, siblings, grandparents):</p>
            
            <div className="grid grid-cols-2 gap-4">
              {[
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
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={formData[key as keyof typeof formData] as boolean}
                    onCheckedChange={(checked) => handleInputChange(key, checked)}
                  />
                  <Label htmlFor={key}>{label}</Label>
                </div>
              ))}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="familyHistoryNotes">Additional Family History Notes</Label>
              <Textarea id="familyHistoryNotes" value={formData.familyHistoryNotes} onChange={(e) => handleInputChange("familyHistoryNotes", e.target.value)} placeholder="Any other family health history details, specify which relative had which condition..." />
            </div>
          </div>
        )
      case 7:
        return (
          <div className="space-y-4">
            <h4 className="font-medium">Substance Use</h4>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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

            <Separator />
            <h4 className="font-medium">Physical Activity & Sleep</h4>
            
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-2 gap-4">
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

            <Separator />
            <h4 className="font-medium">Diet</h4>
            
            <div className="grid grid-cols-2 gap-4">
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

            <Separator />
            <h4 className="font-medium">Mental Health</h4>
            
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
          </div>
        )
      case 8:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
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
                <Input id="emergencyName" value={formData.emergencyName} onChange={(e) => handleInputChange("emergencyName", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyRelation">Relation</Label>
                  <Input id="emergencyRelation" value={formData.emergencyRelation} onChange={(e) => handleInputChange("emergencyRelation", e.target.value)} placeholder="Spouse, Parent, Sibling..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyPhone">Phone</Label>
                  <Input id="emergencyPhone" value={formData.emergencyPhone} onChange={(e) => handleInputChange("emergencyPhone", e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Secondary Emergency Contact (Optional)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="secondaryEmergencyName">Name</Label>
                  <Input id="secondaryEmergencyName" value={formData.secondaryEmergencyName} onChange={(e) => handleInputChange("secondaryEmergencyName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryEmergencyPhone">Phone</Label>
                  <Input id="secondaryEmergencyPhone" value={formData.secondaryEmergencyPhone} onChange={(e) => handleInputChange("secondaryEmergencyPhone", e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Consent</h4>
              <div className="flex items-start space-x-2">
                <Checkbox id="consentStorage" checked={formData.consentStorage} onCheckedChange={(checked) => handleInputChange("consentStorage", checked)} />
                <Label htmlFor="consentStorage" className="text-sm leading-none">
                  I consent to the secure storage of my medical data.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="consentAI" checked={formData.consentAI} onCheckedChange={(checked) => handleInputChange("consentAI", checked)} />
                <Label htmlFor="consentAI" className="text-sm leading-none">
                  I allow AI assistance to analyze my data for health insights.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="consentDoctor" checked={formData.consentDoctor} onCheckedChange={(checked) => handleInputChange("consentDoctor", checked)} />
                <Label htmlFor="consentDoctor" className="text-sm leading-none">
                  I allow authorized doctors to access my medical records.
                </Label>
              </div>
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
      <div className="w-full max-w-4xl mx-auto flex items-center justify-center min-h-100">
        <div className="text-muted-foreground">Loading your profile...</div>
      </div>
    )
  }
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="space-y-8">
        <StepIndicator steps={STEPS} currentStep={currentStep} />

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
                <CardDescription>
                  Step {currentStep} of {STEPS.length}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {renderStepContent()}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1 || loading}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={nextStep} disabled={loading}>
                  {loading ? "Completing..." : (currentStep === STEPS.length ? "Finish Setup" : "Next")} 
                  {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
