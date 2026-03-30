"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { fetchWithAuth } from "@/lib/auth-utils";
import { getMyAppointments } from "@/lib/appointment-actions";
import { Navbar } from "@/components/ui/navbar";
import { AdminNavbar } from "@/components/admin/admin-navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AppBackground } from "@/components/ui/app-background";
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
  Loader2,
  FileText,
  Users,
  Scale,
  Ruler,
  Bell,
  Hospital,
} from "lucide-react";
import { withLocale, type AppLocale } from "@/lib/locale-path";

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
  drug_allergies?: DrugAllergy[];
  // Medical history
  surgeries?: Surgery[];
  hospitalizations?: Hospitalization[];
  // Emergency contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relation?: string;
}

type PatientProfilePageProps = {
  adminPatientId?: string;
  adminEditHref?: string;
  useAdminNavbar?: boolean;
};

export default function PatientProfilePage({
  adminPatientId,
  adminEditHref,
  useAdminNavbar = false,
}: PatientProfilePageProps = {}) {
  const t = useTranslations("patientProfilePage");
  const locale = useLocale();
  const router = useRouter();
  const [patient, setPatient] = React.useState<PatientData | null>(null);
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const isAdminView = Boolean(adminPatientId);
  const editTargetHref = adminEditHref || withLocale('/onboarding/patient?mode=edit', locale as AppLocale);

  React.useEffect(() => {
    loadPatientProfile();
  }, []);

  const loadPatientProfile = async () => {
    try {
      if (isAdminView && adminPatientId) {
        const adminResponse = await fetch(`/api/admin/patients/${adminPatientId}`, { cache: "no-store" });
        if (adminResponse.ok) {
          const data = await adminResponse.json();
          setPatient(data);
        }
        return;
      }

      const response = await fetchWithAuth('/api/auth/me');
      if (response?.ok) {
        const data = await response.json();
        
        // Fetch detailed patient data
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
        const token = document.cookie.split('session_token=')[1]?.split(';')[0];
        const detailsResponse = await fetchWithAuth(`${backendUrl}/profile/patient/onboarding`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        // Fetch appointments
        try {
          const apps = await getMyAppointments();
          if (Array.isArray(apps)) setAppointments(apps);
        } catch (e) {
          console.error("Failed to load appointments", e);
        }

        if (detailsResponse?.ok) {
          const details = await detailsResponse.json();
          setPatient({ ...data, ...details });
        } else {
          setPatient(data);
        }
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
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
    if (patient.has_diabetes) conditions.push(t("conditions.diabetes"));
    if (patient.has_hypertension) conditions.push(t("conditions.hypertension"));
    if (patient.has_heart_disease) conditions.push(t("conditions.heartDisease"));
    if (patient.has_asthma) conditions.push(t("conditions.asthma"));
    if (patient.has_kidney_disease) conditions.push(t("conditions.kidneyDisease"));
    if (patient.has_liver_disease) conditions.push(t("conditions.liverDisease"));
    if (patient.has_thyroid) conditions.push(t("conditions.thyroid"));
    if (patient.has_mental_health) conditions.push(t("conditions.mentalHealth"));
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
        {useAdminNavbar ? <AdminNavbar /> : <Navbar />}
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="skeleton h-12 w-12 rounded-full mx-auto mb-4"></div>
            <p className="text-foreground font-semibold">{t("loading")}</p>
          </div>
        </div>
      </AppBackground>
    );
  }

  if (!patient) {
    return (
      <AppBackground className="container-padding">
        {useAdminNavbar ? <AdminNavbar /> : <Navbar />}
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-foreground mb-4">{t("errors.loadFailed")}</p>
            <Button onClick={() => router.push(withLocale('/login', locale as AppLocale))} className="touch-target">{t("actions.goToLogin")}</Button>
          </div>
        </div>
      </AppBackground>
    );
  }

  const chronicConditions = getChronicConditions();
  const age = patient.date_of_birth ? calculateAge(patient.date_of_birth) : null;

  return (
    <AppBackground className="container-padding animate-page-enter">
      {useAdminNavbar ? <AdminNavbar /> : <Navbar />}
      
      <main className="max-w-6xl mx-auto py-8 pt-(--nav-content-offset)">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
          </div>
          <Button variant="medical" size="lg" onClick={() => router.push(editTargetHref)} className="touch-target">
            <Edit className="h-4 w-4 mr-2" />
            {t("actions.editProfile")}
          </Button>
        </div>

        {/* Profile Header Card */}
        <Card className="mb-6 overflow-hidden border-none shadow-lg">
          <div className="bg-linear-to-r from-primary via-primary-muted to-primary h-32 sm:h-40" />
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
                      {t("ageYearsOld", { age })}
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
                {t("sections.contactInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("fields.email")}</p>
                  <p className="font-medium">{patient.email || t("fallback.notProvided")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("fields.phone")}</p>
                  <p className="font-medium">{patient.phone || t("fallback.notProvided")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 dark:bg-primary/20 rounded-lg">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("fields.address")}</p>
                  <p className="font-medium">
                    {[patient.address, patient.city, patient.district, patient.country].filter(Boolean).join(', ') || t("fallback.notProvided")}
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
                {t("sections.physicalInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Ruler className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("fields.height")}</p>
                  <p className="text-xl font-bold text-foreground">
                    {patient.height ? t("units.heightCm", { value: patient.height }) : t("fallback.empty")}
                  </p>
                </div>
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Scale className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("fields.weight")}</p>
                  <p className="text-xl font-bold text-foreground">
                    {patient.weight ? t("units.weightKg", { value: patient.weight }) : t("fallback.empty")}
                  </p>
                </div>
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Calendar className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("fields.dateOfBirth")}</p>
                  <p className="text-sm font-bold text-foreground">
                    {patient.date_of_birth
                      ? new Date(patient.date_of_birth).toLocaleDateString(locale === "bn" ? "bn-BD" : "en-US")
                      : t("fallback.empty")}
                  </p>
                </div>
                <div className="p-4 bg-surface dark:bg-muted/30 rounded-xl text-center">
                  <Users className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{t("fields.maritalStatus")}</p>
                  <p className="text-sm font-bold text-foreground capitalize">
                    {patient.marital_status || t("fallback.empty")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Medical Conditions */}
          <Card hoverable className="border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Heart className="h-5 w-5 text-primary" />
                {t("sections.medicalConditions")}
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
                <p className="text-muted-foreground text-sm">{t("empty.noChronicConditions")}</p>
              )}
              {/* Current Medications */}
              {patient.medications && patient.medications.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                    <Pill className="h-4 w-4 text-primary" />
                    {t("sections.currentMedications")}
                  </p>
                  <div className="space-y-1">
                    {patient.medications.slice(0, 3).map((med, i) => (
                      <p key={i} className="text-sm text-muted-foreground">• {med.name || med.display_name || t("fallback.unknownMedication")}</p>
                    ))}
                    {patient.medications.length > 3 && (
                      <p className="text-xs text-primary mt-2">{t("moreCount", { count: patient.medications.length - 3 })}</p>
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
                {t("sections.allergies")}
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
                <p className="text-muted-foreground text-sm">{t("empty.noAllergies")}</p>
              )}
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card hoverable className="border-border/50 shadow-md lg:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                {t("sections.emergencyContact")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient.emergency_contact_name ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 p-4 bg-surface dark:bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground">{t("fields.name")}</p>
                    <p className="font-medium">{patient.emergency_contact_name}</p>
                  </div>
                  <div className="flex-1 p-4 bg-surface dark:bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground">{t("fields.relation")}</p>
                    <p className="font-medium capitalize">{patient.emergency_contact_relation || t("fallback.notSpecified")}</p>
                  </div>
                  <div className="flex-1 p-4 bg-surface dark:bg-muted/30 rounded-xl">
                    <p className="text-sm text-muted-foreground">{t("fields.phone")}</p>
                    <p className="font-medium">{patient.emergency_contact_phone || t("fallback.notProvided")}</p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">{t("empty.noEmergencyContact")}</p>
              )}
            </CardContent>
          </Card>

          {/* Medical History Summary */}
          <Card hoverable className="border-border/50 shadow-md lg:col-span-2">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  {t("sections.medicalHistory")}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => router.push(withLocale('/patient/medical-history', locale as AppLocale))} className="touch-target">
                  {t("actions.viewAll")}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Surgeries */}
                <div className="p-4 bg-surface/50 dark:bg-muted/20 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Hospital className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{t("sections.surgeries")}</p>
                  </div>
                  {patient.surgeries && patient.surgeries.length > 0 ? (
                    <div className="space-y-1">
                      {patient.surgeries.slice(0, 2).map((s: Surgery, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {s.name} ({s.year})</p>
                      ))}
                      {patient.surgeries.length > 2 && (
                        <p className="text-xs text-primary">{t("moreCount", { count: patient.surgeries.length - 2 })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("empty.noSurgeries")}</p>
                  )}
                </div>
                {/* Hospitalizations */}
                <div className="p-4 bg-surface/50 dark:bg-muted/20 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Hospital className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{t("sections.hospitalizations")}</p>
                  </div>
                  {patient.hospitalizations && patient.hospitalizations.length > 0 ? (
                    <div className="space-y-1">
                      {patient.hospitalizations.slice(0, 2).map((h: Hospitalization, i) => (
                        <p key={i} className="text-xs text-muted-foreground">• {h.reason} ({h.year})</p>
                      ))}
                      {patient.hospitalizations.length > 2 && (
                        <p className="text-xs text-primary">{t("moreCount", { count: patient.hospitalizations.length - 2 })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("empty.noHospitalizations")}</p>
                  )}
                </div>
                {/* Recent Visits */}
                <div className="p-4 bg-surface/50 dark:bg-muted/20 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{t("sections.recentVisits")}</p>
                  </div>
                  {appointments.length > 0 ? (
                    <div className="space-y-1">
                      {appointments.slice(0, 2).map((app: any, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          • {new Date(app.appointment_date).toLocaleDateString()}
                        </p>
                      ))}
                      {appointments.length > 2 && (
                        <p className="text-xs text-primary">{t("moreCount", { count: appointments.length - 2 })}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("empty.noVisits")}</p>
                  )}
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
            onClick={() => router.push(withLocale('/patient/find-doctor', locale as AppLocale))}
          >
            <Users className="h-6 w-6 text-primary" />
            <span>{t("quickActions.findDoctors")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push(withLocale('/patient/appointments', locale as AppLocale))}
          >
            <Calendar className="h-6 w-6 text-primary" />
            <span>{t("quickActions.myAppointments")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push(withLocale('/patient/medical-history', locale as AppLocale))}
          >
            <FileText className="h-6 w-6 text-primary" />
            <span>{t("quickActions.medicalHistory")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary-more-light dark:hover:bg-primary/20 hover:border-primary touch-target"
            onClick={() => router.push(withLocale('/patient/prescriptions', locale as AppLocale))}
          >
            <Pill className="h-6 w-6 text-primary" />
            <span>{t("quickActions.prescriptions")}</span>
          </Button>
          <Button 
            variant="outline" 
            className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-500 touch-target"
            onClick={() => router.push(withLocale('/patient/reminders', locale as AppLocale))}
          >
            <Bell className="h-6 w-6 text-amber-500" />
            <span>{t("quickActions.reminders")}</span>
          </Button>
        </div>
      </main>
    </AppBackground>
  );
}

