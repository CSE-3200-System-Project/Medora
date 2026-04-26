"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { getPatientSummary } from "@/lib/auth-actions";
import { getPatientCalendarSummary } from "@/lib/appointment-actions";
import { Navbar } from "@/components/ui/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppBackground } from "@/components/ui/app-background";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { useAppI18n, useT } from "@/i18n/client";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Droplets,
  Activity,
  Heart,
  AlertCircle,
  Pill,
  Shield,
  Edit,
  FileText,
  Users,
  Scale,
  Ruler,
  Bell,
  Hospital,
} from "lucide-react";

interface Medication {
  name?: string;
  display_name?: string;
  dosage?: string;
  frequency?: string;
}

interface DrugAllergy {
  name: string;
  reaction?: string;
  severity?: string;
}

interface Surgery {
  name: string;
  year: string;
  hospital?: string;
}

interface Hospitalization {
  reason: string;
  year: string;
  duration?: string;
}

interface PatientData {
  // Profile
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  // Patient specific
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
  profile_photo_url?: string;
  nid_number?: string;
  address?: string;
  city?: string;
  district?: string;
  postal_code?: string;
  country?: string;
  height?: number;
  weight?: number;
  marital_status?: string;
  occupation?: string;
  // Chronic conditions
  has_diabetes?: boolean;
  has_hypertension?: boolean;
  has_heart_disease?: boolean;
  has_asthma?: boolean;
  has_kidney_disease?: boolean;
  has_liver_disease?: boolean;
  has_thyroid?: boolean;
  has_mental_health?: boolean;
  conditions?: Array<{name: string}>;
  // Allergies & medications
  allergies?: string;
  medications?: Medication[];
  medications_preview?: Medication[];
  medications_count?: number;
  drug_allergies?: DrugAllergy[];
  // Medical history
  surgeries?: Surgery[];
  surgeries_preview?: Surgery[];
  surgeries_count?: number;
  hospitalizations?: Hospitalization[];
  hospitalizations_preview?: Hospitalization[];
  hospitalizations_count?: number;
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

interface AppointmentSummary {
  appointment_date: string;
}

interface CalendarSummaryResponse {
  total: number;
  upcoming_count: number;
  next_appointment: { id: string; appointment_date: string; status: string } | null;
  last_visit: { id: string; appointment_date: string } | null;
}

export default function PatientProfilePage() {
  const router = useRouter();
  const tCommon = useT("common");
  const { locale } = useAppI18n();
  const [patient, setPatient] = React.useState<PatientData | null>(null);
  const [appointments, setAppointments] = React.useState<AppointmentSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadPatientProfile();
  }, []);

  const loadPatientProfile = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      // Run profile summary + calendar summary in parallel.
      // Each fires immediately rather than waterfalling.
      const [summary, calendarSummary] = await Promise.all([
        getPatientSummary(),
        getPatientCalendarSummary().catch(() => null),
      ]);

      if (!summary) {
        setPatient(null);
        setLoadError(tCommon("patientProfile.errors.sessionVerifyFailed"));
        return;
      }

      // Map backend summary fields to component shape (preserve preview arrays
      // under their canonical names so existing render code keeps working).
      const mapped: PatientData = {
        ...summary,
        medications: summary.medications_preview || summary.medications || [],
        surgeries: summary.surgeries_preview || summary.surgeries || [],
        hospitalizations: summary.hospitalizations_preview || summary.hospitalizations || [],
      };
      setPatient(mapped);

      const cal = calendarSummary as CalendarSummaryResponse | null;
      // The Recent Visits card only displays the last visit date; emit a tiny
      // synthetic list so the existing JSX doesn't have to change shape.
      const visitList: AppointmentSummary[] = [];
      if (cal?.next_appointment) visitList.push({ appointment_date: cal.next_appointment.appointment_date });
      if (cal?.last_visit) visitList.push({ appointment_date: cal.last_visit.appointment_date });
      setAppointments(visitList);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setPatient(null);
      setLoadError(tCommon("patientProfile.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dob: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const getChronicConditions = () => {
    if (!patient) return [];
    const conditions: string[] = [];
    // From boolean flags
    if (patient.has_diabetes) conditions.push("Diabetes");
    if (patient.has_hypertension) conditions.push("Hypertension");
    if (patient.has_heart_disease) conditions.push("Heart Disease");
    if (patient.has_asthma) conditions.push("Asthma");
    if (patient.has_kidney_disease) conditions.push("Kidney Disease");
    if (patient.has_liver_disease) conditions.push("Liver Disease");
    if (patient.has_thyroid) conditions.push("Thyroid");
    if (patient.has_mental_health) conditions.push("Mental Health");
    // From conditions array (defensive check)
    if (patient.conditions && Array.isArray(patient.conditions)) {
      patient.conditions.forEach(c => {
        if (c && c.name && !conditions.includes(c.name)) {
          conditions.push(c.name);
        }
      });
    }
    return conditions;
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="mx-auto max-w-6xl py-8 pt-[var(--nav-content-offset)]">
          <PageLoadingShell label={tCommon("patientProfile.loading")} cardCount={5} />
        </main>
      </AppBackground>
    );
  }

  if (!patient) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <div className="flex items-center justify-center min-h-dvh min-h-app">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground mb-2">{tCommon("patientProfile.errorTitle")}</p>
            <p className="text-sm text-muted-foreground mb-4">{loadError ?? tCommon("patientProfile.retryHint")}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={loadPatientProfile} variant="outline" className="touch-target">{tCommon("patientProfile.actions.retry")}</Button>
              <Button onClick={() => router.push('/login')} className="touch-target">{tCommon("patientProfile.actions.goToLogin")}</Button>
            </div>
          </div>
        </div>
      </AppBackground>
    );
  }

  const chronicConditions = getChronicConditions();
  const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : null;
  const profileCompletenessChecks = [
    { label: tCommon("patientProfile.completeness.dateOfBirth"), complete: !!patient.date_of_birth },
    { label: tCommon("patientProfile.completeness.gender"), complete: !!patient.gender },
    { label: tCommon("patientProfile.completeness.bloodGroup"), complete: !!patient.blood_group },
    { label: tCommon("patientProfile.completeness.addressDetails"), complete: !!(patient.address && patient.city && patient.district) },
    { label: tCommon("patientProfile.completeness.heightWeight"), complete: !!(patient.height && patient.weight) },
    { label: tCommon("patientProfile.completeness.emergencyContact"), complete: !!(patient.emergency_contact_name && patient.emergency_contact_phone) },
    { label: tCommon("patientProfile.completeness.allergyDetails"), complete: !!(patient.allergies || (patient.drug_allergies && patient.drug_allergies.length > 0)) },
  ];
  const missingProfileItems = profileCompletenessChecks.filter((item) => !item.complete);
  const completionPercent = Math.round(((profileCompletenessChecks.length - missingProfileItems.length) / profileCompletenessChecks.length) * 100);

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />
      
      <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">{tCommon("patientProfile.title")}</h1>
            <p className="text-muted-foreground mt-1">{tCommon("patientProfile.subtitle")}</p>
          </div>
          <Button variant="medical" size="lg" onClick={() => router.push('/onboarding/patient?mode=edit')} className="touch-target">
            <Edit className="h-4 w-4 mr-2" />
            {tCommon("patientProfile.actions.editProfile")}
          </Button>
        </div>

        {missingProfileItems.length > 0 && (
          <Card className="mb-6 border-amber-300/60 bg-amber-100/30 dark:border-amber-700/60 dark:bg-amber-900/20">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">{tCommon("patientProfile.completeness.progress", { percent: completionPercent })}</p>
                  <p className="text-sm text-amber-900/90 dark:text-amber-100">
                    {tCommon("patientProfile.completeness.missingSummary", { count: missingProfileItems.length })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {missingProfileItems.slice(0, 5).map((item) => (
                      <Badge key={item.label} variant="outline" className="border-amber-400/70 bg-transparent text-amber-900 dark:text-amber-100">
                        {item.label}
                      </Badge>
                    ))}
                    {missingProfileItems.length > 5 ? (
                      <Badge variant="outline" className="border-amber-400/70 bg-transparent text-amber-900 dark:text-amber-100">
                        {tCommon("patientProfile.completeness.more", { count: missingProfileItems.length - 5 })}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <Button variant="outline" onClick={() => router.push('/onboarding/patient?mode=edit')} className="border-amber-500/60 bg-background/80 hover:bg-background">
                  {tCommon("patientProfile.actions.completeMissingData")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Header Card */}
        <Card className="mb-6 overflow-hidden border-none shadow-lg">
          <div className="bg-gradient-to-r from-primary via-primary-muted to-primary h-32 sm:h-40" />
          <CardContent className="relative px-4 sm:px-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 -mt-16 sm:-mt-20">
              <Avatar className="h-28 w-28 sm:h-36 sm:w-36 border-4 border-background shadow-lg">
                <AvatarImage src={patient.profile_photo_url} alt={`${patient.first_name} ${patient.last_name}`} />
                <AvatarFallback className="bg-primary text-primary-foreground text-3xl font-bold">
                  {patient.first_name?.[0]}{patient.last_name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left pb-2 flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {patient.first_name} {patient.last_name}
                </h2>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  {patient.gender && (
                    <Badge variant="secondary" className="font-medium">
                      {patient.gender}
                    </Badge>
                  )}
                  {age && (
                    <Badge variant="outline" className="font-medium">
                      {tCommon("patientProfile.ageYears", { age })}
                    </Badge>
                  )}
                  {patient.blood_group && (
                    <Badge className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                      <Droplets className="h-3 w-3 mr-1" />
                      {patient.blood_group}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <Card hoverable className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" />
                {tCommon("patientProfile.sections.contactInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.email")}</p>
                  <p className="font-medium break-all">{patient.email || tCommon("patientProfile.notProvided")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.phone")}</p>
                  <p className="font-medium break-all">{patient.phone || tCommon("patientProfile.notProvided")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.address")}</p>
                  <p className="font-medium break-words">
                    {[patient.address, patient.city, patient.district, patient.country].filter(Boolean).join(', ') || tCommon("patientProfile.notProvided")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Physical Information */}
          <Card hoverable className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                {tCommon("patientProfile.sections.physicalInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Ruler className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.height")}</p>
                  <p className="text-xl font-bold text-foreground">
                    {patient.height ? `${patient.height} cm` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Scale className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.weight")}</p>
                  <p className="text-xl font-bold text-foreground">
                    {patient.weight ? `${patient.weight} kg` : '--'}
                  </p>
                </div>
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Calendar className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.dateOfBirth")}</p>
                  <p className="text-sm font-bold text-foreground">
                    {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US") : '--'}
                  </p>
                </div>
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Users className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.maritalStatus")}</p>
                  <p className="text-sm font-bold text-foreground capitalize">
                    {patient.marital_status || '--'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Care & Monitoring - Quick Access */}
          <Card hoverable className="border-border/50 shadow-md lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                {tCommon("patientProfile.sections.careMonitoring")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Prescriptions Card */}
                <button
                  onClick={() => router.push('/patient/prescriptions')}
                  className="p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-900/10 rounded-lg border border-blue-200/60 dark:border-blue-800/40 hover:shadow-md dark:hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-700 transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Pill className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-900 dark:text-blue-300">{tCommon("patientProfile.cards.prescriptions.title")}</p>
                      <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{tCommon("patientProfile.cards.prescriptions.subtitle")}</p>
                    </div>
                  </div>
                </button>
                {/* Reminders Card */}
                <button
                  onClick={() => router.push('/patient/reminders')}
                  className="p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/20 dark:to-amber-900/10 rounded-lg border border-amber-200/60 dark:border-amber-800/40 hover:shadow-md dark:hover:shadow-lg hover:border-amber-300 dark:hover:border-amber-700 transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Bell className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-900 dark:text-amber-300">{tCommon("patientProfile.cards.reminders.title")}</p>
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{tCommon("patientProfile.cards.reminders.subtitle")}</p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Medical Conditions */}
          <Card hoverable className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-primary" />
                {tCommon("patientProfile.sections.medicalConditions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chronicConditions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {chronicConditions.map((condition, index) => (
                    <Badge key={index} variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                      {condition}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{tCommon("patientProfile.empty.noChronicConditions")}</p>
              )}
              {/* Current Medications */}
              {patient.medications && patient.medications.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" />
                    {tCommon("patientProfile.sections.currentMedications")}
                  </p>
                  <div className="space-y-1">
                    {patient.medications.slice(0, 3).map((med, i) => (
                      <p key={i} className="text-sm text-muted-foreground">• {med.name || med.display_name || tCommon("patientProfile.unknownMedication")}</p>
                    ))}
                    {patient.medications.length > 3 && (
                      <p className="text-xs text-primary mt-2">{tCommon("patientProfile.completeness.more", { count: patient.medications.length - 3 })}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card hoverable className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertCircle className="h-5 w-5 text-destructive" />
                {tCommon("patientProfile.sections.allergies")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.allergies || (patient.drug_allergies && patient.drug_allergies.length > 0) ? (
                <div className="space-y-2">
                  {patient.allergies && (
                    <p className="text-sm">{patient.allergies}</p>
                  )}
                  {patient.drug_allergies && patient.drug_allergies.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {patient.drug_allergies.map((allergy: DrugAllergy, index: number) => (
                        <Badge key={index} variant="destructive" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                          {typeof allergy === 'string' ? allergy : allergy.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{tCommon("patientProfile.empty.noAllergies")}</p>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card hoverable className="border-border/50 shadow-md lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                {tCommon("patientProfile.sections.emergencyContact")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.emergency_contact_name ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 p-4 bg-surface dark:bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.name")}</p>
                    <p className="font-medium">{patient.emergency_contact_name}</p>
                  </div>
                  <div className="flex-1 p-4 bg-surface dark:bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.relation")}</p>
                    <p className="font-medium capitalize">{patient.emergency_contact_relation || tCommon("patientProfile.notSpecified")}</p>
                  </div>
                  <div className="flex-1 p-4 bg-surface dark:bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground">{tCommon("patientProfile.fields.phone")}</p>
                    <p className="font-medium">{patient.emergency_contact_phone || tCommon("patientProfile.notProvided")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{tCommon("patientProfile.empty.noEmergencyContact")}</p>
              )}
            </CardContent>
          </Card>

          {/* Medical History Summary */}
          <Card hoverable className="border-border/50 shadow-md lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  {tCommon("patientProfile.sections.medicalHistoryCare")}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push('/patient/medical-history')} className="touch-target">
                  {tCommon("patientProfile.actions.viewAll")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Surgeries */}
                <div className="p-4 bg-surface/50 dark:bg-muted/20 rounded-lg border border-border/50 hover:bg-surface/80 dark:hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => router.push('/patient/medical-history')}>
                  <div className="flex items-center gap-2 mb-2">
                    <Hospital className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{tCommon("patientProfile.sections.surgeries")}</p>
                  </div>
                  {patient.surgeries && patient.surgeries.length > 0 ? (
                    <div className="space-y-1">
                      {patient.surgeries.slice(0, 2).map((s: Surgery, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {s.name} ({s.year})</p>
                      ))}
                      {patient.surgeries.length > 2 && (
                        <p className="text-xs text-primary">{tCommon("patientProfile.completeness.more", { count: patient.surgeries.length - 2 })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{tCommon("patientProfile.empty.noSurgeries")}</p>
                  )}
                </div>
                {/* Hospitalizations */}
                <div className="p-4 bg-surface/50 dark:bg-muted/20 rounded-lg border border-border/50 hover:bg-surface/80 dark:hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => router.push('/patient/medical-history')}>
                  <div className="flex items-center gap-2 mb-2">
                    <Hospital className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{tCommon("patientProfile.sections.hospitalizations")}</p>
                  </div>
                  {patient.hospitalizations && patient.hospitalizations.length > 0 ? (
                    <div className="space-y-1">
                      {patient.hospitalizations.slice(0, 2).map((h: Hospitalization, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {h.reason} ({h.year})</p>
                      ))}
                      {patient.hospitalizations.length > 2 && (
                        <p className="text-xs text-primary">{tCommon("patientProfile.completeness.more", { count: patient.hospitalizations.length - 2 })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{tCommon("patientProfile.empty.noHospitalizations")}</p>
                  )}
                </div>
                {/* Recent Visits */}
                <div className="p-4 bg-surface/50 dark:bg-muted/20 rounded-lg border border-border/50 hover:bg-surface/80 dark:hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => router.push('/patient/appointments')}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{tCommon("patientProfile.sections.recentVisits")}</p>
                  </div>
                  {appointments.length > 0 ? (
                    <div className="space-y-1">
                      {appointments.slice(0, 2).map((app, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {new Date(app.appointment_date).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US")}
                        </p>
                      ))}
                      {appointments.length > 2 && (
                        <p className="text-xs text-primary">{tCommon("patientProfile.completeness.more", { count: appointments.length - 2 })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{tCommon("patientProfile.empty.noVisits")}</p>
                  )}
                </div>
                {/* Prescriptions */}
                <div className="p-4 bg-blue-50/50 dark:bg-blue-900/15 rounded-lg border border-blue-200/50 dark:border-blue-800/50 hover:bg-blue-100/50 dark:hover:bg-blue-900/25 cursor-pointer transition-colors" onClick={() => router.push('/patient/prescriptions')}>
                  <div className="flex items-center gap-2 mb-2">
                    <Pill className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <p className="font-medium text-sm text-blue-900 dark:text-blue-300">{tCommon("patientProfile.cards.prescriptions.title")}</p>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-400">{tCommon("patientProfile.cards.prescriptions.quickAction")}</p>
                </div>
                {/* Reminders */}
                <div className="p-4 bg-amber-50/50 dark:bg-amber-900/15 rounded-lg border border-amber-200/50 dark:border-amber-800/50 hover:bg-amber-100/50 dark:hover:bg-amber-900/25 cursor-pointer transition-colors" onClick={() => router.push('/patient/reminders')}>
                  <div className="flex items-center gap-2 mb-2">
                    <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="font-medium text-sm text-amber-900 dark:text-amber-300">{tCommon("patientProfile.cards.reminders.title")}</p>
                  </div>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{tCommon("patientProfile.cards.reminders.quickAction")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push('/patient/find-doctor')}
          >
            <Users className="h-6 w-6 text-primary" />
            <span>{tCommon("patientProfile.quickActions.findDoctors")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push('/patient/appointments')}
          >
            <Calendar className="h-6 w-6 text-primary" />
            <span>{tCommon("patientProfile.quickActions.myAppointments")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push("/patient/medical-history")}
          >
            <FileText className="h-6 w-6 text-primary" />
            <span>{tCommon("patientProfile.quickActions.medicalHistory")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push("/patient/prescriptions")}
          >
            <Pill className="h-6 w-6 text-primary" />
            <span>{tCommon("patientProfile.quickActions.prescriptions")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-500 touch-target"
            onClick={() => router.push("/patient/reminders")}
          >
            <Bell className="h-6 w-6 text-amber-500" />
            <span>{tCommon("patientProfile.quickActions.reminders")}</span>
          </Button>
        </div>
      </main>
    </AppBackground>
  );
}

