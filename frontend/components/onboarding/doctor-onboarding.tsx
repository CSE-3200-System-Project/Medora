"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, ChevronLeft, Upload, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select-native"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { StepIndicator } from "@/components/onboarding/step-indicator"
import { updateDoctorOnboarding, completeOnboarding, getDoctorOnboardingData } from "@/lib/auth-actions"
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

type Speciality = {
  id: number
  name: string
}

export function DoctorOnboarding() {
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showSkipDialog, setShowSkipDialog] = useState(false)
  const [specialities, setSpecialities] = useState<Speciality[]>([])
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
            practiceLocation: data.practice_location || "",
            consultationMode: data.consultation_mode || "both",
            affiliation_letter_url: data.affiliation_letter_url || "",
            institution: data.institution || "",
            
            consultationFee: data.consultation_fee || "",
            followUpFee: data.follow_up_fee || "",
            visitingHours: data.visiting_hours || "",
            availableDays: data.available_days || [],
            timeSlots: data.time_slots || "",
            appointmentDuration: data.appointment_duration?.toString() || "",
            emergencyAvailability: data.emergency_availability || false,
            emergencyContact: data.emergency_contact || "",
            
            about: data.about || "",
            
            language: data.language || "English",
            languagesSpoken: data.languages_spoken || [],
            caseTypes: data.case_types || "",
            aiAssistance: data.ai_assistance ?? true,
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

  // Education helpers
  const addEducation = () => {
    setFormData(prev => ({
      ...prev,
      education: [...prev.education, { degree: "", institution: "", year: "", country: "Bangladesh" }]
    }))
  }

  const updateEducation = (index: number, field: string, value: string) => {
    const newEducation = [...formData.education]
    // @ts-ignore
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

  const updateWorkExperience = (index: number, field: string, value: any) => {
    const newExp = [...formData.workExperience]
    // @ts-ignore
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

  const preparePayload = () => {
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
      
      hospital_name: formData.hospitalName,
      hospital_address: formData.hospitalAddress,
      hospital_city: formData.hospitalCity,
      hospital_country: formData.hospitalCountry,
      chamber_name: formData.chamberName,
      chamber_address: formData.chamberAddress,
      chamber_city: formData.chamberCity,
      practice_location: formData.practiceLocation,
      consultation_mode: formData.consultationMode,
      affiliation_letter_url: formData.affiliation_letter_url,
      institution: formData.institution,
      
      consultation_fee: formData.consultationFee,
      follow_up_fee: formData.followUpFee,
      visiting_hours: formData.visitingHours,
      available_days: formData.availableDays,
      time_slots: formData.timeSlots,
      appointment_duration: formData.appointmentDuration ? parseInt(formData.appointmentDuration) : undefined,
      emergency_availability: formData.emergencyAvailability,
      emergency_contact: formData.emergencyContact,
      
      about: formData.about,
      
      language: formData.language,
      languages_spoken: formData.languagesSpoken,
      case_types: formData.caseTypes,
      ai_assistance: formData.aiAssistance,
      terms_accepted: formData.termsAccepted,
      telemedicine_available: formData.telemedicineAvailable,
      telemedicine_platforms: formData.telemedicinePlatforms,
    }
  }

  const nextStep = async () => {
    if (currentStep < STEPS.length) {
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
        router.push("/doctor/home")
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
      await completeOnboarding()
      router.push("/doctor/home")
    } catch (error) {
      console.error("Failed to skip onboarding", error)
    } finally {
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
            
            <div className="grid grid-cols-2 gap-4">
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
                    <Checkbox id={`current-${index}`} checked={exp.current} onCheckedChange={(checked) => updateWorkExperience(index, "current", checked)} />
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
            <h4 className="font-medium">Primary Hospital/Clinic</h4>
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="hospitalName">Hospital/Clinic Name</Label>
                <Input id="hospitalName" value={formData.hospitalName} onChange={(e) => handleInputChange("hospitalName", e.target.value)} placeholder="Mount Adora Hospital" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hospitalAddress">Address</Label>
                <Input id="hospitalAddress" value={formData.hospitalAddress} onChange={(e) => handleInputChange("hospitalAddress", e.target.value)} placeholder="Nayasarak Road, Mirboxtula, Sylhet-3100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hospitalCity">City</Label>
                  <Input id="hospitalCity" value={formData.hospitalCity} onChange={(e) => handleInputChange("hospitalCity", e.target.value)} placeholder="Sylhet" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hospitalCountry">Country</Label>
                  <Input id="hospitalCountry" value={formData.hospitalCountry} onChange={(e) => handleInputChange("hospitalCountry", e.target.value)} placeholder="Bangladesh" />
                </div>
              </div>
            </div>
            
            <Separator className="my-4" />
            
            <h4 className="font-medium">Chamber Details (if different)</h4>
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="chamberName">Chamber Name</Label>
                <Input id="chamberName" value={formData.chamberName} onChange={(e) => handleInputChange("chamberName", e.target.value)} placeholder="Private Chamber Name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chamberAddress">Chamber Address</Label>
                <Input id="chamberAddress" value={formData.chamberAddress} onChange={(e) => handleInputChange("chamberAddress", e.target.value)} placeholder="Full address" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chamberCity">Chamber City</Label>
                <Input id="chamberCity" value={formData.chamberCity} onChange={(e) => handleInputChange("chamberCity", e.target.value)} placeholder="City" />
              </div>
            </div>
            
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
            <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="visitingHours">Visiting Hours</Label>
              <Input id="visitingHours" value={formData.visitingHours} onChange={(e) => handleInputChange("visitingHours", e.target.value)} placeholder="Sat Sun Mon Tue Wed 03:00 PM - 08:00 PM" />
              <p className="text-xs text-muted-foreground">Example: Sat Sun Mon Tue Wed 03:00 PM - 08:00 PM</p>
            </div>
            
            <div className="space-y-2">
              <Label>Available Days</Label>
              <div className="flex flex-wrap gap-2">
                {["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={day}
                      checked={formData.availableDays.includes(day)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          handleInputChange("availableDays", [...formData.availableDays, day])
                        } else {
                          handleInputChange("availableDays", formData.availableDays.filter(d => d !== day))
                        }
                      }}
                    />
                    <Label htmlFor={day} className="text-sm">{day.slice(0, 3)}</Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="timeSlots">Time Slots</Label>
              <Input id="timeSlots" value={formData.timeSlots} onChange={(e) => handleInputChange("timeSlots", e.target.value)} placeholder="e.g. 9 AM - 1 PM, 5 PM - 9 PM" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="appointmentDuration">Appointment Duration (minutes)</Label>
              <Select id="appointmentDuration" value={formData.appointmentDuration} onChange={(e) => handleInputChange("appointmentDuration", e.target.value)}>
                <option value="">Select Duration</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="20">20 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">60 minutes</option>
              </Select>
            </div>
            
            <Separator className="my-4" />
            
            <div className="flex items-center space-x-2">
              <Checkbox id="emergencyAvailability" checked={formData.emergencyAvailability} onCheckedChange={(checked) => handleInputChange("emergencyAvailability", checked)} />
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
                <Checkbox id="telemedicineAvailable" checked={formData.telemedicineAvailable} onCheckedChange={(checked) => handleInputChange("telemedicineAvailable", checked)} />
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
                <Checkbox id="aiAssistance" checked={formData.aiAssistance} onCheckedChange={(checked) => handleInputChange("aiAssistance", checked)} />
                <Label htmlFor="aiAssistance" className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  I agree to use AI assistance for preliminary diagnosis support. I understand that AI suggestions are advisory only.
                </Label>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox id="termsAccepted" checked={formData.termsAccepted} onCheckedChange={(checked) => handleInputChange("termsAccepted", checked)} />
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
              <CardFooter className="flex justify-between items-center">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={prevStep} disabled={currentStep === 1 || loading}>
                    <ChevronLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowSkipDialog(true)} 
                    disabled={loading}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    Skip for Now
                  </Button>
                </div>
                <Button onClick={nextStep} disabled={loading}>
                  {loading ? "Completing..." : (currentStep === STEPS.length ? "Complete Onboarding" : "Next")} 
                  {!loading && <ChevronRight className="ml-2 h-4 w-4" />}
                </Button>
              </CardFooter>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Skip Onboarding Confirmation Dialog */}
        {showSkipDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <CardTitle>Skip Onboarding?</CardTitle>
                <CardDescription>
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
