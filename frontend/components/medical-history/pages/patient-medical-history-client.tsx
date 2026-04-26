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
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import type { Medication } from "@/components/medicine";
import { AddMedicationDialog } from "@/components/medicine/add-medication-dialog";
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
  Bell,
  FileText,
  Upload,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  UserRound,
  X,
  ImageIcon,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  ExternalLink,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { usePagination } from "@/lib/use-pagination";
import { fetchWithAuth } from "@/lib/auth-utils";
import { updatePatientOnboarding, getPatientOnboardingData } from "@/lib/auth-actions";
import {
  buildFrequencyFromDoseSchedule,
  formatDoseScheduleSummary,
  computeExpiryDate,
  humanizeMealInstruction,
  isMedicationExpired,
  type MealInstructionValue,
  toBackendPatientMedication,
  toPatientMedication,
  type BackendPatientMedication,
} from "@/lib/patient-medication";

import { getMyAppointments } from "@/lib/appointment-actions";
import { formatMeridiemTime, humanizeConsultationType, humanizeAppointmentType, parseCompositeReason } from "@/lib/utils";
import { MEDICAL_MODULE_TAB_ACCENTS } from "@/components/medical-history/module-tab-accents";

import { getMedicalHistoryPrescriptions, type Prescription, type MedicationPrescription, type TestPrescription, type SurgeryRecommendation } from "@/lib/prescription-actions";
import { PrescriptionReminderDialog } from "@/components/ui/reminder-dialog";
import { ReminderDialog } from "@/components/ui/reminder-dialog";

import {
  listMedicalReports,
  getMedicalReport,
  type MedicalReportListItem,
  type MedicalReport,
} from "@/lib/medical-report-actions";
import { uploadMedicalReport } from "@/lib/medical-report-upload";
import { useT } from "@/i18n/client";

const HospitalizationManager = dynamic(
  () =>
    import("@/components/medical-history/hospitalization-manager").then(
      (module) => module.HospitalizationManager,
    ),
  { loading: () => <CardSkeleton className="h-32 w-full rounded-lg" /> },
);

const VaccinationManager = dynamic(
  () =>
    import("@/components/medical-history/vaccination-manager").then(
      (module) => module.VaccinationManager,
    ),
  { loading: () => <CardSkeleton className="h-32 w-full rounded-lg" /> },
);

const SurgeryManager = dynamic(
  () =>
    import("@/components/medical-history/surgery-manager").then(
      (module) => module.SurgeryManager,
    ),
  { loading: () => <CardSkeleton className="h-32 w-full rounded-lg" /> },
);

const MedicalTestSearch = dynamic(
  () => import("@/components/medical-test").then((module) => module.MedicalTestSearch),
  { ssr: false, loading: () => <CardSkeleton className="h-10 w-full rounded-md" /> },
);

const PreviouslyVisitedDoctorsTab = dynamic(
  () =>
    import("@/components/medical-history/previously-visited-doctors-tab").then(
      (m) => m.PreviouslyVisitedDoctorsTab,
    ),
  { loading: () => <CardSkeleton className="h-32 w-full rounded-lg" /> },
);

const EnhancedMedicalHistoryTimeline = dynamic(
  () => import("@/components/medical-history/enhanced-medical-history-timeline").then((module) => module.EnhancedMedicalHistoryTimeline),
  { loading: () => <CardSkeleton className="h-32 w-full rounded-lg" /> },
);

const ConditionDistributionChart = dynamic(
  () => import("@/components/medical-history/condition-distribution-chart").then((module) => module.ConditionDistributionChart),
  { loading: () => <CardSkeleton className="h-64 w-full rounded-lg" /> },
);

const PrescriptionHistoryChart = dynamic(
  () => import("@/components/medical-history/prescription-history-chart").then((module) => module.PrescriptionHistoryChart),
  { loading: () => <CardSkeleton className="h-64 w-full rounded-lg" /> },
);

