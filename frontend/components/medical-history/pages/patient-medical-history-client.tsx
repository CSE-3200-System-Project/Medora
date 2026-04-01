"use client";

import React, { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppBackground } from "@/components/ui/app-background";
import type { Medication } from "@/components/medicine";
import type { Surgery } from "@/components/medical-history/surgery-manager";
import type { Hospitalization } from "@/components/medical-history/hospitalization-manager";
import type { Vaccination } from "@/components/medical-history/vaccination-manager";
import {
  Calendar,
  Download,
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
  FileText,
  Upload,
  AlertTriangle,
  ArrowRight,
  Loader2,
  MessageSquare,
  X,
  ImageIcon,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/auth-utils";
import { updatePatientOnboarding, getPatientOnboardingData } from "@/lib/auth-actions";

import { getMyAppointments } from "@/lib/appointment-actions";
import { humanizeConsultationType, humanizeAppointmentType, parseCompositeReason } from "@/lib/utils";
import { MEDICAL_MODULE_TAB_ACCENTS } from "@/components/medical-history/module-tab-accents";

import { getMedicalHistoryPrescriptions, type Prescription, type MedicationPrescription, type TestPrescription, type SurgeryRecommendation } from "@/lib/prescription-actions";
import { PrescriptionReminderDialog } from "@/components/ui/reminder-dialog";

import {
  listMedicalReports,
  getMedicalReport,
  type MedicalReportListItem,
  type MedicalReport,
} from "@/lib/medical-report-actions";
import { uploadMedicalReport } from "@/lib/medical-report-upload";

const MedicationManager = dynamic(
  () => import("@/components/medicine").then((module) => module.MedicationManager),
  { loading: () => <div className="skeleton h-32 w-full rounded-lg" /> },
);

const SurgeryManager = dynamic(
  () => import("@/components/medical-history/surgery-manager").then((module) => module.SurgeryManager),
  { loading: () => <div className="skeleton h-32 w-full rounded-lg" /> },
);

const HospitalizationManager = dynamic(
  () =>
    import("@/components/medical-history/hospitalization-manager").then(
      (module) => module.HospitalizationManager,
    ),
  { loading: () => <div className="skeleton h-32 w-full rounded-lg" /> },
);

const VaccinationManager = dynamic(
  () =>
    import("@/components/medical-history/vaccination-manager").then(
      (module) => module.VaccinationManager,
    ),
  { loading: () => <div className="skeleton h-32 w-full rounded-lg" /> },
);

const MedicalTestSearch = dynamic(
  () => import("@/components/medical-test").then((module) => module.MedicalTestSearch),
  { ssr: false, loading: () => <div className="skeleton h-10 w-full rounded-md" /> },
);

const EnhancedMedicalHistoryTimeline = dynamic(
  () => import("@/components/medical-history/enhanced-medical-history-timeline").then((module) => module.EnhancedMedicalHistoryTimeline),
  { loading: () => <div className="skeleton h-32 w-full rounded-lg" /> },
);

const ConditionDistributionChart = dynamic(
  () => import("@/components/medical-history/condition-distribution-chart").then((module) => module.ConditionDistributionChart),
  { loading: () => <div className="skeleton h-64 w-full rounded-lg" /> },
);

const PrescriptionHistoryChart = dynamic(
  () => import("@/components/medical-history/prescription-history-chart").then((module) => module.PrescriptionHistoryChart),
  { loading: () => <div className="skeleton h-64 w-full rounded-lg" /> },
);

const VitalsSummaryCard = dynamic(
  () => import("@/components/medical-history/vitals-summary-card").then((module) => module.VitalsSummaryCard),
  { loading: () => <div className="skeleton h-64 w-full rounded-lg" /> },
);

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

function calculateAge(dob?: string) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatPatientId(rawId?: string) {
  if (!rawId) return "N/A";
  const cleaned = rawId.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
  return cleaned ? `MED-${cleaned}` : "N/A";
}

function PatientMedicalHistoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "timeline");
  
  // Data states
  const [medications, setMedications] = useState<Medication[]>([]);
  const [patientData, setPatientData] = useState<any>(null);

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

  // Medical reports state
  const [reports, setReports] = useState<MedicalReportListItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [reportDetailLoading, setReportDetailLoading] = useState(false);
  const [reportDetailError, setReportDetailError] = useState<string | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Load all medical history data
  useEffect(() => {
    async function loadMedicalHistory() {
      try {
        setLoading(true);
        const data = await getPatientOnboardingData();
        
        if (data) {
          // Store full patient data for analytics
          setPatientData(data);
          
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
      text += "\nMEDICATIONS\n";
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
      text += "\nSURGERIES\n";
      text += "-----------\n\n";
      surgeries.forEach((surgery, idx) => {
        text += `${idx + 1}. ${surgery.name} (${surgery.year})\n`;
        if (surgery.hospital) text += `   Hospital: ${surgery.hospital}\n`;
        text += "\n";
      });
    }
    
    // Hospitalizations
    if (hospitalizations.length > 0) {
      text += "\nHOSPITALIZATIONS\n";
      text += "------------------\n\n";
      hospitalizations.forEach((hosp, idx) => {
        text += `${idx + 1}. ${hosp.reason} (${hosp.year})\n`;
        if (hosp.duration) text += `   Duration: ${hosp.duration}\n`;
        text += "\n";
      });
    }
    
    // Vaccinations
    if (vaccinations.length > 0) {
      text += "\nVACCINATIONS\n";
      text += "--------------\n\n";
      vaccinations.forEach((vac, idx) => {
        text += `${idx + 1}. ${vac.name} - ${vac.date}\n`;
      });
    }

    // Medical Tests
    if (medicalTests.length > 0) {
      text += "\nMEDICAL TESTS\n";
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

  // Load reports when the reports tab is activated
  const loadReports = React.useCallback(async () => {
    try {
      setReportsLoading(true);
      setReportsError(null);
      const data = await listMedicalReports(undefined, 50, 0);
      setReports(data);
    } catch (err: any) {
      console.error("Failed to load reports:", err);
      setReportsError(err.message || "Failed to load reports");
    } finally {
      setReportsLoading(false);
      setReportsLoaded(true);
    }
  }, []);

  const loadReportDetail = React.useCallback(async (id: string) => {
    try {
      setReportDetailLoading(true);
      setReportDetailError(null);
      const data = await getMedicalReport(id);
      setSelectedReport(data);
    } catch (err: any) {
      console.error("Failed to load report:", err);
      setReportDetailError(err.message || "Failed to load report");
    } finally {
      setReportDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "reports" && !reportsLoaded && !reportsLoading) {
      loadReports();
    }
  }, [activeTab, reportsLoaded, reportsLoading, loadReports]);

  useEffect(() => {
    if (selectedReportId) {
      loadReportDetail(selectedReportId);
    } else {
      setSelectedReport(null);
    }
  }, [selectedReportId, loadReportDetail]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadError(null);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please upload an image (JPG, PNG, WebP) or PDF.");
      return;
    }
    setSelectedFile(file);
    setUploadError(null);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleReportUpload = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      setUploadError(null);
      const result = await uploadMedicalReport(selectedFile, {
        reportDate: reportDate || undefined,
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      setReportDate("");
      setShowUpload(false);
      // Navigate to the new report detail within the tab
      setSelectedReportId(result.report.id);
      // Refresh reports list
      loadReports();
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "normal":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
            <CheckCircle2 className="h-3 w-3 mr-1" />Normal
          </Badge>
        );
      case "high":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
            <ArrowUp className="h-3 w-3 mr-1" />High
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <ArrowDown className="h-3 w-3 mr-1" />Low
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">--</Badge>
        );
    }
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto py-8 pt-[var(--nav-content-offset)]">
          <div className="flex items-center justify-center py-12">
            <div className="skeleton w-8 h-8 rounded-full"></div>
          </div>
        </main>
      </AppBackground>
    );
  }

  const totalMeds = medications.length + doctorPrescriptions.reduce((acc, p) => acc + (p.medications?.length || 0), 0);
  const totalTests = medicalTests.length + doctorPrescriptions.reduce((acc, p) => acc + (p.tests?.length || 0), 0);
  const totalSurgeries = surgeries.length + doctorPrescriptions.reduce((acc, p) => acc + (p.surgeries?.length || 0), 0);
  const firstName = patientData?.first_name || patientData?.firstName || "Patient";
  const lastName = patientData?.last_name || patientData?.lastName || "";
  const patientName = `${firstName} ${lastName}`.trim();
  const age = calculateAge(patientData?.date_of_birth || patientData?.dob);
  const patientId = formatPatientId(patientData?.id || patientData?.patient_id || patientData?.profile_id);

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />
      <main className="container mx-auto py-6 sm:py-8 pt-[var(--nav-content-offset)] max-w-6xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 space-y-4">
          <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20">
            Active Patient Profile
          </Badge>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                Patient Medical History
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                {patientName}
                {age !== null ? ` | ${age} Years` : ""}
                {patientId !== "N/A" ? ` | ID: ${patientId}` : ""}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={handleExportAll}
                size="sm"
                className="w-full sm:w-auto touch-target"
              >
                <Download className="h-4 w-4 mr-2" />
                <span className="sm:inline">Export Report</span>
              </Button>
              <Button
                onClick={() => setActiveTab("medications")}
                size="sm"
                className="w-full sm:w-auto touch-target"
              >
                New Entry
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex h-auto w-full gap-2 overflow-x-auto p-1 bg-muted/30 no-scrollbar">
            <TabsTrigger value="timeline" className="h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Timeline</span>
              <span className="sm:hidden">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="medications" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.medications.tabActiveState}`}>
              <Pill className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.medications.tabIconText}`} />
              <span className="hidden sm:inline">Medications</span>
              <span className="sm:hidden">Meds</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.tests.tabActiveState}`}>
              <FlaskConical className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.tests.tabIconText}`} />
              <span className="hidden sm:inline">Lab Tests</span>
              <span className="sm:hidden">Tests</span>
            </TabsTrigger>
            <TabsTrigger value="surgeries" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.surgeries.tabActiveState}`}>
              <Syringe className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.surgeries.tabIconText}`} />
              <span className="hidden sm:inline">Surgeries</span>
              <span className="sm:hidden">Surgery</span>
            </TabsTrigger>
            <TabsTrigger value="hospitalizations" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.hospitalizations.tabActiveState}`}>
              <Hospital className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.hospitalizations.tabIconText}`} />
              <span className="hidden sm:inline">Hospitalizations</span>
              <span className="sm:hidden">Hospital</span>
            </TabsTrigger>
            <TabsTrigger value="vaccinations" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.vaccinations.tabActiveState}`}>
              <Shield className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.vaccinations.tabIconText}`} />
              <span className="hidden sm:inline">Vaccinations</span>
              <span className="sm:hidden">Vaccines</span>
            </TabsTrigger>
            <TabsTrigger value="visits" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.visits.tabActiveState}`}>
              <CheckCircle2 className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.visits.tabIconText}`} />
              <span className="hidden sm:inline">Visits</span>
              <span className="sm:hidden">Visits</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.reports.tabActiveState}`}>
              <FileText className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.reports.tabIconText}`} />
              <span className="hidden sm:inline">Lab Reports</span>
              <span className="sm:hidden">Reports</span>
            </TabsTrigger>
          </TabsList>

          {/* Medications Tab */}
          <TabsContent value="medications" className="mt-0 space-y-6">
            {activeTab === "medications" ? (
              <>
            {/* Doctor Prescribed Medications */}
            {doctorPrescriptions.filter(p => p.medications.length > 0).length > 0 && (
              <Card className="border-primary/30 dark:border-primary/50">
                <CardHeader className="bg-linear-to-r from-primary/5 to-transparent dark:from-primary/10">
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
                      .filter(p => p.medications.length > 0)
                      .map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>|</span>
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
                              <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
              </>
            ) : null}
          </TabsContent>

          {/* Lab Tests Tab */}
          <TabsContent value="tests" className="mt-0 space-y-6">
            {activeTab === "tests" ? (
              <>
            {/* Doctor Prescribed Tests */}
            {doctorPrescriptions.filter(p => p.tests.length > 0).length > 0 && (
              <Card className="border-purple-300 dark:border-purple-700">
                <CardHeader className="bg-linear-to-r from-purple-50 to-transparent dark:from-purple-950/30">
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
                      .filter(p => p.tests.length > 0)
                      .map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>|</span>
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
              <CardHeader className="bg-linear-to-r from-purple-50 to-card dark:from-purple-950/30 dark:to-card border-b border-purple-100 dark:border-purple-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      Lab Tests & Diagnostics
                    </CardTitle>
                    <CardDescription className="text-muted-foreground dark:text-muted-foreground">Track your medical tests and results</CardDescription>
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
              <CardContent className="p-4 sm:p-6 bg-card dark:bg-card">
                {medicalTests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <FlaskConical className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-foreground dark:text-foreground font-medium">No lab tests recorded yet</p>
                    <p className="text-sm mt-2 text-muted-foreground dark:text-muted-foreground">Click &quot;Add Test&quot; to record your lab tests</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {medicalTests.map((test, index) => (
                      <div key={index} className="border border-purple-200 dark:border-purple-800 rounded-xl p-5 bg-linear-to-br from-purple-50/50 to-card dark:from-purple-950/20 dark:to-card shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <span className="h-7 w-7 rounded-full bg-purple-600 text-white text-sm font-medium flex items-center justify-center">
                              {index + 1}
                            </span>
                            <span className="text-sm font-semibold text-foreground dark:text-foreground">
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
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
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
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
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
                                className="pl-10 border-border focus:border-purple-500 focus:ring-purple-500 text-foreground"
                              />
                            </div>
                          </div>

                          {/* Result */}
                          <div>
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
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
                              className="border-border focus:border-purple-500 focus:ring-purple-500 text-foreground placeholder:text-muted-foreground"
                            />
                          </div>

                          {/* Status */}
                          <div>
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
                              Status
                            </Label>
                            <select
                              value={test.status}
                              onChange={(e) => {
                                const updated = [...medicalTests];
                                updated[index] = { ...updated[index], status: e.target.value };
                                setMedicalTests(updated);
                              }}
                              className="w-full h-10 px-3 rounded-md border border-border bg-card text-sm text-foreground focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="scheduled">Scheduled</option>
                            </select>
                          </div>

                          {/* Prescribing Doctor */}
                          <div>
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
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
                              className="border-border focus:border-purple-500 focus:ring-purple-500 text-foreground placeholder:text-muted-foreground"
                            />
                          </div>

                          {/* Hospital/Lab */}
                          <div>
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
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
                              className="border-border focus:border-purple-500 focus:ring-purple-500 text-foreground placeholder:text-muted-foreground"
                            />
                          </div>

                          {/* Notes */}
                          <div className="md:col-span-2">
                            <Label className="text-sm font-semibold text-foreground mb-2 block">
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
                              className="border-border focus:border-purple-500 focus:ring-purple-500 text-foreground placeholder:text-muted-foreground"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Surgeries Tab */}
          <TabsContent value="surgeries" className="mt-0 space-y-6">
            {activeTab === "surgeries" ? (
              <>
            {/* Doctor Recommended Surgeries */}
            {doctorPrescriptions.filter(p => p.surgeries.length > 0).length > 0 && (
              <Card className="border-success/30 dark:border-success/50">
                <CardHeader className="bg-linear-to-r from-success/5 to-transparent dark:from-success/10">
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
                      .filter(p => p.surgeries.length > 0)
                      .map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>|</span>
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
                                    <span className="ml-1 font-medium text-foreground">BDT {surgery.estimated_cost_min.toLocaleString()} - BDT {surgery.estimated_cost_max.toLocaleString()}</span>
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
              </>
            ) : null}
          </TabsContent>

          {/* Hospitalizations Tab */}
          <TabsContent value="hospitalizations" className="mt-0">
            {activeTab === "hospitalizations" ? (
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <HospitalizationManager
                    hospitalizations={hospitalizations}
                    onUpdate={setHospitalizations}
                  />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* Vaccinations Tab */}
          <TabsContent value="vaccinations" className="mt-0">
            {activeTab === "vaccinations" ? (
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <VaccinationManager
                    vaccinations={vaccinations}
                    onUpdate={setVaccinations}
                  />
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

          {/* Visits Tab */}
          <TabsContent value="visits" className="mt-0">
            {activeTab === "visits" ? (
              <>
            <Card>
              <CardHeader>
                <CardTitle>Past Doctor Visits</CardTitle>
                <CardDescription>History of your consultations with Medora doctors</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {appointments.length > 0 ? (
                  <div className="space-y-4">
                    {appointments.map((app, i) => (
                      <div key={i} className="flex flex-col justify-between gap-4 rounded-lg border bg-surface/30 p-4 md:flex-row md:items-center">
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                             <Calendar className="h-4 w-4 text-primary" />
                             <span className="font-semibold text-primary">{new Date(app.appointment_date).toLocaleDateString()}</span>
                             <span className="text-muted-foreground text-sm">{new Date(app.appointment_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </div>
                          <div className="text-lg font-semibold">
                            {app.doctor_title ? `${app.doctor_title} ` : 'Dr.'}{app.doctor_name || app.doctor || 'Doctor'}
                          </div>

                          <div className="text-sm text-muted-foreground mt-0.5">
                            {(() => {
                              const { consultationType, appointmentType } = parseCompositeReason(app.reason)
                              const ct = humanizeConsultationType(consultationType)
                              const at = humanizeAppointmentType(appointmentType)
                              return <>{ct}{at ? ` | ${at}` : ''}</>
                            })()}
                          </div>

                          {app.notes && <div className="mt-2 max-w-xl text-sm text-muted-foreground break-words">{app.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-center">
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
              </>
            ) : null}
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-0 space-y-6">
            {activeTab === "reports" ? (
              selectedReportId && selectedReport ? (
                /* ── Report Detail View ── */
                <div className="space-y-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mb-2 gap-1"
                    onClick={() => setSelectedReportId(null)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Reports
                  </Button>

                  {reportDetailLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : reportDetailError ? (
                    <Card className="border-destructive/50 bg-destructive/10">
                      <CardContent className="p-6 text-center text-destructive">
                        {reportDetailError}
                        <Button variant="outline" size="sm" className="ml-4" onClick={() => loadReportDetail(selectedReportId)}>
                          Retry
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                            {selectedReport.file_name || "Lab Report"}
                          </h2>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Uploaded {new Date(selectedReport.created_at).toLocaleDateString()}</span>
                            {selectedReport.report_date && (
                              <span>Report date: {new Date(selectedReport.report_date).toLocaleDateString()}</span>
                            )}
                            {selectedReport.ocr_engine && (
                              <span className="capitalize">Engine: {selectedReport.ocr_engine}</span>
                            )}
                          </div>
                        </div>
                        {selectedReport.file_url && (
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.open(selectedReport.file_url!, "_blank")}>
                            <ExternalLink className="h-4 w-4" />
                            View Original
                          </Button>
                        )}
                      </div>

                      {/* Summary cards */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <FlaskConical className="h-6 w-6 mx-auto mb-1 text-primary" />
                            <p className="text-2xl font-bold">{selectedReport.results.length}</p>
                            <p className="text-xs text-muted-foreground">Tests Found</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-600" />
                            <p className="text-2xl font-bold">{selectedReport.results.filter((r) => r.status === "normal").length}</p>
                            <p className="text-xs text-muted-foreground">Normal</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" />
                            <p className="text-2xl font-bold">{selectedReport.results.filter((r) => r.status === "high" || r.status === "low").length}</p>
                            <p className="text-xs text-muted-foreground">Abnormal</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <MessageSquare className="h-6 w-6 mx-auto mb-1 text-blue-500" />
                            <p className="text-2xl font-bold">{selectedReport.comments.length}</p>
                            <p className="text-xs text-muted-foreground">Comments</p>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Test Results Table */}
                      <Card className="rounded-xl">
                        <CardHeader>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-primary" />
                            Test Results
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {selectedReport.results.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                              <p>No test results were extracted from this report.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-3 pr-4 font-medium">Test Name</th>
                                    <th className="pb-3 pr-4 font-medium">Value</th>
                                    <th className="pb-3 pr-4 font-medium">Unit</th>
                                    <th className="pb-3 pr-4 font-medium">Reference Range</th>
                                    <th className="pb-3 font-medium">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedReport.results.map((result) => (
                                    <tr
                                      key={result.id}
                                      className={`border-b last:border-0 ${result.status === "high" || result.status === "low" ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}
                                    >
                                      <td className="py-3 pr-4 font-medium">{result.test_name}</td>
                                      <td className="py-3 pr-4">{result.value !== null ? result.value : result.value_text || "--"}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">{result.unit || "--"}</td>
                                      <td className="py-3 pr-4 text-muted-foreground">
                                        {result.reference_range_min !== null && result.reference_range_max !== null
                                          ? `${result.reference_range_min} - ${result.reference_range_max}`
                                          : result.reference_range_text || "--"}
                                      </td>
                                      <td className="py-3">{getStatusBadge(result.status)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Doctor Comments */}
                      {selectedReport.comments.length > 0 && (
                        <Card className="rounded-xl">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <MessageSquare className="h-5 w-5 text-primary" />
                              Doctor Notes
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {selectedReport.comments.map((comment) => (
                              <div key={comment.id} className="p-4 rounded-lg bg-muted/50 border">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{comment.doctor_name || "Doctor"}</span>
                                  <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleDateString()}</span>
                                </div>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{comment.comment}</p>
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* ── Reports List View ── */
                <div className="space-y-6">
                  {/* Header with upload button */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold text-foreground">Upload and view your lab test reports</h2>
                    </div>
                    <Button onClick={() => setShowUpload(!showUpload)} className="gap-2" size="sm">
                      <Upload className="h-4 w-4" />
                      Upload Report
                    </Button>
                  </div>

                  {/* Upload Section */}
                  {showUpload && (
                    <Card className="rounded-xl border-primary/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Upload className="h-5 w-5 text-primary" />
                          Upload Lab Report
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleDrop}
                          className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {selectedFile ? (
                            <div className="space-y-3">
                              {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                              ) : (
                                <FileText className="h-12 w-12 mx-auto text-primary opacity-70" />
                              )}
                              <div className="flex items-center justify-center gap-2">
                                <p className="text-sm font-medium">{selectedFile.name}</p>
                                <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); clearFile(); }} className="h-6 w-6 p-0">
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <ImageIcon className="h-12 w-12 mx-auto opacity-40" />
                              <p className="text-muted-foreground">Drag & drop your report here, or click to browse</p>
                              <p className="text-xs text-muted-foreground">Supports JPG, PNG, WebP, PDF (max 15MB)</p>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />

                        <div className="space-y-2">
                          <Label>Report Date (optional)</Label>
                          <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="max-w-xs rounded-lg" />
                        </div>

                        {uploadError && (
                          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{uploadError}</div>
                        )}

                        <div className="flex gap-3">
                          <Button onClick={handleReportUpload} disabled={!selectedFile || uploading} className="gap-2">
                            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {uploading ? "Processing..." : "Upload & Extract"}
                          </Button>
                          <Button variant="outline" onClick={() => { setShowUpload(false); clearFile(); }}>Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Error */}
                  {reportsError && (
                    <Card className="border-destructive/50 bg-destructive/10">
                      <CardContent className="p-6 text-center text-destructive">
                        {reportsError}
                        <Button variant="outline" size="sm" className="ml-4" onClick={loadReports}>Retry</Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Loading */}
                  {reportsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : reports.length === 0 ? (
                    <Card className="text-center py-12">
                      <CardContent>
                        <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground mb-2">No medical reports yet</p>
                        <p className="text-sm text-muted-foreground">Upload your first lab report to get started</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid gap-4">
                      {reports.map((report) => (
                        <Card
                          key={report.id}
                          className="rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedReportId(report.id)}
                        >
                          <CardContent className="p-4 sm:p-6">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                  <FlaskConical className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="font-medium text-foreground truncate">{report.file_name || "Lab Report"}</h3>
                                    {report.parsed ? (
                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />Processed
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                                        <Clock className="h-3 w-3 mr-1" />Pending
                                      </Badge>
                                    )}
                                  </div>
                                  {report.summary && (
                                    <p className="text-sm text-muted-foreground mt-1 truncate">{report.summary}</p>
                                  )}
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                    {report.result_count > 0 && (
                                      <span className="flex items-center gap-1">
                                        <FlaskConical className="h-3 w-3" />{report.result_count} tests
                                      </span>
                                    )}
                                    {report.comment_count > 0 && (
                                      <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />{report.comment_count} comments
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : null}
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0">
            {activeTab === "timeline" ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
                {/* Left Column - Timeline (8 cols) */}
                <div className="col-span-12 lg:col-span-8">
                  <EnhancedMedicalHistoryTimeline
                    surgeries={surgeries}
                    hospitalizations={hospitalizations}
                    vaccinations={vaccinations}
                    medications={medications}
                    appointments={appointments}
                    medicalTests={medicalTests}
                    doctorPrescriptions={doctorPrescriptions}
                    title="Medical Timeline"
                    description="Your complete medical history in chronological order"
                  />
                </div>

                {/* Right Column - Analytics (4 cols) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                  {/* Condition Distribution Chart */}
                  <ConditionDistributionChart patientData={patientData} />

                  {/* Prescription History Chart */}
                  <PrescriptionHistoryChart
                    medications={medications}
                    doctorPrescriptions={doctorPrescriptions}
                  />

                  {/* Vitals Summary */}
                  <VitalsSummaryCard
                    patientData={patientData}
                    medicalTests={medicalTests}
                  />
                </div>
              </div>
            ) : null}
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
        <div className="flex items-center justify-center min-h-dvh min-h-app">
          <div className="skeleton w-8 h-8 rounded-full"></div>
        </div>
      </AppBackground>
    }>
      <PatientMedicalHistoryPage />
    </Suspense>
  );
}



