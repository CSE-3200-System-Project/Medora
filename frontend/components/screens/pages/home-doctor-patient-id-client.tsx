"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { 
  User, Calendar, Phone, Mail, MapPin, Heart, Activity, 
  AlertCircle, Pill, Stethoscope, ArrowLeft, Clock,
  Weight, Ruler, Droplet, FileText, Shield, UserCheck,
  Home, Briefcase, AlertTriangle, MessageSquarePlus
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Navbar } from "@/components/ui/navbar"
import { AppBackground } from "@/components/ui/app-background"
import { getPatientForDoctor } from "@/lib/patient-access-actions"
import { parseCompositeReason, humanizeConsultationType, humanizeAppointmentType } from "@/lib/utils"

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
  
  access_timestamp: string
}

export default function DoctorPatientViewPage() {
  const params = useParams()
  const router = useRouter()
  const patientId = params.id as string
  
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (loading) {
    return (
      <AppBackground>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center pt-[var(--nav-content-offset)]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Loading patient records...</p>
          </div>
        </div>
      </AppBackground>
    )
  }

  if (error) {
    return (
      <AppBackground>
        <Navbar />
        <div className="min-h-screen flex items-center justify-center p-4 pt-[var(--nav-content-offset)]">
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

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="min-h-screen pt-[var(--nav-content-offset)] pb-8">
        {/* Top Header Bar */}
        <div className="bg-background/80 backdrop-blur-md border-b border-border sticky top-16 z-10">
          <div className="max-w-6xl mx-auto container-padding py-3 flex items-center justify-between">
              <Button 
                variant="outline" 
                onClick={() => router.back()}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back to My Patients</span>
                <span className="sm:hidden">Back</span>
              </Button>
              
              <Button
                onClick={() => router.push(`/doctor/patient/${patientId}/consultation`)}
                className="gap-2"
              >
                <MessageSquarePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Start Consultation</span>
                <span className="sm:hidden">Consult</span>
              </Button>
            </div>
          </div>


        <div className="max-w-6xl mx-auto container-padding py-6">
            {/* Patient Header Card */}
            <Card hoverable className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden ring-4 ring-background shadow-md">
                    {patient.profile_photo_url ? (
                      <Image
                        src={patient.profile_photo_url}
                        alt={`${patient.first_name} ${patient.last_name}`}
                        width={96}
                        height={96}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <User className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
                    )}
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

                {/* Access Info */}
                <Card className="bg-muted/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="p-1.5 rounded-full bg-muted">
                        <Clock className="w-3 h-3" />
                      </div>
                      Accessed at: {new Date(patient.access_timestamp).toLocaleString()}
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