const VitalsSummaryCard = dynamic(
  () => import("@/components/medical-history/vitals-summary-card").then((module) => module.VitalsSummaryCard),
  { loading: () => <CardSkeleton className="h-64 w-full rounded-lg" /> },
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

type TestFilter = "pending" | "completed" | "skipped" | "all";
type TestSourceFilter = "doctor" | "self" | "all";
type UnifiedTestSource = "doctor" | "self";
type UnifiedTestStatus = "pending" | "completed" | "overdue" | "skipped";
type SurgeryFilter = "pending" | "completed" | "skipped" | "all";
type SurgerySourceFilter = "doctor" | "self" | "all";
type UnifiedSurgerySource = "doctor" | "self";
type UnifiedSurgeryStatus = "pending" | "completed" | "overdue" | "skipped";

interface UnifiedTestEntry {
  id: string;
  source: UnifiedTestSource;
  sourceLabel: string;
  kind: "doctor-prescribed-template" | "patient-record";
  index?: number;
  test_name: string;
  test_date: string;
  result: string;
  notes: string;
  prescribing_doctor: string;
  hospital_lab: string;
  urgency: string;
  status?: string;
  created_at: string;
}

interface UnifiedSurgeryEntry {
  id: string;
  source: UnifiedSurgerySource;
  sourceLabel: string;
  kind: "doctor-prescribed-template" | "patient-record";
  index?: number;
  procedure_name: string;
  procedure_type?: string;
  reason?: string;
  preferred_facility?: string;
  recommended_date?: string;
  estimated_cost_min?: number;
  estimated_cost_max?: number;
  pre_op_instructions?: string;
  notes?: string;
  urgency?: string;
  status?: string;
  created_at: string;
  recommendationId?: string;
  prescriptionId?: string;
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

function normalizeMedicationKey(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeTestValue(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSurgeryValue(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function isMedicationInactive(medication: Medication) {
  if (medication.status === "past") return true;
  if (medication.stopped_date) return true;
  return isMedicationExpired(medication);
}

function MedicationEntryCard({
  title,
  genericName,
  strengthOrType,
  schedule,
  duration,
  mealInstruction,
  startedDate,
  expiryDate,
  inactiveDate,
  actionSlot,
  labels,
}: {
  title: string;
  genericName?: string;
  strengthOrType?: string;
  schedule: string;
  duration?: string;
  mealInstruction?: string;
  startedDate?: string;
  expiryDate?: string | null;
  inactiveDate?: string | null;
  actionSlot?: React.ReactNode;
  labels?: {
    expiredOn: string;
    expiresOn: string;
    expired: string;
    current: string;
    dosageSchedule: string;
    duration: string;
    meal: string;
    startDate: string;
  };
}) {
  const resolvedLabels = labels ?? {
    expiredOn: "Expired on",
    expiresOn: "Expires on",
    expired: "Expired",
    current: "Current",
    dosageSchedule: "Dosage schedule",
    duration: "Duration",
    meal: "Meal",
    startDate: "Start Date",
  };
  const inactive = Boolean(inactiveDate);
  const dateLabel = inactive ? resolvedLabels.expiredOn : resolvedLabels.expiresOn;
  const resolvedDate = inactiveDate || expiryDate;

  return (
    <div className="p-4 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <h4 className="font-semibold text-foreground">{title}</h4>
          {genericName && <p className="text-sm text-muted-foreground">{genericName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {strengthOrType && (
            <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30">
              {strengthOrType}
            </Badge>
          )}
          <Badge variant="outline" className={inactive ? "bg-muted text-muted-foreground" : "bg-success/10 text-success border-success/20"}>
            {inactive ? resolvedLabels.expired : resolvedLabels.current}
          </Badge>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-muted-foreground">{resolvedLabels.dosageSchedule}</span>
          <span className="ml-1 font-medium text-foreground">{schedule}</span>
        </div>
        {duration && (
          <div>
            <span className="text-muted-foreground">{resolvedLabels.duration}</span>
            <span className="ml-1 font-medium text-foreground">{duration}</span>
          </div>
        )}
        {mealInstruction && (
          <div>
            <span className="text-muted-foreground">{resolvedLabels.meal}</span>
            <span className="ml-1 font-medium text-foreground">{mealInstruction}</span>
          </div>
        )}
        {startedDate && (
          <div>
            <span className="text-muted-foreground">{resolvedLabels.startDate}</span>
            <span className="ml-1 font-medium text-foreground">{new Date(startedDate).toLocaleDateString()}</span>
          </div>
        )}
      </div>
      {resolvedDate && (
        <p className="mt-2 text-sm text-muted-foreground">
          {dateLabel}: {new Date(resolvedDate).toLocaleDateString()}
        </p>
      )}
      {actionSlot && <div className="mt-3 pt-3 border-t border-primary/10">{actionSlot}</div>}
    </div>
  );
}

function PatientMedicalHistoryPage() {
  const tCommon = useT("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "timeline");
  
  // Data states
  const [medications, setMedications] = useState<Medication[]>([]);
  const [patientData, setPatientData] = useState<Record<string, unknown> | null>(null);

  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);


  const [medicalTests, setMedicalTests] = useState<MedicalTest[]>([]);
  const [testFilter, setTestFilter] = useState<TestFilter>("pending");
  const [testSourceFilter, setTestSourceFilter] = useState<TestSourceFilter>("all");
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [completingTestIndex, setCompletingTestIndex] = useState<number | null>(null);
  const [resultForm, setResultForm] = useState({ result: "", notes: "" });
  const [addTestDialogOpen, setAddTestDialogOpen] = useState(false);
  const [testActionMessage, setTestActionMessage] = useState<string | null>(null);
  const [testActionError, setTestActionError] = useState<string | null>(null);
  const [surgeryActionMessage, setSurgeryActionMessage] = useState<string | null>(null);
  const [surgeryActionError, setSurgeryActionError] = useState<string | null>(null);
  const [surgeryFilter, setSurgeryFilter] = useState<SurgeryFilter>("pending");
  const [surgerySourceFilter, setSurgerySourceFilter] = useState<SurgerySourceFilter>("all");
  const [addSurgeryDialogOpen, setAddSurgeryDialogOpen] = useState(false);
  const [addSurgeryForm, setAddSurgeryForm] = useState<Surgery>({
    name: "",
    year: new Date().getFullYear().toString(),
    hospital: "",
    notes: "",
    status: "pending",
    recommended_date: new Date().toISOString().slice(0, 10),
    prescribing_doctor: "",
    urgency: "",
  });
  const [highlightedTestId, setHighlightedTestId] = useState<string | null>(null);
  const [highlightedSurgeryId, setHighlightedSurgeryId] = useState<string | null>(null);
  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [addTestForm, setAddTestForm] = useState<MedicalTest>({
    test_name: "",
    test_id: undefined,
    test_date: new Date().toISOString().slice(0, 10),
    result: "",
    status: "pending",
    prescribing_doctor: "",
    hospital_lab: "",
    notes: "",
  });
  const [surgeries, setSurgeries] = useState<Surgery[]>([]);
  const [hospitalizations, setHospitalizations] = useState<{ reason: string; year: string; duration?: string }[]>([]);
  const [vaccinations, setVaccinations] = useState<{ name: string; date: string; next_due?: string }[]>([]);
  
  // Doctor prescriptions state (accepted prescriptions from consultations)
  const [doctorPrescriptions, setDoctorPrescriptions] = useState<Prescription[]>([]);
  const [doctorMedicationFilter, setDoctorMedicationFilter] = useState<"active" | "expired" | "all">("active");
  const [myMedicationFilter, setMyMedicationFilter] = useState<"active" | "expired" | "all">("active");
  const [addMedicationDialogOpen, setAddMedicationDialogOpen] = useState(false);
  const [myMedicationReminderOpen, setMyMedicationReminderOpen] = useState(false);
  const [selectedMyMedication, setSelectedMyMedication] = useState<Medication | null>(null);
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewDurationDays, setRenewDurationDays] = useState("");
  const [renewTarget, setRenewTarget] = useState<{
    medication: MedicationPrescription | Medication;
    sourceDoctor?: string;
  } | null>(null);

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
  const initialLoadedRef = React.useRef(false);
  const setInitialLoaded = (v: boolean) => { initialLoadedRef.current = v; };
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Pagination states
  const appointmentsPagination = usePagination(appointments, 6);
  const reportsPagination = usePagination(reports, 6);
  const doctorMedsPrescriptions = doctorPrescriptions.filter(p => p.medications.length > 0);
  const doctorMedsPagination = usePagination(doctorMedsPrescriptions, 5);
  const doctorSurgeriesPrescriptions = doctorPrescriptions.filter(p => p.surgeries && p.surgeries.length > 0);
  const doctorSurgeriesPagination = usePagination(doctorSurgeriesPrescriptions, 5);
  const deriveTestSource = (test: { prescribing_doctor?: string }): UnifiedTestSource =>
    normalizeTestValue(test.prescribing_doctor) ? "doctor" : "self";

  const getTestStatus = (test: { result?: string; test_date?: string }): UnifiedTestStatus => {
    const explicitStatus = normalizeTestValue((test as { status?: string }).status);
    if (explicitStatus === "skipped") return "skipped";
    if (explicitStatus === "completed") return "completed";
    if (hasResult(test.result)) return "completed";
    if (isOverdueTest(test.test_date, test.result)) return "overdue";
    return "pending";
  };

  const upsertLocalMedicalTest = (incoming: MedicalTest) => {
    const next = [...medicalTests];
    const existingIndex = next.findIndex(
      (entry) =>
        normalizeTestValue(entry.test_name) === normalizeTestValue(incoming.test_name) &&
        normalizeTestValue(entry.test_date) === normalizeTestValue(incoming.test_date),
    );
    if (existingIndex >= 0) next[existingIndex] = incoming;
    else next.unshift(incoming);
    setMedicalTests(next);
    return next;
  };

  const persistMedicalTestsViaOnboarding = async (nextTests: MedicalTest[]) => {
    const token = document.cookie.split("session_token=")[1]?.split(";")[0];
    const response = await fetchWithAuth(`${BACKEND_URL}/profile/patient/onboarding`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        has_medical_tests: nextTests.length > 0 ? "yes" : "no",
        medical_tests: nextTests,
      }),
    });

    if (!response) throw new Error("Unauthorized");
    if (!response.ok) {
      let detail = "Failed to sync test changes";
      try {
        const data = await response.json();
        detail = data?.detail || detail;
      } catch {
        // ignore parse failure
      }
      throw new Error(detail);
    }
  };

  const applyMedicalTestLifecycle = (
    source: MedicalTest[],
    payload: {
      test_name: string;
      test_date: string;
      prescribing_doctor?: string;
      hospital_lab?: string;
      result?: string;
      notes?: string;
      status?: "pending" | "completed" | "skipped";
    },
  ) => {
    const next = [...source];
    const existingIndex = next.findIndex(
      (entry) =>
        normalizeTestValue(entry.test_name) === normalizeTestValue(payload.test_name) &&
        normalizeTestValue(entry.test_date) === normalizeTestValue(payload.test_date),
    );

    const nextStatus = payload.result?.trim()
      ? "completed"
      : payload.status || (existingIndex >= 0 ? next[existingIndex]?.status || "pending" : "pending");

    const updated: MedicalTest = {
      test_name: payload.test_name,
      test_id: existingIndex >= 0 ? next[existingIndex]?.test_id : undefined,
      test_date: payload.test_date,
      result: payload.result?.trim() || (existingIndex >= 0 ? next[existingIndex]?.result || "" : ""),
      status: nextStatus,
      prescribing_doctor: payload.prescribing_doctor ?? (existingIndex >= 0 ? next[existingIndex]?.prescribing_doctor || "" : ""),
      hospital_lab: payload.hospital_lab ?? (existingIndex >= 0 ? next[existingIndex]?.hospital_lab || "" : ""),
      notes: payload.notes ?? (existingIndex >= 0 ? next[existingIndex]?.notes || "" : ""),
    };

    if (existingIndex >= 0) next[existingIndex] = updated;
    else next.unshift(updated);

    return { next, updated };
  };

  const patchMedicalTestLifecycle = async (payload: {
    test_name: string;
    test_date: string;
    prescribing_doctor?: string;
    hospital_lab?: string;
    result?: string;
    notes?: string;
    status?: "pending" | "completed" | "skipped";
  }) => {
    const token = document.cookie.split("session_token=")[1]?.split(";")[0];
    const response = await fetchWithAuth(`${BACKEND_URL}/medical-test/patient/tests`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response) throw new Error("Unauthorized");
    if (!response.ok) {
      if (response.status === 404) {
        const { next, updated } = applyMedicalTestLifecycle(medicalTests, payload);
        await persistMedicalTestsViaOnboarding(next);
        return updated;
      }
      let detail = "Failed to update test";
      try {
        const data = await response.json();
        detail = data?.detail || detail;
      } catch {
        // ignore parse failure
      }
      throw new Error(detail);
    }
    const data = await response.json();
    return (data?.test || null) as Record<string, unknown> | null;
  };

  const isDuplicatePendingTest = (testName?: string, testDate?: string) => {
    const normalizedName = normalizeTestValue(testName);
    const normalizedDate = normalizeTestValue(testDate);
    if (!normalizedName || !normalizedDate) return false;

    return medicalTests.some(
      (existing) =>
        !hasResult(existing.result) &&
        normalizeTestValue(existing.test_name) === normalizedName &&
        normalizeTestValue(existing.test_date) === normalizedDate,
    );
  };

  const getSurgeryStatus = (surgery?: Surgery): "pending" | "completed" | "skipped" => {
    const status = normalizeSurgeryValue(surgery?.status);
    if (status === "completed" || status === "skipped") return status;
    return "pending";
  };

  const findSurgeryIndex = (procedureName: string, recommendedDate?: string) => {
    const targetName = normalizeSurgeryValue(procedureName);
    const targetDate = normalizeSurgeryValue(recommendedDate);
    const targetYear = targetDate ? targetDate.slice(0, 4) : "";

    return surgeries.findIndex((entry) => {
      const sameName = normalizeSurgeryValue(entry.name) === targetName;
      if (!sameName) return false;
      const entryDate = normalizeSurgeryValue(entry.recommended_date);
      const entryYear = normalizeSurgeryValue(entry.year);
      if (targetDate) {
        return entryDate === targetDate || entryYear === targetYear;
      }
      return true;
    });
  };

  const handleSurgeryUpdate = async (nextSurgeries: Surgery[]) => {
    setSurgeries(nextSurgeries);
    try {
      await persistSurgeries(nextSurgeries);
    } catch (error) {
      console.error("Failed to sync surgery changes", error);
    }
  };

  const persistSurgeries = async (nextSurgeries: Surgery[]) => {
    const token = document.cookie.split("session_token=")[1]?.split(";")[0];
    const response = await fetchWithAuth(`${BACKEND_URL}/profile/patient/onboarding`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({
        surgeries: nextSurgeries,
      }),
    });

    if (!response) throw new Error("Unauthorized");
    if (!response.ok) {
      let detail = "Failed to sync surgery changes";
      try {
        const data = await response.json();
        detail = data?.detail || detail;
      } catch {
        // ignore parse failure
      }
      throw new Error(detail);
    }
  };

  const addDoctorSurgery = async (prescription: Prescription, surgery: SurgeryRecommendation) => {
    const yearFromRecommended = surgery.recommended_date
      ? new Date(surgery.recommended_date).getFullYear().toString()
      : new Date().getFullYear().toString();
    const next: Surgery[] = [
      {
        name: surgery.procedure_name || tCommon("medicalHistory.surgeries.untitled"),
        year: yearFromRecommended,
        hospital: surgery.preferred_facility || "",
        notes: surgery.notes || surgery.pre_op_instructions || "",
        status: "pending",
        prescribing_doctor: prescription.doctor_name || "",
        recommended_date: surgery.recommended_date || "",
        urgency: surgery.urgency || "",
      },
      ...surgeries,
    ];

    setSurgeries(next);
    try {
      await persistSurgeries(next);
      setSurgeryActionError(null);
      setSurgeryActionMessage(tCommon("medicalHistory.surgeries.messages.added"));
    } catch (error) {
      console.error("Failed to add doctor surgery", error);
      setSurgeryActionMessage(null);
      setSurgeryActionError(tCommon("medicalHistory.surgeries.messages.addFailed"));
    }
  };

  const updateSurgeryStatus = async (
    index: number,
    status: "pending" | "completed" | "skipped",
    successMessage: string,
    failureMessage: string,
  ) => {
    const current = surgeries[index];
    if (!current) return;

    const next = [...surgeries];
    next[index] = { ...current, status };
    setSurgeries(next);

    try {
      await persistSurgeries(next);
      setSurgeryActionError(null);
      setSurgeryActionMessage(successMessage);
    } catch (error) {
      console.error("Failed to update surgery status", error);
      setSurgeryActionMessage(null);
      setSurgeryActionError(failureMessage);
    }
  };

  const deleteSurgeryByIndex = async (index: number) => {
    const current = surgeries[index];
    if (!current) return;

    const next = surgeries.filter((_, surgeryIndex) => surgeryIndex !== index);
    setSurgeries(next);

    try {
      await persistSurgeries(next);
      setSurgeryActionError(null);
      setSurgeryActionMessage(tCommon("medicalHistory.surgeries.messages.deleted"));
    } catch (error) {
      console.error("Failed to delete surgery", error);
      setSurgeryActionMessage(null);
      setSurgeryActionError(tCommon("medicalHistory.surgeries.messages.deleteFailed"));
      setSurgeries(surgeries);
    }
  };

  const saveNewSurgery = async () => {
    if (!addSurgeryForm.name.trim()) return;

    const recommendedDate = addSurgeryForm.recommended_date || "";
    const nextYear = recommendedDate
      ? new Date(recommendedDate).getFullYear().toString()
      : (addSurgeryForm.year || new Date().getFullYear().toString());

    const nextEntry: Surgery = {
      name: addSurgeryForm.name.trim(),
      year: nextYear,
      hospital: addSurgeryForm.hospital?.trim() || "",
      notes: addSurgeryForm.notes?.trim() || "",
      status: "pending",
      prescribing_doctor: addSurgeryForm.prescribing_doctor?.trim() || "",
      recommended_date: recommendedDate,
      urgency: addSurgeryForm.urgency?.trim() || "",
    };

    const next = [nextEntry, ...surgeries];
    setSurgeries(next);

    try {
      await persistSurgeries(next);
      setSurgeryActionError(null);
      setSurgeryActionMessage(tCommon("medicalHistory.surgeries.messages.added"));
      setSurgeryFilter("pending");
      setSurgerySourceFilter("all");
      setHighlightedSurgeryId(
        `patient-surgery-0-${normalizeSurgeryValue(nextEntry.name)}-${normalizeSurgeryValue(nextEntry.recommended_date || nextEntry.year)}`,
      );
      setAddSurgeryDialogOpen(false);
      setAddSurgeryForm({
        name: "",
        year: new Date().getFullYear().toString(),
        hospital: "",
        notes: "",
        status: "pending",
        recommended_date: new Date().toISOString().slice(0, 10),
        prescribing_doctor: "",
        urgency: "",
      });
    } catch (error) {
      console.error("Failed to add surgery", error);
      setSurgeryActionMessage(null);
      setSurgeryActionError(tCommon("medicalHistory.surgeries.messages.addFailed"));
      setSurgeries(surgeries);
    }
  };

  const buildUnifiedTests = (): UnifiedTestEntry[] => {
    const doctorDerivedTests: UnifiedTestEntry[] = doctorPrescriptions
      .filter((prescription) => prescription.tests.length > 0)
      .flatMap((prescription) =>
        prescription.tests.map((test: TestPrescription) => ({
          id: `doctor-${prescription.id}-${test.id}`,
          source: normalizeTestValue(prescription.doctor_name) ? "doctor" : "self",
          sourceLabel: normalizeTestValue(prescription.doctor_name)
            ? tCommon("medicalHistory.common.doctorPrescribed")
            : tCommon("medicalHistory.common.selfAdded"),
          kind: "doctor-prescribed-template",
          test_name: test.test_name,
          test_date: test.expected_date || "",
          result: "",
          notes: test.instructions || "",
          prescribing_doctor: prescription.doctor_name || "",
          hospital_lab: test.preferred_lab || "",
          urgency: test.urgency || "",
          status: "pending",
          created_at: prescription.created_at,
        })),
      );

    const patientDerivedTests: UnifiedTestEntry[] = medicalTests.map((test, index) => {
      const source = deriveTestSource(test);
      return {
        id: `patient-${index}-${normalizeTestValue(test.test_name)}-${normalizeTestValue(test.test_date)}`,
        source,
        sourceLabel: source === "doctor"
          ? tCommon("medicalHistory.common.doctorPrescribed")
          : tCommon("medicalHistory.common.selfAdded"),
        kind: "patient-record",
        index,
        test_name: test.test_name,
        test_date: test.test_date,
        result: test.result,
        notes: test.notes,
        prescribing_doctor: test.prescribing_doctor,
        hospital_lab: test.hospital_lab,
        urgency: test.status,
        status: test.status,
        created_at: "",
      };
    });

    const mergedDoctorTests: UnifiedTestEntry[] = doctorDerivedTests.map((doctorTest) => {
      const linkedPatientRecord = patientDerivedTests.find(
        (patientTest) =>
          normalizeTestValue(patientTest.test_name) === normalizeTestValue(doctorTest.test_name) &&
          normalizeTestValue(patientTest.test_date) === normalizeTestValue(doctorTest.test_date),
      );

      if (!linkedPatientRecord) return doctorTest;

      return {
        ...doctorTest,
        // Keep doctor card/source identity, but project the active patient data onto it.
        result: linkedPatientRecord.result,
        notes: linkedPatientRecord.notes || doctorTest.notes,
        hospital_lab: linkedPatientRecord.hospital_lab || doctorTest.hospital_lab,
        urgency: linkedPatientRecord.urgency || doctorTest.urgency,
        index: linkedPatientRecord.index,
        kind: "doctor-prescribed-template",
      };
    });

    const unmatchedPatientTests = patientDerivedTests.filter((patientTest) => {
      if (patientTest.source !== "doctor") return true;
      return !doctorDerivedTests.some(
        (doctorTest) =>
          normalizeTestValue(doctorTest.test_name) === normalizeTestValue(patientTest.test_name) &&
          normalizeTestValue(doctorTest.test_date) === normalizeTestValue(patientTest.test_date),
      );
    });

    return [...mergedDoctorTests, ...unmatchedPatientTests];
  };

  const deriveSurgerySource = (surgery: { prescribing_doctor?: string }): UnifiedSurgerySource =>
    normalizeSurgeryValue(surgery.prescribing_doctor) ? "doctor" : "self";

  const isOverdueSurgeryEntry = (entry: { recommended_date?: string; status?: string }) => {
    if (normalizeSurgeryValue(entry.status) !== "pending") return false;
    if (!entry.recommended_date) return false;
    const date = new Date(entry.recommended_date);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() < Date.now();
  };

  const getUnifiedSurgeryStatus = (entry: UnifiedSurgeryEntry): UnifiedSurgeryStatus => {
    const status = normalizeSurgeryValue(entry.status);
    if (status === "completed") return "completed";
    if (status === "skipped") return "skipped";
    if (isOverdueSurgeryEntry(entry)) return "overdue";
    return "pending";
  };

  const buildUnifiedSurgeries = (): UnifiedSurgeryEntry[] => {
    const doctorDerivedSurgeries: UnifiedSurgeryEntry[] = doctorPrescriptions
      .filter((prescription) => prescription.surgeries.length > 0)
      .flatMap((prescription) =>
        prescription.surgeries.map((surgery: SurgeryRecommendation) => ({
          id: `doctor-surgery-${prescription.id}-${surgery.id}`,
          source: normalizeSurgeryValue(prescription.doctor_name) ? "doctor" : "self",
          sourceLabel: normalizeSurgeryValue(prescription.doctor_name)
            ? tCommon("medicalHistory.common.doctorPrescribed")
            : tCommon("medicalHistory.common.selfAdded"),
          kind: "doctor-prescribed-template",
          procedure_name: surgery.procedure_name,
          procedure_type: surgery.procedure_type,
          reason: surgery.reason,
          preferred_facility: surgery.preferred_facility,
          recommended_date: surgery.recommended_date,
          estimated_cost_min: surgery.estimated_cost_min,
          estimated_cost_max: surgery.estimated_cost_max,
          pre_op_instructions: surgery.pre_op_instructions,
          notes: surgery.notes,
          urgency: surgery.urgency,
          status: "pending",
          created_at: prescription.created_at,
          recommendationId: surgery.id,
          prescriptionId: prescription.id,
        })),
      );

    const patientDerivedSurgeries: UnifiedSurgeryEntry[] = surgeries.map((surgery, index) => {
      const source = deriveSurgerySource(surgery);
      return {
        id: `patient-surgery-${index}-${normalizeSurgeryValue(surgery.name)}-${normalizeSurgeryValue(surgery.recommended_date || surgery.year)}`,
        source,
        sourceLabel: source === "doctor"
          ? tCommon("medicalHistory.common.doctorPrescribed")
          : tCommon("medicalHistory.common.selfAdded"),
        kind: "patient-record",
        index,
        procedure_name: surgery.name,
        preferred_facility: surgery.hospital,
        recommended_date: surgery.recommended_date,
        notes: surgery.notes,
        urgency: surgery.urgency,
        status: getSurgeryStatus(surgery),
        created_at: "",
      };
    });

    const mergedDoctorSurgeries: UnifiedSurgeryEntry[] = doctorDerivedSurgeries.map((doctorSurgery) => {
      const linkedPatientIndex = findSurgeryIndex(doctorSurgery.procedure_name, doctorSurgery.recommended_date);
      if (linkedPatientIndex < 0) return doctorSurgery;

      const linkedPatientRecord = patientDerivedSurgeries.find((patientSurgery) => patientSurgery.index === linkedPatientIndex);
      if (!linkedPatientRecord) return doctorSurgery;

      return {
        ...doctorSurgery,
        preferred_facility: linkedPatientRecord.preferred_facility || doctorSurgery.preferred_facility,
        notes: linkedPatientRecord.notes || doctorSurgery.notes,
        urgency: linkedPatientRecord.urgency || doctorSurgery.urgency,
        status: linkedPatientRecord.status,
        index: linkedPatientRecord.index,
      };
    });

    const unmatchedPatientSurgeries = patientDerivedSurgeries.filter((patientSurgery) => {
      if (patientSurgery.source !== "doctor") return true;
      return !doctorDerivedSurgeries.some(
        (doctorSurgery) => findSurgeryIndex(doctorSurgery.procedure_name, doctorSurgery.recommended_date) === patientSurgery.index,
      );
    });

    return [...mergedDoctorSurgeries, ...unmatchedPatientSurgeries];
  };

  // Load all medical history data — fire all three requests in parallel.
  useEffect(() => {
    async function loadMedicalHistory() {
      try {
        setLoading(true);
        const [data, appointmentsResult, prescriptionResult] = await Promise.all([
          getPatientOnboardingData(),
          getMyAppointments().catch((error) => {
            console.error("Failed to load appointments", error);
            return null;
          }),
          getMedicalHistoryPrescriptions().catch((error) => {
            console.error("Failed to load doctor prescriptions", error);
            return null;
          }),
        ]);

        if (data) {
          // Store full patient data for analytics
          setPatientData(data);

          // Load medications
          const meds = data.medications || [];
          const convertedMeds = meds.map((med: BackendPatientMedication) => toPatientMedication(med));
          setMedications(convertedMeds);

          // Load other medical history
          setSurgeries(data.surgeries || []);
          setHospitalizations(data.hospitalizations || []);
          setVaccinations(data.vaccinations || []);
          setMedicalTests(data.medical_tests || []);
        } else {
          console.error("Failed to load medical history data");
        }

        if (Array.isArray(appointmentsResult)) {
          setAppointments(appointmentsResult);
        }
        if (prescriptionResult?.prescriptions) {
          setDoctorPrescriptions(prescriptionResult.prescriptions);
        }

        setInitialLoaded(true); // Allow saving even if any individual fetch failed.
      } catch (error) {
        console.error("Error loading medical history:", error);
        setInitialLoaded(true);
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
      const backendMedications = medications.map((medication) =>
        toBackendPatientMedication(medication),
      );
      
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
        const convertedMeds = meds.map((med: BackendPatientMedication) => toPatientMedication(med));
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

  const persistMedications = async (nextMedications: Medication[]) => {
    const backendMedications = nextMedications.map((medication) => toBackendPatientMedication(medication));
    await updatePatientOnboarding({
      taking_meds: nextMedications.length > 0 ? "yes" : "no",
      medications: backendMedications,
    });
  };

  const handleMedicationUpdate = (nextMedications: Medication[]) => {
    setMedications(nextMedications);
    persistMedications(nextMedications).catch((error) => {
      console.error("Failed to persist medications:", error);
      setErrorMessage(tCommon("medicalHistory.medications.messages.syncFailed"));
      setErrorDialogOpen(true);
    });
  };

  const buildMedicationFromDoctorPrescription = (med: MedicationPrescription, sourceDoctor?: string, nextDuration?: string): Medication => {
    const startedDate = new Date().toISOString().slice(0, 10);
    const duration = (nextDuration || (med.duration_value ? `${med.duration_value} ${med.duration_unit}` : "")).trim();

    return {
      id: crypto.randomUUID(),
      drug_id: "",
      display_name: med.medicine_name,
      generic_name: med.generic_name || med.medicine_name,
      strength: med.strength || "",
      dosage_form: med.medicine_type || "",
      dosage: med.strength || "",
      frequency: buildFrequencyFromDoseSchedule({
        dose_morning: Boolean(med.dose_morning),
        dose_afternoon: Boolean(med.dose_afternoon),
        dose_evening: false,
        dose_night: Boolean(med.dose_night || med.dose_evening),
        dose_morning_amount: med.dose_morning_amount || "1",
        dose_afternoon_amount: med.dose_afternoon_amount || "1",
        dose_evening_amount: "1",
        dose_night_amount: med.dose_night_amount || med.dose_evening_amount || "1",
      }),
      duration,
      status: "current",
      started_date: startedDate,
      stopped_date: "",
      prescribing_doctor: sourceDoctor || undefined,
      dose_morning: Boolean(med.dose_morning),
      dose_afternoon: Boolean(med.dose_afternoon),
      dose_evening: false,
      dose_night: Boolean(med.dose_night || med.dose_evening),
      dose_morning_amount: med.dose_morning_amount || "1",
      dose_afternoon_amount: med.dose_afternoon_amount || "1",
      dose_evening_amount: "1",
      dose_night_amount: med.dose_night_amount || med.dose_evening_amount || "1",
      meal_instruction: (med.meal_instruction as MealInstructionValue) || "after_meal",
    };
  };

  const openRenewMedicationDialog = (medication: MedicationPrescription | Medication, sourceDoctor?: string) => {
    setRenewTarget({ medication, sourceDoctor });
    setRenewDurationDays("7");
    setRenewDialogOpen(true);
  };

  const confirmRenewMedication = () => {
    if (!renewTarget) return;
    const days = Number(renewDurationDays);
    if (!Number.isFinite(days) || days <= 0) return;

    const duration = `${Math.round(days)} days`;
    const isDoctorMedication = "medicine_name" in renewTarget.medication;
    const renewed = isDoctorMedication
      ? buildMedicationFromDoctorPrescription(renewTarget.medication as MedicationPrescription, renewTarget.sourceDoctor, duration)
      : {
          ...(renewTarget.medication as Medication),
          id: crypto.randomUUID(),
          status: "current" as const,
          stopped_date: "",
          started_date: new Date().toISOString().slice(0, 10),
          duration,
        };

    handleMedicationUpdate([renewed, ...medications]);
    setRenewDialogOpen(false);
    setRenewTarget(null);
    setRenewDurationDays("");
  };

  const markMedicationExpiredNow = (target: Medication) => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const updated = medications.map((medication) =>
      medication.id === target.id
        ? {
            ...medication,
            status: "past" as const,
            stopped_date: nowIso,
          }
        : medication,
    );
    handleMedicationUpdate(updated);
  };

  const sortedMyMedications = [...medications].sort((a, b) => {
    const aDate = new Date(a.started_date || a.stopped_date || 0).getTime();
    const bDate = new Date(b.started_date || b.stopped_date || 0).getTime();
    return bDate - aDate;
  });

  const visibleMyMedications = sortedMyMedications.filter((medication) => {
    const inactive = isMedicationInactive(medication);
    if (myMedicationFilter === "active") return !inactive;
    if (myMedicationFilter === "expired") return inactive;
    return true;
  });

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
    } catch (err: unknown) {
      console.error("Failed to load reports:", err);
      setReportsError(err instanceof Error ? err.message : tCommon("medicalHistory.reports.errors.loadFailed"));
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
    } catch (err: unknown) {
      console.error("Failed to load report:", err);
      setReportDetailError(err instanceof Error ? err.message : tCommon("medicalHistory.reports.errors.loadSingleFailed"));
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
      setUploadError(tCommon("medicalHistory.reports.errors.invalidUploadType"));
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
    } catch (err: unknown) {
      console.error("Upload failed:", err);
      setUploadError(err instanceof Error ? err.message : tCommon("medicalHistory.reports.errors.uploadFailed"));
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
            <CheckCircle2 className="h-3 w-3 mr-1" />{tCommon("medicalHistory.reports.status.normal")}
          </Badge>
        );
      case "high":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
            <ArrowUp className="h-3 w-3 mr-1" />{tCommon("medicalHistory.reports.status.high")}
          </Badge>
        );
      case "low":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <ArrowDown className="h-3 w-3 mr-1" />{tCommon("medicalHistory.reports.status.low")}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">--</Badge>
        );
    }
  };

  const hasResult = (result?: string) => Boolean(result && result.trim().length > 0);

  const isOverdueTest = (testDate?: string, result?: string) => {
    if (hasResult(result) || !testDate) return false;
    const date = new Date(testDate);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() < Date.now();
  };

  const isCompletedTest = (test: { result?: string }) => hasResult(test.result);

  const getComputedTestStatusBadge = (test: { result?: string; test_date?: string }) => {
    const explicitStatus = normalizeTestValue((test as { status?: string }).status);
    if (explicitStatus === "skipped") {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700">
          {tCommon("medicalHistory.status.skipped")}
        </Badge>
      );
    }

    if (explicitStatus === "completed" || isCompletedTest(test)) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {tCommon("medicalHistory.status.completed")}
        </Badge>
      );
    }

    if (isOverdueTest(test.test_date, test.result)) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
          <AlertTriangle className="mr-1 h-3 w-3" />
          {tCommon("medicalHistory.status.overdue")}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
        <Clock className="mr-1 h-3 w-3" />
        {tCommon("medicalHistory.status.pending")}
      </Badge>
    );
  };

  const getComputedSurgeryStatusBadge = (entry: UnifiedSurgeryEntry) => {
    const status = getUnifiedSurgeryStatus(entry);

    if (status === "skipped") {
      return (
        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700">
          {tCommon("medicalHistory.status.skipped")}
        </Badge>
      );
    }

    if (status === "completed") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {tCommon("medicalHistory.status.completed")}
        </Badge>
      );
    }

    if (status === "overdue") {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
          <AlertTriangle className="mr-1 h-3 w-3" />
          {tCommon("medicalHistory.status.overdue")}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
        <Clock className="mr-1 h-3 w-3" />
        {tCommon("medicalHistory.status.pending")}
      </Badge>
    );
  };

  useEffect(() => {
    if (!testActionMessage && !testActionError) return;
    const timer = window.setTimeout(() => {
      setTestActionMessage(null);
      setTestActionError(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [testActionMessage, testActionError]);

  useEffect(() => {
    if (!surgeryActionMessage && !surgeryActionError) return;
    const timer = window.setTimeout(() => {
      setSurgeryActionMessage(null);
      setSurgeryActionError(null);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [surgeryActionMessage, surgeryActionError]);

  useEffect(() => {
    if (!highlightedTestId) return;
    const element = document.getElementById(`test-card-${highlightedTestId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const timer = window.setTimeout(() => setHighlightedTestId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [highlightedTestId]);

  useEffect(() => {
    if (!highlightedSurgeryId) return;
    const element = document.getElementById(`surgery-card-${highlightedSurgeryId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    const timer = window.setTimeout(() => setHighlightedSurgeryId(null), 2200);
    return () => window.clearTimeout(timer);
  }, [highlightedSurgeryId]);

  const openResultDialogForIndex = (index: number) => {
    const target = medicalTests[index];
    if (!target) return;
    setCompletingTestIndex(index);
    setResultForm({
      result: target.result || "",
      notes: target.notes || "",
    });
    setResultDialogOpen(true);
  };

  const saveResultForTest = async () => {
    if (completingTestIndex === null) return;
    if (!resultForm.result.trim()) return;

    const index = completingTestIndex;
    const target = medicalTests[index];
    if (!target) return;

    try {
      await patchMedicalTestLifecycle({
        test_name: target.test_name,
        test_date: target.test_date,
        prescribing_doctor: target.prescribing_doctor,
        hospital_lab: target.hospital_lab,
        result: resultForm.result.trim(),
        notes: resultForm.notes.trim(),
        status: "completed",
      });
      const next = upsertLocalMedicalTest({
        ...target,
        result: resultForm.result.trim(),
        notes: resultForm.notes.trim(),
        status: "completed",
      });
      setResultDialogOpen(false);
      setCompletingTestIndex(null);
      setResultForm({ result: "", notes: "" });
      setTestFilter("completed");
      setTestSourceFilter(deriveTestSource(target));
      const updatedIndex = next.findIndex(
        (entry) =>
          normalizeTestValue(entry.test_name) === normalizeTestValue(target.test_name) &&
          normalizeTestValue(entry.test_date) === normalizeTestValue(target.test_date),
      );
      if (updatedIndex >= 0) {
        setHighlightedTestId(
          `patient-${updatedIndex}-${normalizeTestValue(target.test_name)}-${normalizeTestValue(target.test_date)}`,
        );
      }
      setTestActionError(null);
      setTestActionMessage(tCommon("medicalHistory.labTests.messages.completed"));
    } catch (error) {
      console.error("Failed to persist completed test", error);
      setTestActionMessage(null);
      setTestActionError(tCommon("medicalHistory.labTests.messages.completeFailed"));
    }
  };

  const saveNewTest = () => {
    if (!addTestForm.test_name.trim()) return;
    if (isDuplicatePendingTest(addTestForm.test_name, addTestForm.test_date)) {
      setTestActionMessage(null);
      setTestActionError(tCommon("medicalHistory.labTests.messages.duplicatePending"));
      return;
    }
    setMedicalTests([{ ...addTestForm, result: "" }, ...medicalTests]);
    setTestFilter("pending");
    setTestSourceFilter("all");
    setHighlightedTestId(
      `patient-0-${normalizeTestValue(addTestForm.test_name)}-${normalizeTestValue(addTestForm.test_date)}`,
    );
    setTestActionError(null);
    setTestActionMessage(tCommon("medicalHistory.labTests.messages.added"));
    setAddTestDialogOpen(false);
    setAddTestForm({
      test_name: "",
      test_id: undefined,
      test_date: new Date().toISOString().slice(0, 10),
      result: "",
      status: "pending",
      prescribing_doctor: "",
      hospital_lab: "",
      notes: "",
    });
  };

  const skipTest = async (payload: { index?: number }) => {
    if (typeof payload.index !== "number") return;
    const current = medicalTests[payload.index];
    if (!current) return;

    const nextItem: MedicalTest = {
      ...current,
      status: "skipped",
      result: "",
      notes: current.notes || "",
    };

    try {
      await patchMedicalTestLifecycle({
        test_name: nextItem.test_name,
        test_date: nextItem.test_date,
        prescribing_doctor: nextItem.prescribing_doctor,
        hospital_lab: nextItem.hospital_lab,
        notes: nextItem.notes,
        status: "skipped",
      });
      upsertLocalMedicalTest(nextItem);
      setTestFilter("all");
      setTestSourceFilter("all");
      setTestActionError(null);
      setTestActionMessage(tCommon("medicalHistory.labTests.messages.skipped"));
    } catch (error) {
      console.error("Failed to skip test", error);
      setTestActionMessage(null);
      setTestActionError(tCommon("medicalHistory.labTests.messages.skipFailed"));
    }
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto py-6 sm:py-8 pt-[var(--nav-content-offset)] max-w-6xl">
          <PageLoadingShell label={tCommon("medicalHistory.loading")} cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  const firstName = String(patientData?.first_name ?? patientData?.firstName ?? tCommon("patientHome.defaultUserName"));
  const lastName = String(patientData?.last_name ?? patientData?.lastName ?? "");
  const patientName = `${firstName} ${lastName}`.trim();
  const age = calculateAge(
    typeof patientData?.date_of_birth === "string"
      ? patientData.date_of_birth
      : typeof patientData?.dob === "string"
        ? patientData.dob
        : undefined,
  );
  const patientId = formatPatientId(
    typeof patientData?.id === "string"
      ? patientData.id
      : typeof patientData?.patient_id === "string"
        ? patientData.patient_id
        : typeof patientData?.profile_id === "string"
          ? patientData.profile_id
          : undefined,
  );

  const medicationCardLabels = {
    expiredOn: tCommon("medicalHistory.medications.labels.expiredOn"),
    expiresOn: tCommon("medicalHistory.medications.labels.expiresOn"),
    expired: tCommon("medicalHistory.medications.labels.expired"),
    current: tCommon("medicalHistory.medications.labels.current"),
    dosageSchedule: tCommon("medicalHistory.medications.labels.dosageSchedule"),
    duration: tCommon("medicalHistory.medications.labels.duration"),
    meal: tCommon("medicalHistory.medications.labels.meal"),
    startDate: tCommon("medicalHistory.medications.labels.startDate"),
  };

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />
      <main className="container mx-auto py-6 sm:py-8 pt-[var(--nav-content-offset)] max-w-6xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8 space-y-4">
          <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/20">
            {tCommon("medicalHistory.header.activeProfile")}
          </Badge>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">
                {tCommon("medicalHistory.header.title")}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
                {patientName}
                {age !== null ? ` | ${age} ${tCommon("medicalHistory.header.years")}` : ""}
                {patientId !== "N/A" ? ` | ${tCommon("medicalHistory.header.idPrefix")}: ${patientId}` : ""}
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
                <span className="sm:inline">{tCommon("medicalHistory.actions.exportReport")}</span>
              </Button>
              <Button
                onClick={() => setActiveTab("medications")}
                size="sm"
                className="w-full sm:w-auto touch-target"
              >
                {tCommon("medicalHistory.actions.newEntry")}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 flex h-auto w-full gap-2 overflow-x-auto p-1 bg-muted/30 no-scrollbar">
            <TabsTrigger value="timeline" className="h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.timeline")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.timelineShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="medications" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.medications.tabActiveState}`}>
              <Pill className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.medications.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.medications")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.medicationsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="tests" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.tests.tabActiveState}`}>
              <FlaskConical className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.tests.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.labTests")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.labTestsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="surgeries" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.surgeries.tabActiveState}`}>
              <Syringe className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.surgeries.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.surgeries")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.surgeriesShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="hospitalizations" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.hospitalizations.tabActiveState}`}>
              <Hospital className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.hospitalizations.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.hospitalizations")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.hospitalizationsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="vaccinations" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.vaccinations.tabActiveState}`}>
              <Shield className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.vaccinations.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.vaccinations")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.vaccinationsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="visits" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.visits.tabActiveState}`}>
              <CheckCircle2 className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.visits.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.visits")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.visitsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className={`h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm ${MEDICAL_MODULE_TAB_ACCENTS.reports.tabActiveState}`}>
              <FileText className={`h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 ${MEDICAL_MODULE_TAB_ACCENTS.reports.tabIconText}`} />
              <span className="hidden sm:inline">{tCommon("medicalHistory.tabs.labReports")}</span>
              <span className="sm:hidden">{tCommon("medicalHistory.tabs.reportsShort")}</span>
            </TabsTrigger>
            <TabsTrigger value="doctors" className="h-11 shrink-0 whitespace-nowrap px-3 text-xs data-[state=active]:bg-background sm:text-sm">
              <UserRound className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Previously Visited Doctors</span>
              <span className="sm:hidden">Doctors</span>
            </TabsTrigger>
          </TabsList>

          {/* Medications Tab */}
          <TabsContent value="medications" className="mt-0 space-y-6">
            {activeTab === "medications" ? (
              <>
            {/* Doctor Prescribed Medications */}
            {doctorMedsPrescriptions.length > 0 && (
              <Card className="border-primary/30 dark:border-primary/50">
                <CardHeader className="bg-linear-to-r from-primary/5 to-transparent dark:from-primary/10">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Pill className="h-5 w-5 text-primary" />
                    {tCommon("medicalHistory.medications.doctorPrescribedTitle")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {tCommon("medicalHistory.medications.doctorPrescribedSubtitle")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4 flex justify-end">
                    <select
                      value={doctorMedicationFilter}
                      onChange={(event) => setDoctorMedicationFilter(event.target.value as "active" | "expired" | "all")}
                      className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="active">{tCommon("medicalHistory.medications.filters.active")}</option>
                      <option value="expired">{tCommon("medicalHistory.medications.filters.expired")}</option>
                      <option value="all">{tCommon("medicalHistory.medications.filters.all")}</option>
                    </select>
                  </div>
                  <div className="scrollbar-themed max-h-[600px] overflow-y-auto pr-1 space-y-4">
                    {doctorMedsPagination.pageItems.map((prescription) => {
                        const visibleDoctorMeds = prescription.medications.filter((med) => {
                          const duration = med.duration_value ? `${med.duration_value} ${med.duration_unit}` : "";
                          const startedDate = med.start_date || prescription.accepted_at || prescription.created_at;
                          const expired = isMedicationExpired({
                            started_date: startedDate,
                            duration,
                            dose_evening: Boolean(med.dose_evening),
                            dose_night: Boolean(med.dose_night),
                          });
                          if (doctorMedicationFilter === "active") return !expired;
                          if (doctorMedicationFilter === "expired") return expired;
                          return true;
                        });

                        if (visibleDoctorMeds.length === 0) return null;

                        return (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{tCommon("medicalHistory.common.doctorPrefix")} {prescription.doctor_name}</span>
                            <span>|</span>
                            <span>{new Date(prescription.created_at).toLocaleDateString()}</span>
                          </div>
                          {visibleDoctorMeds.map((med: MedicationPrescription) => (
                            (() => {
                              const duration = med.duration_value ? `${med.duration_value} ${med.duration_unit}` : "";
                              const startedDate = med.start_date || prescription.accepted_at || prescription.created_at;
                              const expired = isMedicationExpired({
                                started_date: startedDate,
                                duration,
                                dose_evening: Boolean(med.dose_evening),
                                dose_night: Boolean(med.dose_night),
                              });
                              if (doctorMedicationFilter === "active" && expired) return null;
                              if (doctorMedicationFilter === "expired" && !expired) return null;
                              const expiryDate = computeExpiryDate(startedDate, duration);
                              const alreadyAdded = medications.some((existing) => {
                                const nameMatch =
                                  normalizeMedicationKey(existing.display_name) === normalizeMedicationKey(med.medicine_name);
                                if (!nameMatch) return false;
                                if (isMedicationInactive(existing)) return false;
                                const doctorMatch =
                                  !existing.prescribing_doctor ||
                                  normalizeMedicationKey(existing.prescribing_doctor) === normalizeMedicationKey(prescription.doctor_name);
                                return doctorMatch;
                              });
                              return (
                            <MedicationEntryCard
                              key={med.id}
                              title={med.medicine_name}
                              genericName={med.generic_name || undefined}
                              strengthOrType={med.strength || med.medicine_type || undefined}
                              schedule={formatDoseScheduleSummary({
                                dose_morning: Boolean(med.dose_morning),
                                dose_afternoon: Boolean(med.dose_afternoon),
                                dose_evening: false,
                                dose_night: Boolean(med.dose_night || med.dose_evening),
                                dose_morning_amount: med.dose_morning_amount || "1",
                                dose_afternoon_amount: med.dose_afternoon_amount || "1",
                                dose_evening_amount: "1",
                                dose_night_amount: med.dose_night_amount || med.dose_evening_amount || "1",
                              })}
                              duration={duration}
                              mealInstruction={humanizeMealInstruction(med.meal_instruction || "any_time")}
                              startedDate={String(startedDate).slice(0, 10)}
                              expiryDate={expiryDate}
                              inactiveDate={expired ? expiryDate : null}
                              labels={medicationCardLabels}
                              actionSlot={!expired ? (
                                <div className="flex flex-wrap gap-2">
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
                                          evening: false,
                                          night: med.dose_night || med.dose_evening,
                                        }
                                      });
                                      setReminderDialogOpen(true);
                                    }}
                                  >
                                    <Bell className="h-4 w-4" />
                                    {tCommon("medicalHistory.actions.setReminder")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    title={alreadyAdded ? tCommon("medicalHistory.medications.actions.alreadyActiveHint") : undefined}
                                    disabled={alreadyAdded}
                                    onClick={() => {
                                      const nextMedication = buildMedicationFromDoctorPrescription(
                                        med,
                                        prescription.doctor_name || undefined,
                                      );
                                      handleMedicationUpdate([nextMedication, ...medications]);
                                    }}
                                  >
                                    {alreadyAdded
                                      ? tCommon("medicalHistory.medications.actions.alreadyAdded")
                                      : tCommon("medicalHistory.medications.actions.addMedication")}
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openRenewMedicationDialog(med, prescription.doctor_name || undefined)}
                                >
                                  {tCommon("medicalHistory.medications.actions.renewMedication")}
                                </Button>
                              )}
                            />
                              );
                            })()
                          ))}
                        </div>
                      )})}
                  </div>
                  <PaginationControls
                    currentPage={doctorMedsPagination.currentPage}
                    totalPages={doctorMedsPagination.totalPages}
                    totalItems={doctorMedsPagination.totalItems}
                    startIndex={doctorMedsPagination.startIndex}
                    endIndex={doctorMedsPagination.endIndex}
                    itemLabel={tCommon("medicalHistory.medications.pagination.prescriptions")}
                    onPrev={doctorMedsPagination.goToPrevPage}
                    onNext={doctorMedsPagination.goToNextPage}
                  />
                </CardContent>
              </Card>
            )}

            {/* Self-Reported Medications */}
            <Card>
              <CardHeader className="bg-linear-to-r from-primary/5 to-transparent dark:from-primary/10">
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Pill className="h-5 w-5 text-primary" />
                  {tCommon("medicalHistory.medications.myMedications")}
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  {tCommon("medicalHistory.medications.myMedicationsSubtitle")}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <select
                    value={myMedicationFilter}
                    onChange={(event) => setMyMedicationFilter(event.target.value as "active" | "expired" | "all")}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="active">{tCommon("medicalHistory.medications.filters.active")}</option>
                    <option value="expired">{tCommon("medicalHistory.medications.filters.expired")}</option>
                    <option value="all">{tCommon("medicalHistory.medications.filters.all")}</option>
                  </select>
                  <Button size="sm" onClick={() => setAddMedicationDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {tCommon("medicalHistory.medications.actions.addMedication")}
                  </Button>
                </div>
                <div className="space-y-3">
                  {visibleMyMedications.length > 0 ? (
                    visibleMyMedications.map((medication) => {
                      const inactive = isMedicationInactive(medication);
                      const computedExpiryDate = computeExpiryDate(medication.started_date, medication.duration);
                      const inactiveDate = medication.stopped_date || (inactive ? computedExpiryDate : null);

                      return (
                        <MedicationEntryCard
                          key={medication.id}
                          title={medication.display_name}
                          genericName={medication.generic_name}
                          strengthOrType={medication.strength || medication.dosage_form}
                          schedule={formatDoseScheduleSummary(medication)}
                          duration={medication.duration}
                          mealInstruction={humanizeMealInstruction(medication.meal_instruction || "any_time")}
                          startedDate={medication.started_date}
                          expiryDate={computedExpiryDate}
                          inactiveDate={inactiveDate}
                          labels={medicationCardLabels}
                          actionSlot={
                            <div className="flex flex-wrap gap-2">
                              {!inactive ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2 text-primary border-primary/30 hover:bg-primary/10"
                                    onClick={() => {
                                      setSelectedMyMedication(medication);
                                      setMyMedicationReminderOpen(true);
                                    }}
                                  >
                                    <Bell className="h-4 w-4" />
                                    {tCommon("medicalHistory.actions.setReminder")}
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => markMedicationExpiredNow(medication)}>
                                    {tCommon("medicalHistory.medications.actions.markCompleted")}
                                  </Button>
                                </>
                              ) : (
                                <Button size="sm" variant="outline" onClick={() => openRenewMedicationDialog(medication)}>
                                  {tCommon("medicalHistory.medications.actions.renewMedication")}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => handleMedicationUpdate(medications.filter((item) => item.id !== medication.id))}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {tCommon("medicalHistory.medications.actions.delete")}
                              </Button>
                            </div>
                          }
                        />
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Pill className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p>{tCommon("medicalHistory.medications.emptyFiltered")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
              </>
            ) : null}
          </TabsContent>

          {/* Lab Tests Tab */}
          <TabsContent value="tests" className="mt-0 space-y-6">
            {activeTab === "tests" ? (
              <>
            <Card className="border-purple-200 dark:border-purple-800 shadow-sm">
              <CardHeader className="bg-linear-to-r from-purple-50 to-card dark:from-purple-950/30 dark:to-card border-b border-purple-100 dark:border-purple-800">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-foreground flex items-center gap-2">
                      <FlaskConical className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      {tCommon("medicalHistory.labTests.title")}
                    </CardTitle>
                    <CardDescription className="text-muted-foreground dark:text-muted-foreground">{tCommon("medicalHistory.labTests.subtitle")}</CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <select
                      value={testFilter}
                      onChange={(event) => setTestFilter(event.target.value as TestFilter)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="pending">Pending / Upcoming</option>
                      <option value="completed">Completed</option>
                      <option value="skipped">Skipped</option>
                      <option value="all">All</option>
                    </select>
                    <select
                      value={testSourceFilter}
                      onChange={(event) => setTestSourceFilter(event.target.value as TestSourceFilter)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">All Sources</option>
                      <option value="doctor">Doctor Prescribed</option>
                      <option value="self">Self Added</option>
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setAddTestDialogOpen(true)}
                      className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {tCommon("medicalHistory.labTests.addTest")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 bg-card dark:bg-card">
                {(() => {
                  const allTests = buildUnifiedTests()
                    .filter((test) => {
                      const status = getTestStatus(test);
                      if (testFilter === "pending") return status === "pending" || status === "overdue";
                      if (testFilter === "completed") return status === "completed";
                      if (testFilter === "skipped") return status === "skipped";
                      return true;
                    })
                    .filter((test) => {
                      if (testSourceFilter === "all") return true;
                      return test.source === testSourceFilter;
                    })
                    .sort((a, b) => {
                      const aDate = new Date(a.test_date || a.created_at || 0).getTime();
                      const bDate = new Date(b.test_date || b.created_at || 0).getTime();

                      if (testFilter === "pending") {
                        const aOverdue = getTestStatus(a) === "overdue";
                        const bOverdue = getTestStatus(b) === "overdue";

                        // Pending view priority:
                        // 1) Upcoming tests first (nearest upcoming date first)
                        // 2) Overdue tests after (most recently missed first)
                        if (aOverdue !== bOverdue) return aOverdue ? 1 : -1;
                        if (aOverdue && bOverdue) return bDate - aDate;
                        return aDate - bDate;
                      }

                      if (testFilter === "completed" || testFilter === "skipped") {
                        return bDate - aDate;
                      }

                      return bDate - aDate;
                    });

                  return allTests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <FlaskConical className="h-8 w-8 text-purple-500 dark:text-purple-400" />
                    </div>
                    <p className="text-foreground dark:text-foreground font-medium">{tCommon("medicalHistory.labTests.emptyTitle")}</p>
                    <p className="text-sm mt-2 text-muted-foreground dark:text-muted-foreground">{tCommon("medicalHistory.labTests.emptyHint")}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(testActionMessage || testActionError) && (
                      <div
                        className={`rounded-md border px-3 py-2 text-sm ${
                          testActionError
                            ? "border-destructive/40 bg-destructive/5 text-destructive"
                            : "border-success/30 bg-success/10 text-success"
                        }`}
                      >
                        {testActionError || testActionMessage}
                      </div>
                    )}
                    {allTests.map((test) => {
                      const status = getTestStatus(test);
                      const overdue = isOverdueTest(test.test_date, test.result);
                      const urgent = String(test.urgency || "").toLowerCase() === "urgent";
                      const alreadyAdded =
                        test.kind === "doctor-prescribed-template" &&
                        medicalTests.some(
                          (existing) =>
                            normalizeTestValue(existing.test_name) === normalizeTestValue(test.test_name) &&
                            normalizeTestValue(existing.test_date) === normalizeTestValue(test.test_date)
                        );
                      const doctorReadyForCompletion = alreadyAdded;

                      return (
                        <div
                          key={test.id}
                          id={`test-card-${test.id}`}
                          className={`rounded-xl border p-4 sm:p-5 ${
                            overdue
                              ? "border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-900/10"
                              : "border-purple-200 bg-linear-to-br from-purple-50/50 to-card dark:border-purple-800 dark:from-purple-950/20 dark:to-card"
                          } ${highlightedTestId === test.id ? "ring-2 ring-primary/50" : ""}`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-foreground">{test.test_name || "Untitled Test"}</h4>
                              <p className="text-sm text-muted-foreground">
                                {test.prescribing_doctor ? `Dr. ${test.prescribing_doctor}` : "--"}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={
                                  test.source === "doctor"
                                    ? "bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700"
                                    : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700"
                                }
                              >
                                {test.sourceLabel}
                              </Badge>
                              {getComputedTestStatusBadge(test)}
                              {urgent && (
                                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                                  <AlertCircle className="mr-1 h-3 w-3" />
                                  Urgent
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                            <div>
                              <span className="text-muted-foreground">Test date</span>
                              <span className="ml-1 font-medium text-foreground">
                                {test.test_date ? new Date(test.test_date).toLocaleDateString() : "--"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Result</span>
                              <span className="ml-1 font-medium text-foreground">{test.result || "--"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Lab</span>
                              <span className="ml-1 font-medium text-foreground">{test.hospital_lab || "--"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Notes</span>
                              <span className="ml-1 font-medium text-foreground">{test.notes || "--"}</span>
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2">
                            {test.kind === "doctor-prescribed-template" ? (
                              <>
                                {!doctorReadyForCompletion && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      if (!normalizeTestValue(test.test_date)) {
                                        setTestActionMessage(null);
                                        setTestActionError("Test date is required before adding this test");
                                        return;
                                      }
                                      try {
                                        await patchMedicalTestLifecycle({
                                          test_name: test.test_name,
                                          test_date: test.test_date,
                                          prescribing_doctor: test.prescribing_doctor,
                                          hospital_lab: test.hospital_lab,
                                          notes: test.notes,
                                          status: "pending",
                                        });
                                        upsertLocalMedicalTest({
                                          test_name: test.test_name || "",
                                          test_id: undefined,
                                          test_date: test.test_date || "",
                                          result: "",
                                          status: "pending",
                                          prescribing_doctor: test.prescribing_doctor || "",
                                          hospital_lab: test.hospital_lab || "",
                                          notes: test.notes || "",
                                        });
                                        setTestFilter("pending");
                                        setTestSourceFilter("doctor");
                                        setHighlightedTestId(test.id);
                                        setTestActionError(null);
                                        setTestActionMessage("Test added to your pending list");
                                      } catch (error) {
                                        console.error("Failed to add doctor test", error);
                                        setTestActionMessage(null);
                                        setTestActionError("Failed to add test. Please try again.");
                                      }
                                    }}
                                  >
                                    Add Test
                                  </Button>
                                )}
                                {doctorReadyForCompletion && (status === "pending" || status === "overdue") && typeof test.index === "number" && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openResultDialogForIndex(test.index!)}
                                    >
                                      Mark as Completed
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => skipTest({ index: test.index })}
                                    >
                                      Skip Test
                                    </Button>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {(status === "pending" || status === "overdue") && typeof test.index === "number" && (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => openResultDialogForIndex(test.index!)}>
                                      Mark as Completed
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => skipTest({ index: test.index })}>
                                      Skip Test
                                    </Button>
                                  </>
                                )}
                                {status === "completed" && typeof test.index === "number" && (
                                  <Button size="sm" variant="outline" onClick={() => openResultDialogForIndex(test.index!)}>
                                    Edit Result
                                  </Button>
                                )}
                                {typeof test.index === "number" && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                    onClick={() => {
                                      setMedicalTests(medicalTests.filter((_, i) => i !== test.index));
                                      setTestActionMessage(null);
                                      setTestActionError(null);
                                    }}
                                  >
                                    <Trash2 className="mr-1 h-4 w-4" />
                                    Delete
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
                })()}
              </CardContent>
            </Card>

            <Dialog
              open={resultDialogOpen}
              onOpenChange={(open) => {
                setResultDialogOpen(open);
                if (!open) {
                  setCompletingTestIndex(null);
                }
              }}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Mark Test as Completed</DialogTitle>
                  <DialogDescription>Completion is saved by entering the test result.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="test-result">Result *</Label>
                    <Input
                      id="test-result"
                      value={resultForm.result}
                      onChange={(event) => setResultForm((prev) => ({ ...prev, result: event.target.value }))}
                      placeholder="e.g., Normal, 120 mg/dL"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="test-notes">Notes (optional)</Label>
                    <Input
                      id="test-notes"
                      value={resultForm.notes}
                      onChange={(event) => setResultForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Additional comments"
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setResultDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveResultForTest} disabled={!resultForm.result.trim()}>
                    Save Result
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={addTestDialogOpen} onOpenChange={setAddTestDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Test</DialogTitle>
                  <DialogDescription>Create a pending lab test entry using existing fields.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="mb-1 block">Test name *</Label>
                    <MedicalTestSearch
                      value={addTestForm.test_name}
                      onChange={(testName, testId) =>
                        setAddTestForm((prev) => ({ ...prev, test_name: testName, test_id: testId }))
                      }
                      placeholder={tCommon("medicalHistory.labTests.searchPlaceholder")}
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-test-date">Test date</Label>
                    <Input
                      id="add-test-date"
                      type="date"
                      value={addTestForm.test_date}
                      onChange={(event) => setAddTestForm((prev) => ({ ...prev, test_date: event.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-test-doctor">Doctor name</Label>
                    <Input
                      id="add-test-doctor"
                      value={addTestForm.prescribing_doctor}
                      onChange={(event) => setAddTestForm((prev) => ({ ...prev, prescribing_doctor: event.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-test-lab">Hospital/Lab</Label>
                    <Input
                      id="add-test-lab"
                      value={addTestForm.hospital_lab}
                      onChange={(event) => setAddTestForm((prev) => ({ ...prev, hospital_lab: event.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="add-test-notes">Notes</Label>
                    <Input
                      id="add-test-notes"
                      value={addTestForm.notes}
                      onChange={(event) => setAddTestForm((prev) => ({ ...prev, notes: event.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddTestDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveNewTest} disabled={!addTestForm.test_name.trim()}>
                    Add Test
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
              </>
            ) : null}
          </TabsContent>

          {/* Surgeries Tab */}
          <TabsContent value="surgeries" className="mt-0 space-y-6">
            {activeTab === "surgeries" ? (
              <>
            {/* Doctor Recommended Surgeries */}
            {doctorSurgeriesPrescriptions.length > 0 && (
              <Card className="border-success/30 dark:border-success/50">
                <CardHeader className="bg-linear-to-r from-success/5 to-transparent dark:from-success/10">
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Syringe className="h-5 w-5 text-success" />
                    {tCommon("medicalHistory.surgeries.doctorRecommendedTitle")}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {tCommon("medicalHistory.surgeries.doctorRecommendedSubtitle")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  {(surgeryActionMessage || surgeryActionError) && (
                    <div
                      className={`mb-4 rounded-md border px-3 py-2 text-sm ${
                        surgeryActionError
                          ? "border-destructive/40 bg-destructive/5 text-destructive"
                          : "border-success/30 bg-success/10 text-success"
                      }`}
                    >
                      {surgeryActionError || surgeryActionMessage}
                    </div>
                  )}
                  <div className="scrollbar-themed max-h-[600px] overflow-y-auto pr-1 space-y-4">
                    {doctorSurgeriesPagination.pageItems.map(prescription => (
                        <div key={prescription.id} className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">Dr. {prescription.doctor_name}</span>
                            <span>|</span>
                            <span>{new Date(prescription.created_at).toLocaleDateString()}</span>
                          </div>
                          {prescription.surgeries.map((surgery: SurgeryRecommendation) => {
                            const linkedIndex = findSurgeryIndex(surgery.procedure_name, surgery.recommended_date);
                            const alreadyAdded = linkedIndex >= 0;
                            const linkedStatus = getSurgeryStatus(linkedIndex >= 0 ? surgeries[linkedIndex] : undefined);

                            return (
                              <div key={surgery.id} className="p-4 rounded-lg bg-success/5 dark:bg-success/10 border border-success/20">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                  <div>
                                    <h4 className="font-semibold text-foreground">{surgery.procedure_name}</h4>
                                    {surgery.procedure_type && (
                                      <p className="text-sm text-muted-foreground">{surgery.procedure_type}</p>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className={`w-fit ${surgery.urgency === "immediate" ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400" : "bg-success/20 text-success border-success/30"}`}>
                                      {surgery.urgency}
                                    </Badge>
                                    {alreadyAdded && (
                                      <Badge
                                        variant="outline"
                                        className={
                                          linkedStatus === "completed"
                                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                                            : linkedStatus === "skipped"
                                              ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700"
                                              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                                        }
                                      >
                                        {linkedStatus === "completed" ? "Completed" : linkedStatus === "skipped" ? "Skipped" : "Pending"}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                {surgery.reason && (
                                  <p className="mt-2 text-sm text-muted-foreground">{tCommon("medicalHistory.surgeries.reasonLabel")} {surgery.reason}</p>
                                )}
                                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  {surgery.preferred_facility && (
                                    <div>
                                      <span className="text-muted-foreground">{tCommon("medicalHistory.fields.facility")}</span>
                                      <span className="ml-1 font-medium text-foreground">{surgery.preferred_facility}</span>
                                    </div>
                                  )}
                                  {surgery.recommended_date && (
                                    <div>
                                      <span className="text-muted-foreground">{tCommon("medicalHistory.fields.recommendedDate")}</span>
                                      <span className="ml-1 font-medium text-foreground">{new Date(surgery.recommended_date).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                  {surgery.estimated_cost_min && surgery.estimated_cost_max && (
                                    <div>
                                      <span className="text-muted-foreground">{tCommon("medicalHistory.fields.estimatedCost")}</span>
                                      <span className="ml-1 font-medium text-foreground">BDT {surgery.estimated_cost_min.toLocaleString()} - BDT {surgery.estimated_cost_max.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                                {surgery.pre_op_instructions && (
                                  <p className="mt-2 text-sm text-muted-foreground italic">{tCommon("medicalHistory.surgeries.preOpLabel")} {surgery.pre_op_instructions}</p>
                                )}
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {!alreadyAdded && (
                                    <Button size="sm" variant="outline" onClick={() => addDoctorSurgery(prescription, surgery)}>
                                      Add Surgery
                                    </Button>
                                  )}
                                  {alreadyAdded && linkedStatus === "pending" && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          updateSurgeryStatus(
                                            linkedIndex,
                                            "completed",
                                            "Surgery marked as completed",
                                            "Failed to mark surgery as completed. Please try again.",
                                          )
                                        }
                                      >
                                        Mark as Completed
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                          updateSurgeryStatus(
                                            linkedIndex,
                                            "skipped",
                                            "Surgery marked as skipped",
                                            "Failed to skip surgery. Please try again.",
                                          )
                                        }
                                      >
                                        Skip Surgery
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                  </div>
                  <PaginationControls
                    currentPage={doctorSurgeriesPagination.currentPage}
                    totalPages={doctorSurgeriesPagination.totalPages}
                    totalItems={doctorSurgeriesPagination.totalItems}
                    startIndex={doctorSurgeriesPagination.startIndex}
                    endIndex={doctorSurgeriesPagination.endIndex}
                    itemLabel="prescriptions"
                    onPrev={doctorSurgeriesPagination.goToPrevPage}
                    onNext={doctorSurgeriesPagination.goToNextPage}
                  />
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4 sm:p-6">
                <SurgeryManager
                  surgeries={surgeries}
                  onUpdate={handleSurgeryUpdate}
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
                <CardTitle>{tCommon("medicalHistory.visits.title")}</CardTitle>
                <CardDescription>{tCommon("medicalHistory.visits.subtitle")}</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6">
                {appointments.length > 0 ? (
                  <div className="scrollbar-themed max-h-[600px] overflow-y-auto pr-1 space-y-4">
                    {appointmentsPagination.pageItems.map((app, i) => (
                      <div key={i} className="flex flex-col justify-between gap-4 rounded-lg border bg-surface/30 p-4 md:flex-row md:items-center">
                        <div>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                             <Calendar className="h-4 w-4 text-primary" />
                             <span className="font-semibold text-primary">{new Date(app.appointment_date as string).toLocaleDateString()}</span>
                              <span className="text-muted-foreground text-sm">{formatMeridiemTime(app.appointment_date as string)}</span>
                          </div>
                          <div className="text-lg font-semibold">
                            {app.doctor_title ? `${app.doctor_title as string} ` : 'Dr.'}{(app.doctor_name as string) || (app.doctor as string) || 'Doctor'}
                          </div>

                          <div className="text-sm text-muted-foreground mt-0.5">
                            {(() => {
                              const { consultationType, appointmentType } = parseCompositeReason(app.reason as string | null | undefined)
                              const ct = humanizeConsultationType(consultationType)
                              const at = humanizeAppointmentType(appointmentType)
                              return <>{ct}{at ? ` | ${at}` : ''}</>
                            })()}
                          </div>

                          {typeof app.notes === 'string' && <div className="mt-2 max-w-xl text-sm text-muted-foreground break-words">{app.notes}</div>}
                        </div>
                        <div className="flex items-center gap-2 self-start md:self-center">
                           <Badge variant={(app.status as string) === 'COMPLETED' ? 'default' : (app.status as string) === 'CONFIRMED' ? 'outline' : 'secondary'}>
                             {(app.status as string) || 'Unknown'}
                           </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>{tCommon("medicalHistory.visits.empty")}</p>
                  </div>
                )}
                <PaginationControls
                  currentPage={appointmentsPagination.currentPage}
                  totalPages={appointmentsPagination.totalPages}
                  totalItems={appointmentsPagination.totalItems}
                  startIndex={appointmentsPagination.startIndex}
                  endIndex={appointmentsPagination.endIndex}
                  itemLabel="visits"
                  onPrev={appointmentsPagination.goToPrevPage}
                  onNext={appointmentsPagination.goToNextPage}
                />
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
                    <div className="space-y-4 py-6">
                      <div className="flex items-center justify-center">
                        <MedoraLoader size="md" label="Loading report details..." />
                      </div>
                      <CardSkeleton />
                    </div>
                  ) : reportDetailError ? (
                    <Card className="border-destructive/50 bg-destructive/10">
                      <CardContent className="p-6 text-center text-destructive">
                        {reportDetailError}
                        <Button variant="outline" size="sm" className="ml-4" onClick={() => loadReportDetail(selectedReportId)}>
                          {tCommon("medicalHistory.actions.retry")}
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <h2 className="text-xl sm:text-2xl font-bold text-foreground">
                            {selectedReport.file_name || tCommon("medicalHistory.reports.labReportFallback")}
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
                            <p className="text-xs text-muted-foreground">{tCommon("medicalHistory.reports.testsFound")}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                            <p className="text-2xl font-bold">{selectedReport.results.filter((r) => r.status === "normal").length}</p>
                            <p className="text-xs text-muted-foreground">{tCommon("medicalHistory.reports.normal")}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" />
                            <p className="text-2xl font-bold">{selectedReport.results.filter((r) => r.status === "high" || r.status === "low").length}</p>
                            <p className="text-xs text-muted-foreground">{tCommon("medicalHistory.reports.abnormal")}</p>
                          </CardContent>
                        </Card>
                        <Card className="rounded-xl">
                          <CardContent className="p-4 text-center">
                            <MessageSquare className="h-6 w-6 mx-auto mb-1 text-blue-500" />
                            <p className="text-2xl font-bold">{selectedReport.comments.length}</p>
                            <p className="text-xs text-muted-foreground">{tCommon("medicalHistory.reports.comments")}</p>
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
                              <p>{tCommon("medicalHistory.reports.noExtractedResults")}</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b text-left text-muted-foreground">
                                    <th className="pb-3 pr-4 font-medium">{tCommon("medicalHistory.table.testName")}</th>
                                    <th className="pb-3 pr-4 font-medium">{tCommon("medicalHistory.table.value")}</th>
                                    <th className="pb-3 pr-4 font-medium">{tCommon("medicalHistory.table.unit")}</th>
                                    <th className="pb-3 pr-4 font-medium">{tCommon("medicalHistory.table.referenceRange")}</th>
                                    <th className="pb-3 font-medium">{tCommon("medicalHistory.table.status")}</th>
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
                              {tCommon("medicalHistory.reports.doctorNotes")}
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
                      <h2 className="text-lg sm:text-xl font-semibold text-foreground">{tCommon("medicalHistory.reports.listTitle")}</h2>
                    </div>
                    <Button onClick={() => setShowUpload(!showUpload)} className="gap-2" size="sm">
                      <Upload className="h-4 w-4" />
                      {tCommon("medicalHistory.reports.uploadReport")}
                    </Button>
                  </div>

                  {/* Upload Section */}
                  {showUpload && (
                    <Card className="rounded-xl border-primary/20">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Upload className="h-5 w-5 text-primary" />
                          {tCommon("medicalHistory.reports.uploadLabReport")}
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
                              <p className="text-muted-foreground">{tCommon("medicalHistory.reports.dropzoneHint")}</p>
                              <p className="text-xs text-muted-foreground">{tCommon("medicalHistory.reports.dropzoneFormats")}</p>
                            </div>
                          )}
                        </div>
                        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={handleFileSelect} />

                        <div className="space-y-2">
                          <Label>{tCommon("medicalHistory.reports.reportDateOptional")}</Label>
                          <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} className="max-w-xs rounded-lg" />
                        </div>

                        {uploadError && (
                          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{uploadError}</div>
                        )}

                        <div className="flex gap-3">
                          <Button onClick={handleReportUpload} disabled={!selectedFile || uploading} className="gap-2">
                            {uploading && <ButtonLoader className="h-4 w-4" />}
                            {uploading ? tCommon("medicalHistory.reports.processing") : tCommon("medicalHistory.reports.uploadExtract")}
                          </Button>
                          <Button variant="outline" onClick={() => { setShowUpload(false); clearFile(); }}>{tCommon("medicalHistory.actions.cancel")}</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Error */}
                  {reportsError && (
                    <Card className="border-destructive/50 bg-destructive/10">
                      <CardContent className="p-6 text-center text-destructive">
                        {reportsError}
                        <Button variant="outline" size="sm" className="ml-4" onClick={loadReports}>{tCommon("medicalHistory.actions.retry")}</Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Loading */}
                  {reportsLoading ? (
                    <div className="space-y-4 py-6">
                      <div className="flex items-center justify-center">
                        <MedoraLoader size="md" label={tCommon("medicalHistory.reports.loading")} />
                      </div>
                      <CardSkeleton />
                      <CardSkeleton />
                    </div>
                  ) : reports.length === 0 ? (
                    <Card className="text-center py-12">
                      <CardContent>
                        <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="text-muted-foreground mb-2">{tCommon("medicalHistory.reports.emptyTitle")}</p>
                        <p className="text-sm text-muted-foreground">{tCommon("medicalHistory.reports.emptySubtitle")}</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="scrollbar-themed max-h-[700px] overflow-y-auto pr-1 grid gap-4">
                      {reportsPagination.pageItems.map((report) => (
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
                                    <h3 className="font-medium text-foreground truncate">{report.file_name || tCommon("medicalHistory.reports.labReportFallback")}</h3>
                                    {report.parsed ? (
                                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                        <CheckCircle2 className="h-3 w-3 mr-1" />{tCommon("medicalHistory.reports.processed")}
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
                  <PaginationControls
                    currentPage={reportsPagination.currentPage}
                    totalPages={reportsPagination.totalPages}
                    totalItems={reportsPagination.totalItems}
                    startIndex={reportsPagination.startIndex}
                    endIndex={reportsPagination.endIndex}
                    itemLabel="reports"
                    onPrev={reportsPagination.goToPrevPage}
                    onNext={reportsPagination.goToNextPage}
                  />
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
                    title={tCommon("medicalHistory.timeline.title")}
                    description={tCommon("medicalHistory.timeline.subtitle")}
                  />
                </div>

                {/* Right Column - Analytics (4 cols) */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                  {/* Condition Distribution Chart */}
                  {patientData && <ConditionDistributionChart patientData={patientData} />}

                  {/* Prescription History Chart */}
                  <PrescriptionHistoryChart
                    medications={medications}
                    doctorPrescriptions={doctorPrescriptions}
                  />

                  {/* Vitals Summary */}
                  {patientData && (
                    <VitalsSummaryCard
                      patientData={patientData}
                      medicalTests={medicalTests}
                    />
                  )}
                </div>
              </div>
            ) : null}
          </TabsContent>

          {/* Previously Visited Doctors Tab */}
          <TabsContent value="doctors" className="mt-0 space-y-6">
            {activeTab === "doctors" ? <PreviouslyVisitedDoctorsTab /> : null}
          </TabsContent>
        </Tabs>

        <AddMedicationDialog
          open={addMedicationDialogOpen}
          onOpenChange={setAddMedicationDialogOpen}
          onAdd={(medication) => handleMedicationUpdate([medication, ...medications])}
        />

        {selectedMyMedication && (
          <ReminderDialog
            open={myMedicationReminderOpen}
            onOpenChange={(open) => {
              setMyMedicationReminderOpen(open);
              if (!open) setSelectedMyMedication(null);
            }}
            itemName={selectedMyMedication.display_name}
            itemId={selectedMyMedication.drug_id || undefined}
            type="medication"
          />
        )}

        <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Renew Medication</DialogTitle>
              <DialogDescription>Enter new duration</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="renew-duration-days">Duration (days)</Label>
              <Input
                id="renew-duration-days"
                placeholder="e.g. 7 days"
                inputMode="numeric"
                pattern="[0-9]*"
                value={renewDurationDays}
                onChange={(event) => {
                  const nextValue = event.target.value.replace(/[^\d]/g, "");
                  setRenewDurationDays(nextValue);
                }}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRenewDialogOpen(false);
                  setRenewTarget(null);
                  setRenewDurationDays("");
                }}
              >
                Cancel
              </Button>
              <Button onClick={confirmRenewMedication} disabled={!renewDurationDays || Number(renewDurationDays) <= 0}>
                Renew
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Success Dialog */}
        <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
                <DialogTitle>{tCommon("medicalHistory.dialogs.successTitle")}</DialogTitle>
              </div>
              <DialogDescription>
                {tCommon("medicalHistory.dialogs.successDescription")}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setSuccessDialogOpen(false)}>
                {tCommon("medicalHistory.actions.ok")}
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
                <DialogTitle>{tCommon("medicalHistory.dialogs.errorTitle")}</DialogTitle>
              </div>
              <DialogDescription>
                {errorMessage}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setErrorDialogOpen(false)} className="touch-target">
                {tCommon("medicalHistory.actions.ok")}
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
  const tCommon = useT("common");
  return (
    <Suspense fallback={
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto py-6 sm:py-8 pt-[var(--nav-content-offset)] max-w-6xl">
          <PageLoadingShell label={tCommon("medicalHistory.loading")} cardCount={4} />
        </main>
      </AppBackground>
    }>
      <PatientMedicalHistoryPage />
    </Suspense>
  );
}




