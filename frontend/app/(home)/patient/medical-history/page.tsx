"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
} from "lucide-react";
import { fetchWithAuth } from "@/lib/auth-utils";
import { updatePatientOnboarding, getPatientOnboardingData } from "@/lib/auth-actions";
import { getMyAppointments } from "@/lib/appointment-actions";

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
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [hospitalizations, setHospitalizations] = useState<Hospitalization[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);

  // Dialog states
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
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
            if (med.drug_id) return { ...med, id: med.id || crypto.randomUUID() } as Medication;
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
          setVaccinations(data.vaccinations || []);
          
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
      });
      
      // Reload data to reflect changes
      const updatedData = await getPatientOnboardingData();
      if (updatedData) {
        const meds = updatedData.medications || [];
        const convertedMeds = meds.map((med: { drug_id?: string; name?: string; generic_name?: string; dosage?: string; frequency?: string; duration?: string; prescribing_doctor?: string }) => {
          if (med.drug_id) return { ...med, id: med.id || crypto.randomUUID() } as Medication;
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
      <div className="min-h-screen bg-surface">
        <Navbar />
        <main className="container mx-auto px-4 py-8 pt-24">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </main>
      </div>
    );
  }

  const totalMeds = medications.length;

  return (
    <div className="min-h-screen bg-surface">
      <Navbar />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pt-20 sm:pt-24 max-w-6xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Button
            variant="ghost"
            onClick={() => router.push("/patient/profile")}
            className="mb-4 -ml-2"
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
                className="w-full sm:w-auto"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="sm:inline">Export All</span>
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !initialLoaded}
                size="sm"
                className="w-full sm:w-auto"
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center">
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

          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-success/10 flex items-center justify-center">
                  <Syringe className="h-5 w-5 sm:h-6 sm:w-6 text-success" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {surgeries.length}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Surgeries
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <Hospital className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600" />
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

          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
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
          <TabsList className="w-full grid grid-cols-2 lg:grid-cols-6 h-auto gap-1 sm:gap-2 p-1 mb-6 bg-muted/30">
            <TabsTrigger value="medications" className="text-xs sm:text-sm py-2 sm:py-2.5 data-[state=active]:bg-background">
              <Pill className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Medications</span>
              <span className="sm:hidden">Meds</span>
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
          <TabsContent value="medications" className="mt-0">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <MedicationManager
                  medications={medications}
                  onUpdate={setMedications}
                  showStatus={true}
                  title="Medications"
                  description="Search from our medicine database and manage your medications"
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Surgeries Tab */}
          <TabsContent value="surgeries" className="mt-0">
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
              <Button onClick={() => setErrorDialogOpen(false)}>
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

export default function MedicalHistoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    }>
      <MedicalHistoryContent />
    </Suspense>
  );
}
