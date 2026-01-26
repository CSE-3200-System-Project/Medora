"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MedicationManager, type Medication } from "@/components/medicine";
import {
  ArrowLeft,
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
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/auth-utils";
import { updatePatientOnboarding, getPatientOnboardingData } from "@/lib/auth-actions";
import { MedicalTestSearch } from "@/components/medical-test";

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
  const [medicalTests, setMedicalTests] = useState<MedicalTest[]>([]);
  const [surgeries, setSurgeries] = useState<{ name: string; year: string; hospital?: string }[]>([]);
  const [hospitalizations, setHospitalizations] = useState<{ reason: string; year: string; duration?: string }[]>([]);
  const [vaccinations, setVaccinations] = useState<{ name: string; date: string; next_due?: string }[]>([]);
  
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
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
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

          <Card className="bg-purple-500/5 border-purple-500/20">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <FlaskConical className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                </div>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {medicalTests.length}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground truncate">
                    Lab Tests
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

          {/* Lab Tests Tab */}
          <TabsContent value="tests" className="mt-0">
            <Card className="border-purple-200 shadow-sm">
              <CardHeader className="bg-gradient-to-r from-purple-50 to-white border-b border-purple-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-purple-600" />
                      Lab Tests & Diagnostics
                    </CardTitle>
                    <CardDescription className="text-gray-600">Track your medical tests and results</CardDescription>
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
              <CardContent className="p-4 sm:p-6 bg-white">
                {medicalTests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-purple-100 flex items-center justify-center">
                      <FlaskConical className="h-8 w-8 text-purple-500" />
                    </div>
                    <p className="text-gray-700 font-medium">No lab tests recorded yet</p>
                    <p className="text-sm mt-2 text-gray-500">Click &quot;Add Test&quot; to record your lab tests</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {medicalTests.map((test, index) => (
                      <div key={index} className="border border-purple-200 rounded-xl p-5 bg-gradient-to-br from-purple-50/50 to-white shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-purple-600 text-white text-sm font-medium flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800">
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
          <TabsContent value="surgeries" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Surgical History</CardTitle>
                <CardDescription>Track your past surgeries and procedures</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Syringe className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Surgery management coming soon</p>
                  <p className="text-sm mt-2">You can add surgeries during onboarding</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hospitalizations Tab */}
          <TabsContent value="hospitalizations" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Hospitalization History</CardTitle>
                <CardDescription>Record of hospital admissions</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Hospital className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Hospitalization management coming soon</p>
                  <p className="text-sm mt-2">You can add hospitalizations during onboarding</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vaccinations Tab */}
          <TabsContent value="vaccinations" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Vaccination Records</CardTitle>
                <CardDescription>Keep track of your immunizations</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Vaccination management coming soon</p>
                  <p className="text-sm mt-2">You can add vaccinations during onboarding</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>Medical Timeline</CardTitle>
                <CardDescription>Chronological view of your medical history</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Timeline view coming soon</p>
                  <p className="text-sm mt-2">View all medical events in chronological order</p>
                </div>
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
