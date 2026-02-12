"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppBackground } from "@/components/ui/app-background";
import { MedicationManager, type Medication } from "@/components/medicine"
import { SurgeryManager, type Surgery } from "@/components/medical-history/surgery-manager"
import { HospitalizationManager, type Hospitalization } from "@/components/medical-history/hospitalization-manager"
import { VaccinationManager, type Vaccination } from "@/components/medical-history/vaccination-manager"
import { MedicalTimeline } from "@/components/medical-history/medical-timeline";
import {
  ArrowLeft,
  Calendar,
  Download,
  Loader2,
  Pill,
  Syringe,
  Hospital,
  Shield,
  Clock,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
  Plus,
  Trash2,
  CalendarIcon,
  Bell,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/auth-utils";
import { updatePatientOnboarding, getPatientOnboardingData } from "@/lib/auth-actions";

import { getMyAppointments } from "@/lib/appointment-actions";

import { MedicalTestSearch } from "@/components/medical-test";
import { getMedicalHistoryPrescriptions, type Prescription, type MedicationPrescription, type TestPrescription, type SurgeryRecommendation } from "@/lib/prescription-actions";
import { PrescriptionReminderDialog } from "@/components/ui/reminder-dialog";

// Interface for medical test records
interface MedicalTest {
  test_name: string;
  test_id?: number;
  test_date: string;
  result: string;
  status: string;
  prescribing_doctor: string;
  hospital_lab: string;
  notes: string;
}

/**
 * Comprehensive Medical History Page
 * Manages medications, tests, surgeries, hospitalizations, vaccinations
 */

function MedicalHistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "medications");
  
  // Data states
  const [medications, setMedications] = useState<Medication[]>([]);


  const [appointments, setAppointments] = useState<any[]>([]);


  const [medicalTests, setMedicalTests] = useState<MedicalTest[]>([]);
  const [surgeries, setSurgeries] = useState<{ name: string; year: string; hospital?: string }[]>([]);
  const [hospitalizations, setHospitalizations] = useState<{ reason: string; year: string; duration?: string }[]>([]);
  const [vaccinations, setVaccinations] = useState<{ name: string; date: string; next_due?: string }[]>([]);
  
  // Doctor prescriptions state (accepted prescriptions from consultations)
  const [doctorPrescriptions, setDoctorPrescriptions] = useState<Prescription[]>([]);

  // Dialog states
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  // Prescription reminder dialog state
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedMedicationForReminder, setSelectedMedicationForReminder] = useState<{
    medicineName: string;
    prescriptionId: string;
    doseTimes: { morning?: boolean; afternoon?: boolean; evening?: boolean; night?: boolean };
  } | null>(null);
  
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Load all medical history data
  useEffect(() => {
    async function loadMedicalHistory() {
      try {
        setLoading(true);
        const data = await getPatientOnboardingData();
        
        if (data) {
          // Load medications
          const meds = data.medications || [];
          const convertedMeds = meds.map((med: { drug_id?: string; name?: string; generic_name?: string; dosage?: string; frequency?: string; duration?: string; prescribing_doctor?: string }) => {
            if (med.drug_id) return { ...med, id: crypto.randomUUID() } as Medication;
            return {
              id: crypto.randomUUID(),
              drug_id: "",
              display_name: med.name || "",
              generic_name: med.generic_name || med.name || "",
              strength: "",
              dosage_form: "",
              dosage: med.dosage || "",
              frequency: med.frequency || "",
              duration: med.duration || "",
              status: "current" as const,
              prescribing_doctor: med.prescribing_doctor || "",
              notes: "",
            };
          });
          setMedications(convertedMeds);
          
          // Load other medical history
          setSurgeries(data.surgeries || []);
          setHospitalizations(data.hospitalizations || []);

          // Load appointments
          try {
            const apps = await getMyAppointments();
            if (Array.isArray(apps)) setAppointments(apps);
          } catch (e) {
            console.error("Failed to load appointments", e);
          }
          
          // Load doctor prescriptions (accepted prescriptions from consultations)
          try {
            const prescriptionData = await getMedicalHistoryPrescriptions();
            setDoctorPrescriptions(prescriptionData.prescriptions || []);
          } catch (e) {
            console.error("Failed to load doctor prescriptions", e);
          }
          
          setVaccinations(data.vaccinations || []);
          setMedicalTests(data.medical_tests || []);
          
          setInitialLoaded(true);
        } else {
          console.error("Failed to load medical history data");
          setInitialLoaded(true); // Allow saving even if loading failed
        }
      } catch (error) {
        console.error("Error loading medical history:", error);
        setInitialLoaded(true); // Allow saving even if loading failed
      } finally {
        setLoading(false);
      }
    }

    loadMedicalHistory();
  }, []);

  // Save medical history
  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Convert medications to backend format
      const backendMedications = medications.map(med => {
        const m: any = {
          name: med.display_name,
          dosage: med.dosage,
          frequency: med.frequency,
          duration: med.duration,
          generic_name: med.generic_name || null,
        }
        if (med.prescribing_doctor && med.prescribing_doctor.trim()) {
          m.prescribing_doctor = med.prescribing_doctor
        }
        return m
      })
      
      await updatePatientOnboarding({
        taking_meds: medications.length > 0 ? "yes" : "no",
        medications: backendMedications,
        surgeries,
        hospitalizations,
        vaccinations,
        has_medical_tests: medicalTests.length > 0 ? "yes" : "no",
        medical_tests: medicalTests,
      });
      
      // Reload data to reflect changes
      const updatedData = await getPatientOnboardingData();
      if (updatedData) {
        const meds = updatedData.medications || [];
        const convertedMeds = meds.map((med: { drug_id?: string; name?: string; generic_name?: string; dosage?: string; frequency?: string; duration?: string; prescribing_doctor?: string }) => {
          if (med.drug_id) return { ...med, id: crypto.randomUUID() } as Medication;
          return {
            id: crypto.randomUUID(),
            drug_id: "",
            display_name: med.name || "",
            generic_name: med.generic_name || med.name || "",
            strength: "",
            dosage_form: "",
            dosage: med.dosage || "",
            frequency: med.frequency || "",
            duration: med.duration || "",
            status: "current" as const,
            prescribing_doctor: med.prescribing_doctor || "",
            notes: "",
          };
        });
        setMedications(convertedMeds);
        setSurgeries(updatedData.surgeries || []);
        setHospitalizations(updatedData.hospitalizations || []);
        setVaccinations(updatedData.vaccinations || []);
        setMedicalTests(updatedData.medical_tests || []);
      }
      
      setSuccessDialogOpen(true);
    } catch (error) {
      console.error("Error saving:", error);
      setErrorMessage("Failed to save. Please try again.");
      setErrorDialogOpen(true);
    } finally {
      setSaving(false);
    }
  };

  // Export all medical history
  const handleExportAll = () => {
    let text = "MY MEDICAL HISTORY\n";
    text += "==================\n\n";
    text += `Exported on: ${new Date().toLocaleDateString()}\n\n`;
    
    // Medications
    if (medications.length > 0) {
      text += "\n📋 MEDICATIONS\n";
      text += "-------------\n\n";
      const current = medications.filter(m => m.status === "current");
      const past = medications.filter(m => m.status === "past");
      
      if (current.length > 0) {
        text += "Current:\n";
        current.forEach((med, idx) => {
          text += `${idx + 1}. ${med.display_name} - ${med.dosage} ${med.frequency}\n`;
        });
        text += "\n";
      }
      
      if (past.length > 0) {
        text += "Past:\n";
        past.forEach((med, idx) => {
          text += `${idx + 1}. ${med.display_name}\n`;
        });
        text += "\n";
      }
    }
    
    // Surgeries
    if (surgeries.length > 0) {
      text += "\n🔪 SURGERIES\n";
      text += "-----------\n\n";
      surgeries.forEach((surgery, idx) => {
        text += `${idx + 1}. ${surgery.name} (${surgery.year})\n`;
        if (surgery.hospital) text += `   Hospital: ${surgery.hospital}\n`;
        text += "\n";
      });
    }
    
    // Hospitalizations
    if (hospitalizations.length > 0) {
      text += "\n🏥 HOSPITALIZATIONS\n";
      text += "------------------\n\n";
      hospitalizations.forEach((hosp, idx) => {
        text += `${idx + 1}. ${hosp.reason} (${hosp.year})\n`;
        if (hosp.duration) text += `   Duration: ${hosp.duration}\n`;
        text += "\n";
      });
    }
    
    // Vaccinations
    if (vaccinations.length > 0) {
      text += "\n💉 VACCINATIONS\n";
      text += "--------------\n\n";
      vaccinations.forEach((vac, idx) => {
        text += `${idx + 1}. ${vac.name} - ${vac.date}\n`;
      });
    }

    // Medical Tests
    if (medicalTests.length > 0) {
      text += "\n🧪 MEDICAL TESTS\n";
      text += "----------------\n\n";
      medicalTests.forEach((test, idx) => {
        text += `${idx + 1}. ${test.test_name}`;
        if (test.test_date) text += ` (${test.test_date})`;
        text += "\n";
        if (test.result) text += `   Result: ${test.result}\n`;
        if (test.hospital_lab) text += `   Lab: ${test.hospital_lab}\n`;
        if (test.prescribing_doctor) text += `   Doctor: ${test.prescribing_doctor}\n`;
        text += "\n";
      });
    }

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `medical-history-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto py-8 pt-24">
          <div className="flex items-center justify-center py-12">
            <div className="skeleton w-8 h-8 rounded-full"></div>
          </div>
        </main>
      </AppBackground>
    );
  }

  const totalMeds = medications.length + doctorPrescriptions.filter(p => p.type === "medication").reduce((acc, p) => acc + p.medications.length, 0);
  const totalTests = medicalTests.length + doctorPrescriptions.filter(p => p.type === "test").reduce((acc, p) => acc + p.tests.length, 0);
  const totalSurgeries = surgeries.length + doctorPrescriptions.filter(p => p.type === "surgery").reduce((acc, p) => acc + p.surgeries.length, 0);

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />
      <main className="container mx-auto py-6 sm:py-8 pt-20 sm:pt-24 max-w-6xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/patient/profile")}
            className="mb-4 -ml-2 touch-target"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
          
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Medical History
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                Manage your complete medical records
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleExportAll}
                size="sm"
                className="w-full sm:w-auto touch-target"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="sm:inline">Export All</span>
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !initialLoaded}
                size="sm"
                className="w-full sm:w-auto touch-target"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card hoverable className="bg-primary/5 dark:bg-primary/10 border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center">
                  <Pill className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {totalMeds}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Medications
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                  <FlaskConical className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {totalTests}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Lab Tests
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="bg-success/5 dark:bg-success/10 border-success/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-success/10 dark:bg-success/20 flex items-center justify-center">
                  <Syringe className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {totalSurgeries}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Surgeries
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                  <Hospital className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {hospitalizations.length}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Hospitalizations
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hoverable className="bg-blue-500/5 dark:bg-blue-500/10 border-blue-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {vaccinations.length}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Vaccinations
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 lg:grid-cols-6 h-auto gap-1 sm:gap-2 p-1 mb-6 bg-muted/30">
            <TabsTrigger value="medications" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <Pill className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Medications</span>
              <span className="sm:hidden">Meds</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <FlaskConical className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Lab Tests</span>
              <span className="sm:hidden">Tests</span>
            </TabsTrigger>
            <TabsTrigger value="surgeries" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <Syringe className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Surgeries</span>
              <span className="sm:hidden">Surgery</span>
            </TabsTrigger>
            <TabsTrigger value="hospitalizations" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <Hospital className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Hospitalizations</span>
              <span className="sm:hidden">Hospital</span>
            </TabsTrigger>
            <TabsTrigger value="vaccinations" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Vaccinations</span>
              <span className="sm:hidden">Vaccines</span>
            </TabsTrigger>
            <TabsTrigger value="visits" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Visits</span>
              <span className="sm:hidden">Visits</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              Timeline
            </TabsTrigger>
          </TabsList>

          {/* Medications Tab */}
          <TabsContent value="medications" className="mt-0 space-y-6">
            {/* Doctor Prescribed Medications */}
            {doctorPrescriptions.filter(p => p.type === "medication" && p.medications.length > 0).length > 0 && (
              <Card className="border-primary/30 dark:border-primary/50">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent dark:from-primary/10">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Pill className="h-5 w-5 text-primary" />
                    Doctor Prescribed Medications
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Medications prescribed by your doctors during consultations
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {doctorPrescriptions
                      .filter(p => p.type === "medication" && p.medications.length > 0)
                      .map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>•</span>
                            <span>{new Date(prescription.created_at).toLocaleDateString()}</span>
                          </div>
                          {prescription.medications.map((med: MedicationPrescription) => (
                            <div key={med.id} className="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-foreground">{med.medicine_name}</h4>
                                  {med.generic_name && (
                                    <p className="text-sm text-muted-foreground">{med.generic_name}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30">
                                  {med.medicine_type}
                                </Badge>
                              </div>
                              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                                {med.strength && (
                                  <div>
                                    <span className="text-muted-foreground">Strength:</span>
                                    <span className="ml-1 font-medium text-foreground">{med.strength}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Doses:</span>
                                  <span className="ml-1 font-medium text-foreground">
                                    {[med.dose_morning && "Morning", med.dose_afternoon && "Afternoon", med.dose_evening && "Evening", med.dose_night && "Night"].filter(Boolean).join(", ") || "As directed"}
                                  </span>
                                </div>
                                {med.duration_value && (
                                  <div>
                                    <span className="text-muted-foreground">Duration:</span>
                                    <span className="ml-1 font-medium text-foreground">{med.duration_value} {med.duration_unit}</span>
                                  </div>
                                )}
                                <div>
                                  <span className="text-muted-foreground">Meal:</span>
                                  <span className="ml-1 font-medium text-foreground">{med.meal_instruction?.replace(/_/g, " ") || "Any time"}</span>
                                </div>
                              </div>
                              {med.special_instructions && (
                                <p className="mt-2 text-sm text-muted-foreground italic">Note: {med.special_instructions}</p>
                              )}
                              {/* Set Reminder Button */}
                              <div className="mt-3 pt-3 border-t border-primary/10">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
                                  onClick={() => {
                                    setSelectedMedicationForReminder({
                                      medicineName: med.medicine_name,
                                      prescriptionId: prescription.id,
                                      doseTimes: {
                                        morning: med.dose_morning,
                                        afternoon: med.dose_afternoon,
                                        evening: med.dose_evening,
                                        night: med.dose_night,
                                      }
                                    });
                                    setReminderDialogOpen(true);
                                  }}
                                >
                                  <Bell className="h-4 w-4" />
                                  Set Reminder
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Self-Reported Medications */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <MedicationManager
                  medications={medications}
                  onUpdate={setMedications}
                  showStatus={true}
                  title="My Medications"
                  description="Search from our medicine database and manage your medications"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lab Tests Tab */}
          <TabsContent value="tests" className="mt-0 space-y-6">
            {/* Doctor Prescribed Tests */}
            {doctorPrescriptions.filter(p => p.type === "test" && p.tests.length > 0).length > 0 && (
              <Card className="border-purple-300 dark:border-purple-700">
                <CardHeader className="bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950/30">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Doctor Prescribed Tests
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Tests ordered by your doctors during consultations
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {doctorPrescriptions
                      .filter(p => p.type === "test" && p.tests.length > 0)
                      .map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>•</span>
                            <span>{new Date(prescription.created_at).toLocaleDateString()}</span>
                          </div>
                          {prescription.tests.map((test: TestPrescription) => (
                            <div key={test.id} className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-foreground">{test.test_name}</h4>
                                  {test.test_type && (
                                    <p className="text-sm text-muted-foreground">{test.test_type}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className={`w-fit ${test.urgency === "urgent" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400" : "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400"}`}>
                                  {test.urgency}
                                </Badge>
                              </div>
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {test.preferred_lab && (
                                  <div>
                                    <span className="text-muted-foreground">Preferred Lab:</span>
                                    <span className="ml-1 font-medium text-foreground">{test.preferred_lab}</span>
                                  </div>
                                )}
                                {test.expected_date && (
                                  <div>
                                    <span className="text-muted-foreground">Expected Date:</span>
                                    <span className="ml-1 font-medium text-foreground">{new Date(test.expected_date).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                              {test.instructions && (
                                <p className="mt-2 text-sm text-muted-foreground italic">Instructions: {test.instructions}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card className="border-purple-200 dark:border-purple-800 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-white dark:from-purple-950/30 dark:to-card border-b border-purple-100 dark:border-purple-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      Lab Tests & Diagnostics
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-muted-foreground">Track your medical tests and results</CardDescription>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      setMedicalTests([
                        ...medicalTests,
                        {
                          test_name: "",
                          test_id: undefined,
                          test_date: "",
                          result: "",
                          status: "completed",
                          prescribing_doctor: "",
                          hospital_lab: "",
                          notes: "",
                        },
                      ]);
                    }}
                    className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Test
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 bg-white dark:bg-card">
                {medicalTests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <FlaskConical className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-gray-700 dark:text-foreground font-medium">No lab tests recorded yet</p>
                    <p className="text-sm mt-2 text-gray-500 dark:text-muted-foreground">Click &quot;Add Test&quot; to record your lab tests</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {medicalTests.map((test, index) => (
                      <div key={index} className="border border-purple-200 dark:border-purple-800 rounded-xl p-5 bg-gradient-to-br from-purple-50/50 to-white dark:from-purple-950/20 dark:to-card shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-purple-600 text-white text-sm font-medium flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800 dark:text-foreground">
                              Test Record
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setMedicalTests(medicalTests.filter((_, i) => i !== index));
                            }}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Test Name with Search */}
                          <div className="md:col-span-2">
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Test Name <span className="text-red-500">*</span>
                            </Label>
                            <MedicalTestSearch
                              value={test.test_name}
                              onChange={(testName, testId) => {
                                const updated = [...medicalTests];
                                updated[index] = {
                                  ...updated[index],
                                  test_name: testName,
                                  test_id: testId,
                                };
                                setMedicalTests(updated);
                              }}
                              placeholder="Search for a test..."
                            />
                          </div>

                          {/* Test Date */}
                          <div>
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Test Date
                            </Label>
                            <div className="relative">
                              <CalendarIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-purple-500" />
                              <Input
                                type="date"
                                value={test.test_date}
                                onChange={(e) => {
                                  const updated = [...medicalTests];
                                  updated[index] = { ...updated[index], test_date: e.target.value };
                                  setMedicalTests(updated);
                                }}
                                className="pl-10 border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-gray-900"
                              />
                            </div>
                          </div>

                          {/* Result */}
                          <div>
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Result
                            </Label>
                            <Input
                              type="text"
                              value={test.result}
                              onChange={(e) => {
                                const updated = [...medicalTests];
                                updated[index] = { ...updated[index], result: e.target.value };
                                setMedicalTests(updated);
                              }}
                              placeholder="e.g., Normal, 120 mg/dL"
                              className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-gray-900 placeholder:text-gray-400"
                            />
                          </div>

                          {/* Status */}
                          <div>
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Status
                            </Label>
                            <select
                              value={test.status}
                              onChange={(e) => {
                                const updated = [...medicalTests];
                                updated[index] = { ...updated[index], status: e.target.value };
                                setMedicalTests(updated);
                              }}
                              className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm text-gray-900 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="scheduled">Scheduled</option>
                            </select>
                          </div>

                          {/* Prescribing Doctor */}
                          <div>
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Prescribed By
                            </Label>
                            <Input
                              type="text"
                              value={test.prescribing_doctor}
                              onChange={(e) => {
                                const updated = [...medicalTests];
                                updated[index] = { ...updated[index], prescribing_doctor: e.target.value };
                                setMedicalTests(updated);
                              }}
                              placeholder="Doctor's name"
                              className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-gray-900 placeholder:text-gray-400"
                            />
                          </div>

                          {/* Hospital/Lab */}
                          <div>
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Hospital/Lab
                            </Label>
                            <Input
                              type="text"
                              value={test.hospital_lab}
                              onChange={(e) => {
                                const updated = [...medicalTests];
                                updated[index] = { ...updated[index], hospital_lab: e.target.value };
                                setMedicalTests(updated);
                              }}
                              placeholder="Where test was conducted"
                              className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-gray-900 placeholder:text-gray-400"
                            />
                          </div>

                          {/* Notes */}
                          <div className="md:col-span-2">
                            <Label className="text-sm font-semibold text-gray-800 mb-2 block">
                              Notes
                            </Label>
                            <Input
                              type="text"
                              value={test.notes}
                              onChange={(e) => {
                                const updated = [...medicalTests];
                                updated[index] = { ...updated[index], notes: e.target.value };
                                setMedicalTests(updated);
                              }}
                              placeholder="Any additional notes..."
                              className="border-gray-300 focus:border-purple-500 focus:ring-purple-500 text-gray-900 placeholder:text-gray-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Surgeries Tab */}
          <TabsContent value="surgeries" className="mt-0 space-y-6">
            {/* Doctor Recommended Surgeries */}
            {doctorPrescriptions.filter(p => p.type === "surgery" && p.surgeries.length > 0).length > 0 && (
              <Card className="border-success/30 dark:border-success/50">
                <CardHeader className="bg-gradient-to-r from-success/5 to-transparent dark:from-success/10">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Syringe className="h-5 w-5 text-success" />
                    Doctor Recommended Surgeries
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Surgical procedures recommended by your doctors
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-4">
                    {doctorPrescriptions
                      .filter(p => p.type === "surgery" && p.surgeries.length > 0)
                      .map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>•</span>
                            <span>{new Date(prescription.created_at).toLocaleDateString()}</span>
                          </div>
                          {prescription.surgeries.map((surgery: SurgeryRecommendation) => (
                            <div key={surgery.id} className="p-4 rounded-lg bg-success/5 dark:bg-success/10 border border-success/20">
                              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-foreground">{surgery.procedure_name}</h4>
                                  {surgery.procedure_type && (
                                    <p className="text-sm text-muted-foreground">{surgery.procedure_type}</p>
                                  )}
                                </div>
                                <Badge variant="outline" className={`w-fit ${surgery.urgency === "immediate" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400" : "bg-success/20 text-success border-success/30"}`}>
                                  {surgery.urgency}
                                </Badge>
                              </div>
                              {surgery.reason && (
                                <p className="mt-2 text-sm text-muted-foreground">Reason: {surgery.reason}</p>
                              )}
                              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                {surgery.preferred_facility && (
                                  <div>
                                    <span className="text-muted-foreground">Facility:</span>
                                    <span className="ml-1 font-medium text-foreground">{surgery.preferred_facility}</span>
                                  </div>
                                )}
                                {surgery.recommended_date && (
                                  <div>
                                    <span className="text-muted-foreground">Recommended Date:</span>
                                    <span className="ml-1 font-medium text-foreground">{new Date(surgery.recommended_date).toLocaleDateString()}</span>
                                  </div>
                                )}
                                {surgery.estimated_cost_min && surgery.estimated_cost_max && (
                                  <div>
                                    <span className="text-muted-foreground">Est. Cost:</span>
                                    <span className="ml-1 font-medium text-foreground">৳{surgery.estimated_cost_min.toLocaleString()} - ৳{surgery.estimated_cost_max.toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                              {surgery.pre_op_instructions && (
                                <p className="mt-2 text-sm text-muted-foreground italic">Pre-op: {surgery.pre_op_instructions}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardContent className="p-4 sm:p-6">
                <SurgeryManager
                  surgeries={surgeries}
                  onUpdate={setSurgeries}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hospitalizations Tab */}
          <TabsContent value="hospitalizations" className="mt-0">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <HospitalizationManager
                  hospitalizations={hospitalizations}
                  onUpdate={setHospitalizations}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vaccinations Tab */}
          <TabsContent value="vaccinations" className="mt-0">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <VaccinationManager
                  vaccinations={vaccinations}
                  onUpdate={setVaccinations}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visits Tab */}
          <TabsContent value="visits" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Past Doctor Visits</CardTitle>
                <CardDescription>History of your consultations with Medora doctors</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((app, i) => (
                      <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-lg gap-4 bg-surface/30">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                             <Calendar className="h-4 w-4 text-primary" />
                             <span className="font-semibold text-primary">{new Date(app.appointment_date).toLocaleDateString()}</span>
                             <span className="text-muted-foreground text-sm">{new Date(app.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="text-lg font-medium">{app.reason}</div>
                          {app.notes && <div className="text-sm text-muted-foreground mt-1 max-w-xl">{app.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                           <Badge variant={app.status === 'COMPLETED' ? 'default' : app.status === 'CONFIRMED' ? 'outline' : 'secondary'}>
                             {app.status}
                           </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No past appointments found.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <MedicalTimeline
                  surgeries={surgeries}
                  hospitalizations={hospitalizations}
                  vaccinations={vaccinations}
                  medications={medications}
                  appointments={appointments}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Success Dialog */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <DialogTitle>Success!</DialogTitle>
              </div>
              <DialogDescription>
                Your medical history has been saved successfully.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setSuccessDialogOpen(false)}>
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Error Dialog */}
        <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <DialogTitle>Error</DialogTitle>
              </div>
              <DialogDescription>
                {errorMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setErrorDialogOpen(false)} className="touch-target">
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Prescription Reminder Dialog */}
        {selectedMedicationForReminder && (
          <PrescriptionReminderDialog
            open={reminderDialogOpen}
            onOpenChange={(open) => {
              setReminderDialogOpen(open);
              if (!open) setSelectedMedicationForReminder(null);
            }}
            medicineName={selectedMedicationForReminder.medicineName}
            prescriptionId={selectedMedicationForReminder.prescriptionId}
            doseTimes={selectedMedicationForReminder.doseTimes}
            onSuccess={() => {
              // Optionally refresh data or show success message
            }}
          />
        )}
      </main>
    </AppBackground>
  );
}

export default function MedicalHistoryPage() {
  return (
    <Suspense fallback={
      <AppBackground className="container-padding">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="skeleton w-8 h-8 rounded-full"></div>
        </div>
      </AppBackground>
    }>
      <MedicalHistoryContent />
    </Suspense>
  );
}
