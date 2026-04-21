"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import {
  User, Calendar, Phone, Mail, MapPin, Heart, Activity,
  AlertCircle, Pill, Stethoscope, ArrowLeft, Clock,
  Weight, Ruler, Droplet, FileText, Shield, UserCheck,
  Home, Briefcase, AlertTriangle, MessageSquarePlus,
  Footprints, MoonStar, Waves, ShieldCheck, History, ExternalLink
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Navbar } from "@/components/ui/navbar"
import { AppBackground } from "@/components/ui/app-background"
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader"
import { CardSkeleton } from "@/components/ui/skeleton-loaders"
import { resolveAvatarUrl } from "@/lib/avatar";
import { getPatientForDoctor } from "@/lib/patient-access-actions"
import { getDoctorPatientAssistantSummary, type DoctorPatientAssistantSummaryResponse } from "@/lib/ai-consultation-actions"
import { getPatientHealthForDoctor, type PatientHealthOverview } from "@/lib/health-data-consent-actions"
import { formatShortDateTime, parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils"

interface PatientData {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string
  age: number | null
  date_of_birth: string | null
  gender: string | null
  marital_status: string | null
  profile_photo_url: string | null
  
  // Address
  address: string | null
  city: string | null
  district: string | null
  postal_code: string | null
  country: string | null
  occupation: string | null
  
  // Physical
  height: number | null
  weight: number | null
  blood_group: string | null
  
  // Chronic Conditions
  chronic_conditions: string[]
  has_diabetes: boolean
  has_hypertension: boolean
  has_heart_disease: boolean
  has_asthma: boolean
  has_cancer: boolean
  
  // Medications
  taking_medications: boolean
  medications: any[] | null
  drug_allergies: any[] | null
  food_allergies: string | null
  environmental_allergies: string | null
  
  // Medical History
  surgeries: any[] | null
  hospitalizations: any[] | null
  ongoing_treatments: string | null
  vaccinations: any[] | null
  last_checkup_date: string | null
  
  // Family History
  family_has_diabetes: boolean
  family_has_heart_disease: boolean
  family_has_cancer: boolean
  family_has_hypertension: boolean
  family_has_stroke: boolean
  
  // Lifestyle
  smoking_status: string | null
  alcohol_consumption: string | null
  activity_level: string | null
  sleep_hours: number | null
  stress_level: string | null
  diet_type: string | null
  mental_health_concerns: string | null
  
  // Emergency Contact
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relationship: string | null
  
  // Appointments
  appointment_history: Array<{
    id: string
    date: string
    reason: string | null
    notes: string | null
    status: string
  }>

  consultation_history?: Array<{
    id: string
    consultation_date: string | null
    chief_complaint: string | null
    diagnosis: string | null
    status: string
    prescription_count: number
    latest_prescription_id: string | null
    latest_prescription_status: string | null
  }>

  prescription_history?: Array<{
    id: string
    consultation_id: string
    consultation_date: string | null
    type: string
    status: string
    created_at: string | null
    notes: string | null
    medication_count: number
    test_count: number
    surgery_count: number
  }>

  data_sharing_restrictions?: {
    any_restricted: boolean
    restricted_categories: string[]
    message?: string | null
  }
  
  access_timestamp: string
}

export default function DoctorPatientViewPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string
  
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assistantSummary, setAssistantSummary] = useState<DoctorPatientAssistantSummaryResponse | null>(null)
  const [assistantLoading, setAssistantLoading] = useState(false)
  const [assistantError, setAssistantError] = useState<string | null>(null)
  const [healthOverview, setHealthOverview] = useState<PatientHealthOverview | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthNoConsent, setHealthNoConsent] = useState(false)

  const handleLoadAssistantSummary = async () => {
    try {
      setAssistantLoading(true)
      setAssistantError(null)
      const response = await getDoctorPatientAssistantSummary(patientId)
      setAssistantSummary(response)
    } catch (err: any) {
      setAssistantError(err?.message || "Failed to generate assistant summary")
    } finally {
      setAssistantLoading(false)
    }
  }

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        const data = await getPatientForDoctor(patientId)
        setPatient(data)
      } catch (err: any) {
        setError(err.message || "Failed to load patient data")
      } finally {
        setLoading(false)
      }
    }

    fetchPatientData()
  }, [patientId])

  useEffect(() => {
    if (!patientId) return
    let cancelled = false
    const fetchHealth = async () => {
      setHealthLoading(true)
      setHealthNoConsent(false)
      setHealthOverview(null)
      try {
        const data = await getPatientHealthForDoctor(patientId, 7)
        if (!cancelled) {
          if (data) {
            setHealthOverview(data)
            setHealthNoConsent(false)
          } else {
            setHealthNoConsent(true)
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err?.message?.includes("not granted")) {
            setHealthNoConsent(true)
          } else {
            setHealthNoConsent(false)
          }
        }
      } finally {
        if (!cancelled) setHealthLoading(false)
      }
    }
    fetchHealth()
    return () => { cancelled = true }
  }, [patientId])

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 pt-(--nav-content-offset)">
          <DoctorPatientRecordSkeleton />
        </main>
      </AppBackground>
    )
  }

  if (error) {
    return (
      <AppBackground>
        <Navbar />
        <div className="min-h-dvh min-h-app flex items-center justify-center p-4 pt-(--nav-content-offset)">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
                <p className="text-muted-foreground">{error}</p>
                <Button onClick={() => router.back()} variant="outline" className="mt-4">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppBackground>
    )
  }

  if (!patient) return null

  const consultationHistory = patient.consultation_history || []
  const prescriptionHistory = patient.prescription_history || []
  const prescriptionHistoryRestricted = Boolean(
    patient.data_sharing_restrictions?.restricted_categories?.includes("can_view_prescriptions")
  )

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="min-h-dvh min-h-app pt-(--nav-content-offset) pb-8">
        {/* Top Header Bar */}
        <div className="bg-background/80 backdrop-blur-md border-b border-border sticky top-16 z-10">
          <div className="max-w-6xl mx-auto container-padding py-3 flex items-center justify-between gap-3">
              <Button 
                variant="outline" 
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to My Patients</span>
                <span className="sm:hidden">Back</span>
              </Button>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleLoadAssistantSummary}
                  disabled={assistantLoading}
                  className="gap-2"
                >
                  {assistantLoading ? <ButtonLoader className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  <span className="hidden sm:inline">AI Summarizer</span>
                  <span className="sm:hidden">Summary</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/doctor/patient/${patientId}/reports`)}
                  className="gap-2"
                >
                  <Activity className="w-4 h-4" />
                  <span className="hidden sm:inline">Lab Reports</span>
                  <span className="sm:hidden">Reports</span>
                </Button>
                <Button
                  onClick={() => router.push(`/doctor/patient/${patientId}/consultation/ai`)}
                  className="gap-2"
                >
                  <MessageSquarePlus className="w-4 h-4" />
                  <span className="hidden sm:inline">Start Consultation</span>
                  <span className="sm:hidden">Consult</span>
                </Button>
              </div>
            </div>
          </div>


        <div className="max-w-6xl mx-auto container-padding py-6">
            {(assistantSummary || assistantError) && (
              <Card className="mb-6 border-primary/20">
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    AI Pre-Consultation Summary
                  </CardTitle>
                  <CardDescription>
                    Assistant summary from authorized records with anonymized AI support. Final clinical decisions remain with the doctor.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  {assistantError ? <p className="text-sm text-destructive">{assistantError}</p> : null}

                  {assistantSummary?.highlight_points?.length ? (
                    <div>
                      <h4 className="text-sm font-semibold text-foreground mb-2">Priority Highlights</h4>
                      <ul className="space-y-1">
                        {assistantSummary.highlight_points.map((point) => (
                          <li key={point} className="text-sm text-foreground">- {point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {assistantSummary?.summary ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                        <h4 className="text-sm font-semibold text-foreground mb-2">Doctor Brief</h4>
                        <p className="text-sm text-foreground">
                          {((assistantSummary.summary as any).doctor_brief?.quick_text as string)
                            || ((assistantSummary.summary as any).doctor_brief?.one_liner as string)
                            || "Summary prepared."}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Key Findings</h4>
                        <ul className="space-y-1">
                          {(((assistantSummary.summary as any).doctor_brief?.key_findings as string[]) || []).map((point) => (
                            <li key={point} className="text-sm text-foreground">- {point}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Current Conditions</h4>
                        <div className="flex flex-wrap gap-2">
                          {(((assistantSummary.summary as any).clinical_context?.conditions as string[]) || []).slice(0, 8).map((item) => (
                            <span key={item} className="px-2 py-1 rounded-md bg-muted text-xs text-foreground">{item}</span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Current Medications</h4>
                        <ul className="space-y-1">
                          {(((assistantSummary.summary as any).clinical_context?.medications as string[]) || []).slice(0, 6).map((item) => (
                            <li key={item} className="text-sm text-foreground">- {item}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2">Pre-Consultation Checklist</h4>
                        <ul className="space-y-1">
                          {(((assistantSummary.summary as any).pre_consultation_checklist as string[]) || []).slice(0, 6).map((item) => (
                            <li key={item} className="text-sm text-foreground">- {item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}

                  {assistantSummary?.cautions?.length ? (
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Helpful Notes</h4>
                      <ul className="space-y-1">
                        {assistantSummary.cautions.map((point) => (
                          <li key={point} className="text-sm text-foreground">- {point}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {/* Patient Header Card */}
            <Card hoverable className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden ring-4 ring-background shadow-md">
                    <Image
                      src={resolveAvatarUrl(
                        patient.profile_photo_url,
                        `${patient.id || ""}${patient.first_name || ""}${patient.last_name || ""}`
                      )}
                      alt={`${patient.first_name} ${patient.last_name}`}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                      {patient.first_name} {patient.last_name}
                    </h1>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                      {patient.age && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          {patient.age} years
                        </span>
                      )}
                      {patient.gender && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                          <User className="w-3.5 h-3.5" />
                          {patient.gender}
                        </span>
                      )}
                      {patient.blood_group && (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-medium">
                          <Droplet className="w-3.5 h-3.5" />
                          {patient.blood_group}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* Contact & Personal Info */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      Personal Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoItem icon={Mail} label="Email" value={patient.email} />
                      <InfoItem icon={Phone} label="Phone" value={patient.phone} />
                      <InfoItem icon={Calendar} label="Date of Birth" value={patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : null} />
                      <InfoItem icon={UserCheck} label="Marital Status" value={patient.marital_status} />
                      <InfoItem icon={Briefcase} label="Occupation" value={patient.occupation} />
                      <InfoItem icon={MapPin} label="Address" value={[patient.address, patient.city, patient.district].filter(Boolean).join(", ")} />
                    </div>
                  </CardContent>
                </Card>

                {/* Physical Measurements */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-success/10">
                        <Activity className="w-5 h-5 text-success" />
                      </div>
                      Physical Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <MeasurementCard 
                        icon={Ruler} 
                        label="Height" 
                        value={patient.height ? `${patient.height} cm` : "Not recorded"} 
                      />
                      <MeasurementCard 
                        icon={Weight} 
                        label="Weight" 
                        value={patient.weight ? `${patient.weight} kg` : "Not recorded"} 
                      />
                      <MeasurementCard 
                        icon={Droplet} 
                        label="Blood Group" 
                        value={patient.blood_group || "Not recorded"} 
                        highlight
                      />
                      <MeasurementCard 
                        icon={Activity} 
                        label="BMI" 
                        value={patient.height && patient.weight 
                          ? (patient.weight / ((patient.height / 100) ** 2)).toFixed(1)
                          : "N/A"
                        } 
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Chronic Conditions */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <Heart className="w-5 h-5 text-destructive" />
                      </div>
                      Chronic Conditions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {patient.chronic_conditions.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {patient.chronic_conditions.map((condition, index) => (
                          <span 
                            key={index}
                            className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm font-medium"
                          >
                            {condition}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No chronic conditions reported</p>
                    )}
                  </CardContent>
                </Card>

                {/* Medications & Allergies */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Pill className="w-5 h-5 text-primary" />
                      </div>
                      Medications & Allergies
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    <div>
                      <h4 className="font-medium text-sm text-foreground mb-2">Current Medications</h4>
                      {patient.medications && patient.medications.length > 0 ? (
                        <div className="space-y-2">
                          {patient.medications.map((med: any, index: number) => (
                            <div 
                              key={index}
                              className="p-3 rounded-lg bg-primary/5 border border-primary/10"
                            >
                              <div className="flex justify-between items-start">
                                <span className="font-medium text-foreground">
                                  {typeof med === 'string' ? med : med.name || 'Unknown'}
                                </span>
                                {typeof med === 'object' && med.dosage && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    {med.dosage}
                                  </span>
                                )}
                              </div>
                              {typeof med === 'object' && (
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  {med.frequency && <div>Frequency: {med.frequency}</div>}
                                  {med.duration && <div>Duration: {med.duration}</div>}
                                  {med.prescribing_doctor && <div>Prescribed by: {med.prescribing_doctor}</div>}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No medications reported</p>
                      )}
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Drug Allergies
                      </h4>
                      {patient.drug_allergies && patient.drug_allergies.length > 0 ? (
                        <div className="space-y-2">
                          {patient.drug_allergies.map((allergy: any, index: number) => (
                            <div 
                              key={index}
                              className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
                            >
                              <span className="font-medium text-amber-700 dark:text-amber-400">
                                {typeof allergy === 'string' ? allergy : allergy.drug_name || 'Unknown'}
                              </span>
                              {typeof allergy === 'object' && allergy.reaction && (
                                <span className="text-xs text-amber-600 dark:text-amber-500 ml-2">
                                  ({allergy.reaction})
                                </span>
                              )}
                              {typeof allergy === 'object' && allergy.severity && (
                                <span className={`text-xs ml-2 px-2 py-0.5 rounded ${
                                  allergy.severity === 'severe' 
                                    ? 'bg-destructive/10 text-destructive' 
                                    : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                                }`}>
                                  {allergy.severity}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">No drug allergies reported</p>
                      )}
                    </div>

                    {patient.food_allergies && (
                      <div>
                        <h4 className="font-medium text-sm text-foreground mb-2">Food Allergies</h4>
                        <p className="text-sm text-muted-foreground">{patient.food_allergies}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Medical History */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-purple-500/10">
                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      Medical History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    <HistorySection 
                      title="Surgeries" 
                      items={patient.surgeries} 
                    />
                    <HistorySection 
                      title="Hospitalizations" 
                      items={patient.hospitalizations} 
                    />
                    {patient.ongoing_treatments && (
                      <div>
                        <h4 className="font-medium text-sm text-foreground mb-2">Ongoing Treatments</h4>
                        <p className="text-sm text-muted-foreground">{patient.ongoing_treatments}</p>
                      </div>
                    )}
                    {patient.last_checkup_date && (
                      <div>
                        <h4 className="font-medium text-sm text-foreground mb-2">Last Checkup</h4>
                        <p className="text-sm text-muted-foreground">{new Date(patient.last_checkup_date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Lifestyle */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-success/10">
                        <Activity className="w-5 h-5 text-success" />
                      </div>
                      Lifestyle
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <InfoItem label="Smoking" value={patient.smoking_status || "Not specified"} />
                      <InfoItem label="Alcohol" value={patient.alcohol_consumption || "Not specified"} />
                      <InfoItem label="Activity Level" value={patient.activity_level || "Not specified"} />
                      <InfoItem label="Sleep (hours)" value={patient.sleep_hours?.toString() || "Not specified"} />
                      <InfoItem label="Stress Level" value={patient.stress_level || "Not specified"} />
                      <InfoItem label="Diet" value={patient.diet_type || "Not specified"} />
                    </div>
                    {patient.mental_health_concerns && (
                      <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                        <h4 className="font-medium text-sm text-amber-700 dark:text-amber-400 mb-1">Mental Health Concerns</h4>
                        <p className="text-sm text-amber-600 dark:text-amber-500">{patient.mental_health_concerns}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Past Consultations & Prescriptions */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <History className="w-5 h-5 text-primary" />
                      </div>
                      Past Consultations & Prescriptions
                    </CardTitle>
                    <CardDescription>
                      Review this doctor-patient consultation timeline and open historical details.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-5">
                    {prescriptionHistoryRestricted ? (
                      <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
                        This patient has restricted prescription history sharing for this view.
                      </div>
                    ) : consultationHistory.length === 0 && prescriptionHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No previous consultation or prescription records are available for this patient yet.
                      </p>
                    ) : null}

                    {!prescriptionHistoryRestricted && consultationHistory.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-foreground">Consultations</h4>
                        {consultationHistory.slice(0, 8).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => router.push(`/doctor/patient/${patientId}/consultation?consultation_id=${entry.id}`)}
                            className="w-full rounded-xl border border-border/70 bg-card/70 p-3 text-left transition-colors hover:bg-muted/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {entry.consultation_date ? formatShortDateTime(entry.consultation_date) : "Date not available"}
                              </p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusChipClass(entry.status)}`}>
                                {formatStatusText(entry.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                              {entry.chief_complaint || entry.diagnosis || "Consultation details available"}
                            </p>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {entry.prescription_count} prescription{entry.prescription_count === 1 ? "" : "s"}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                                View details
                                <ExternalLink className="h-3 w-3" />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {!prescriptionHistoryRestricted && prescriptionHistory.length > 0 ? (
                      <div className="space-y-2 border-t border-border/50 pt-3">
                        <h4 className="text-sm font-semibold text-foreground">Recent Prescriptions</h4>
                        {prescriptionHistory.slice(0, 8).map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() =>
                              router.push(`/prescription/preview/${entry.consultation_id}?prescription_id=${entry.id}`)
                            }
                            className="w-full rounded-xl border border-border/70 bg-card/70 p-3 text-left transition-colors hover:bg-muted/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {humanizePrescriptionType(entry.type)}
                              </p>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getStatusChipClass(entry.status)}`}>
                                {formatStatusText(entry.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {entry.created_at ? formatShortDateTime(entry.created_at) : "Date not available"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              <span>{entry.medication_count} meds</span>
                              <span>{entry.test_count} tests</span>
                              <span>{entry.surgery_count} procedures</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* Emergency Contact */}
                <Card hoverable className="border-destructive/20">
                  <CardHeader className="border-b border-destructive/10">
                    <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                      <div className="p-2 rounded-lg bg-destructive/10">
                        <Shield className="w-5 h-5 text-destructive" />
                      </div>
                      Emergency Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {patient.emergency_contact_name ? (
                      <div className="space-y-2">
                        <p className="font-medium text-foreground">{patient.emergency_contact_name}</p>
                        <p className="text-sm text-muted-foreground">{patient.emergency_contact_relationship}</p>
                        <p className="text-sm flex items-center gap-2 text-foreground">
                          <Phone className="w-4 h-4" />
                          {patient.emergency_contact_phone}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No emergency contact provided</p>
                    )}
                  </CardContent>
                </Card>

                {/* Family History */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-secondary">
                        <Home className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      Family History
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-5">
                    <div className="space-y-2">
                      <FamilyHistoryItem condition="Diabetes" hasCondition={patient.family_has_diabetes} />
                      <FamilyHistoryItem condition="Heart Disease" hasCondition={patient.family_has_heart_disease} />
                      <FamilyHistoryItem condition="Cancer" hasCondition={patient.family_has_cancer} />
                      <FamilyHistoryItem condition="Hypertension" hasCondition={patient.family_has_hypertension} />
                      <FamilyHistoryItem condition="Stroke" hasCondition={patient.family_has_stroke} />
                    </div>
                  </CardContent>
                </Card>

                {/* Appointment History with this Doctor */}
                <Card hoverable>
                  <CardHeader className="border-b border-border">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Stethoscope className="w-5 h-5 text-primary" />
                      </div>
                      Appointment History
                    </CardTitle>
                    <CardDescription>Your appointments with this patient</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-5">
                    {patient.appointment_history.length > 0 ? (
                      <div className="space-y-3">
                        {patient.appointment_history.map((appt) => (
                          <div 
                            key={appt.id}
                            className="p-3 border border-border rounded-lg bg-background"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-foreground">
                                {new Date(appt.date).toLocaleDateString()}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                appt.status === 'completed' 
                                  ? 'bg-success/10 text-success'
                                  : appt.status === 'confirmed'
                                  ? 'bg-primary/10 text-primary'
                                  : appt.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {appt.status}
                              </span>
                            </div>
                            {appt.reason && (
                              (() => {
                                const { consultationType, appointmentType } = parseCompositeReason(appt.reason)
                                const ct = humanizeConsultationType(consultationType)
                                const at = humanizeAppointmentType(appointmentType)
                                return (
                                  <>
                                    <p className="text-sm text-muted-foreground">{ct}{at ? ` • ${at}` : ''}</p>
                                    {appt.notes && <p className="text-xs text-muted-foreground mt-1">{appt.notes}</p>}
                                  </>
                                )
                              })()
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No appointment history</p>
                    )}
                  </CardContent>
                </Card>

                {/* Patient Health Metrics (consent-based) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      Patient Health Metrics
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Real-time health tracking data shared by the patient
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {healthLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <ButtonLoader className="w-4 h-4" />
                        <span>Loading health data...</span>
                      </div>
                    ) : healthNoConsent ? (
                      <div className="rounded-lg bg-muted/50 p-4 text-center">
                        <Shield className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                        <p className="text-sm font-medium text-foreground">No Health Data Access</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This patient has not shared their health metrics with you yet. They can enable sharing from their Analytics page.
                        </p>
                      </div>
                    ) : healthOverview ? (
                      <div className="space-y-3">
                        {healthOverview.today_metrics.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {healthOverview.today_metrics.map((metric) => {
                              const iconMap: Record<string, typeof Heart> = {
                                steps: Footprints, sleep_hours: MoonStar, heart_rate: Heart,
                                blood_pressure_systolic: Waves, blood_pressure_diastolic: Waves,
                                weight: Weight,
                              }
                              const Icon = iconMap[metric.metric_type] || Activity
                              const labelMap: Record<string, string> = {
                                steps: "Steps", sleep_hours: "Sleep", heart_rate: "Heart Rate",
                                blood_pressure_systolic: "BP Systolic", blood_pressure_diastolic: "BP Diastolic",
                                weight: "Weight", blood_sugar: "Blood Sugar",
                              }
                              return (
                                <div key={metric.metric_type} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                    <Icon className="h-3 w-3" />
                                    {labelMap[metric.metric_type] || metric.metric_type}
                                  </div>
                                  <p className="text-lg font-bold tabular-nums text-foreground">
                                    {metric.value} <span className="text-xs font-normal text-muted-foreground">{metric.unit}</span>
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No metrics logged today</p>
                        )}
                        {healthOverview.trends.length > 0 && (
                          <div className="border-t border-border/40 pt-2">
                            <p className="text-xs font-semibold text-muted-foreground mb-2">7-Day Trends</p>
                            <div className="space-y-1.5">
                              {healthOverview.trends.map((series) => {
                                const last = series.points[series.points.length - 1]
                                const first = series.points[0]
                                const diff = last && first ? ((last.average_value - first.average_value) / (first.average_value || 1)) * 100 : 0
                                return (
                                  <div key={series.metric_type} className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground capitalize">{series.metric_type.replace(/_/g, " ")}</span>
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium text-foreground">{last?.average_value ?? "--"} {series.unit}</span>
                                      <span className={`text-[0.65rem] ${diff > 3 ? "text-emerald-500" : diff < -3 ? "text-rose-500" : "text-muted-foreground"}`}>
                                        {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                                      </span>
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        <p className="text-[0.65rem] text-muted-foreground">
                          Consent granted {new Date(healthOverview.consent_granted_at).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unable to load health data</p>
                    )}
                  </CardContent>
                </Card>

                {/* Access Info */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="p-1.5 rounded-full bg-muted">
                        <Clock className="w-3 h-3" />
                      </div>
                      Accessed at: {formatShortDateTime(patient.access_timestamp)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 pl-7">
                      Patient has been notified of this access.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
      </main>
      </AppBackground>
  )
}

function formatStatusText(status?: string | null) {
  if (!status) return "Unknown"
  return status
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
    .join(" ")
}

function getStatusChipClass(status?: string | null) {
  const normalized = (status || "").toLowerCase()
  if (["accepted", "completed"].includes(normalized)) return "bg-success/15 text-success-muted"
  if (["open", "confirmed"].includes(normalized)) return "bg-primary/10 text-primary"
  if (["pending"].includes(normalized)) return "bg-warning/15 text-warning"
  if (["rejected", "cancelled", "cancelled_by_patient", "hold_expired"].includes(normalized)) {
    return "bg-destructive/10 text-destructive"
  }
  return "bg-muted text-muted-foreground"
}

function humanizePrescriptionType(type?: string | null) {
  if (!type) return "Prescription"
  const normalized = type.toLowerCase()
  if (normalized === "medication") return "Medication Prescription"
  if (normalized === "test") return "Test Prescription"
  if (normalized === "surgery") return "Procedure Recommendation"
  return formatStatusText(type)
}

function DoctorPatientRecordSkeleton() {
  return (
    <section role="status" aria-live="polite" aria-label="Loading patient records" className="space-y-6">
      <div className="flex justify-center py-3 sm:py-4">
        <MedoraLoader size="lg" label="Loading patient records..." />
      </div>

      <CardSkeleton className="h-36 w-full" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSkeleton className="h-44 w-full" />
          <CardSkeleton className="h-40 w-full" />
          <CardSkeleton className="h-40 w-full" />
          <CardSkeleton className="h-44 w-full" />
          <CardSkeleton className="h-40 w-full" />
          <CardSkeleton className="h-44 w-full" />
        </div>
        <div className="space-y-6">
          <CardSkeleton className="h-40 w-full" />
          <CardSkeleton className="h-36 w-full" />
          <CardSkeleton className="h-64 w-full" />
          <CardSkeleton className="h-56 w-full" />
        </div>
      </div>
    </section>
  )
}

// Helper Components
function InfoItem({ icon: Icon, label, value }: { icon?: any; label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      {Icon && (
        <div className="p-2 rounded-lg bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function MeasurementCard({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-xl text-center transition-all hover:scale-105 ${
      highlight 
        ? 'bg-destructive/5 border border-destructive/20' 
        : 'bg-muted/50'
    }`}>
      <div className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
        highlight ? 'bg-destructive/10' : 'bg-background shadow-sm'
      }`}>
        <Icon className={`w-5 h-5 ${highlight ? 'text-destructive' : 'text-muted-foreground'}`} />
      </div>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className={`text-base font-bold ${highlight ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
    </div>
  )
}

function HistorySection({ title, items }: { title: string; items: any[] | null }) {
  return (
    <div>
      <h4 className="font-semibold text-sm text-foreground mb-3">{title}</h4>
      {items && items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={index} className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg border border-border">
              {typeof item === 'string' ? (
                item
              ) : (
                <div>
                  <span className="font-medium text-foreground">{item.name || item.reason || 'Unknown'}</span>
                  {item.year && <span className="text-muted-foreground ml-2 text-xs bg-muted px-2 py-0.5 rounded">({item.year})</span>}
                  {item.hospital && <span className="text-muted-foreground block mt-1 text-xs">at {item.hospital}</span>}
                  {item.duration_days && <span className="text-muted-foreground text-xs"> - {item.duration_days} days</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm italic">None reported</p>
      )}
    </div>
  )
}

function FamilyHistoryItem({ condition, hasCondition }: { condition: string; hasCondition: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm p-2 rounded-lg ${
      hasCondition ? 'bg-destructive/5' : 'bg-muted/30'
    }`}>
      <span className="font-medium text-foreground">{condition}</span>
      {hasCondition ? (
        <span className="text-destructive font-semibold bg-destructive/10 px-2 py-0.5 rounded text-xs">Yes</span>
      ) : (
        <span className="text-muted-foreground bg-muted px-2 py-0.5 rounded text-xs">No</span>
      )}
    </div>
  )
}
