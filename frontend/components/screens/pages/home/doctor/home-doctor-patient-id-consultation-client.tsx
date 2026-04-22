"use client";

import React from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MedicationForm, TestForm, SurgeryForm, PrescriptionReview } from "@/components/prescription";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import {
  startConsultation,
  getConsultation,
  getConsultationDraft,
  getConsultationDraftById,
  saveConsultationDraft,
  saveConsultationDraftById,
  completeConsultation,
  addPrescription,
  getDoctorActiveConsultations,
  getFullPrescriptionByConsultation,
  Consultation,
  ConsultationDraftPayload,
  ConsultationDraftUpdateInput,
  MedicationPrescriptionInput,
  TestPrescriptionInput,
  SurgeryRecommendationInput,
  PrescriptionType,
} from "@/lib/prescription-actions";
import { buildClinicalPrescriptionDocumentHtml } from "@/lib/clinical-prescription-document";
import { extractPrescriptionFromImage } from "@/lib/file-storage-actions";
import { getPatientForDoctor } from "@/lib/patient-access-actions";
import {
  User,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  Scissors,
  CheckCircle2,
  ArrowLeft,
  Send,
  Save,
  AlertCircle,
  Sparkles,
  Printer,
  Camera,
} from "lucide-react";
import { handleUnauthorized } from "@/lib/auth-utils";

interface PatientInfo {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  profile_photo_url?: string;
  date_of_birth?: string;
  gender?: string;
  blood_group?: string;
}

interface OcrDetectedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  quantity?: string;
}

function normalizeConsultationId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  if (lowered === "undefined" || lowered === "null") {
    return null;
  }

  return trimmed;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function isAuthErrorMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("invalid or expired token")
    || normalized.includes("authentication required")
    || normalized.includes("not authenticated")
    || normalized.includes("unauthorized")
  );
}

function parseIsoDateToTimestamp(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function selectActiveConsultationForPatient(
  consultations: Consultation[],
  patientId: string
): Consultation | null {
  const matching = consultations.filter(
    (consultationItem) => consultationItem.patient_ref === patientId || consultationItem.patient_id === patientId
  );
  if (matching.length === 0) return null;

  const sorted = [...matching].sort((a, b) => {
    const draftPriority = Number(Boolean(b.draft_id)) - Number(Boolean(a.draft_id));
    if (draftPriority !== 0) {
      return draftPriority;
    }

    const updatedDelta = parseIsoDateToTimestamp(b.created_at) - parseIsoDateToTimestamp(a.created_at);
    if (updatedDelta !== 0) {
      return updatedDelta;
    }

    return parseIsoDateToTimestamp(b.consultation_date) - parseIsoDateToTimestamp(a.consultation_date);
  });

  return sorted[0] ?? null;
}

export default function ConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = params.id as string;
  const requestedConsultationId = React.useMemo(
    () => normalizeConsultationId(searchParams.get("consultation_id")),
    [searchParams]
  );

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [autosavingDraft, setAutosavingDraft] = React.useState(false);
  const [requiresManualSave, setRequiresManualSave] = React.useState(false);

  const [patient, setPatient] = React.useState<PatientInfo | null>(null);
  const [consultation, setConsultation] = React.useState<Consultation | null>(null);
  const [consultationDraftId, setConsultationDraftId] = React.useState<string | null>(null);

  const [chiefComplaint, setChiefComplaint] = React.useState("");
  const [diagnosis, setDiagnosis] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const [prescriptionType, setPrescriptionType] = React.useState<PrescriptionType>("medication");

  const [medications, setMedications] = React.useState<MedicationPrescriptionInput[]>([]);
  const [tests, setTests] = React.useState<TestPrescriptionInput[]>([]);
  const [surgeries, setSurgeries] = React.useState<SurgeryRecommendationInput[]>([]);
  const [prescriptionNotes, setPrescriptionNotes] = React.useState("");
  const [ocrImporting, setOcrImporting] = React.useState(false);
  const [ocrError, setOcrError] = React.useState<string | null>(null);
  const ocrInputRef = React.useRef<HTMLInputElement | null>(null);
  const ocrCameraInputRef = React.useRef<HTMLInputElement | null>(null);
  const [ocrAttachmentPreviewUrl, setOcrAttachmentPreviewUrl] = React.useState<string | null>(null);
  const [ocrAttachmentName, setOcrAttachmentName] = React.useState<string>("");
  const [ocrAttachmentKind, setOcrAttachmentKind] = React.useState<"image" | "pdf" | null>(null);
  const [ocrDetectedMedicines, setOcrDetectedMedicines] = React.useState<OcrDetectedMedication[]>([]);
  const isHydratingDraftRef = React.useRef(false);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedDraftHashRef = React.useRef<string>("");
  const persistDraftInFlightRef = React.useRef(false);
  const lastDraftHydrationAtRef = React.useRef(0);

  const handleAuthError = React.useCallback((error: unknown): boolean => {
    const message = getErrorMessage(error, "");
    if (!isAuthErrorMessage(message)) {
      return false;
    }

    setError("Session expired. Redirecting to login...");
    handleUnauthorized();
    return true;
  }, []);

  const parseDoseSchedule = React.useCallback((frequencyText: string | undefined) => {
    const normalized = (frequencyText || "").trim().toLowerCase();
    const pattern = normalized.match(/(\d+(?:\/\d+)?)\s*[+\-]\s*(\d+(?:\/\d+)?)\s*[+\-]\s*(\d+(?:\/\d+)?)/);
    if (pattern) {
      return {
        morning: Number(pattern[1] || "0") > 0,
        noon: Number(pattern[2] || "0") > 0,
        night: Number(pattern[3] || "0") > 0,
      };
    }
    return { morning: true, noon: false, night: false };
  }, []);

  const normalizeMedicationForDraft = React.useCallback(
    (medication: MedicationPrescriptionInput): MedicationPrescriptionInput => {
      const dosageType = medication.dosage_type || "pattern";

      if (dosageType === "frequency") {
        return {
          ...medication,
          dosage_type: "frequency",
          dosage_pattern: undefined,
          frequency_text: medication.frequency_text?.trim() || undefined,
          dose_night: false,
          dose_night_amount: undefined,
        };
      }

      const morningAmount = medication.dose_morning ? (medication.dose_morning_amount || "1") : "0";
      const noonAmount = medication.dose_afternoon ? (medication.dose_afternoon_amount || "1") : "0";
      const hasNight = Boolean(medication.dose_evening || medication.dose_night);
      const nightAmount = hasNight
        ? (medication.dose_evening_amount || medication.dose_night_amount || "1")
        : "0";

      return {
        ...medication,
        dose_evening: hasNight,
        dose_night: false,
        dose_night_amount: undefined,
        dosage_type: "pattern",
        dosage_pattern: `${morningAmount}-${noonAmount}-${nightAmount}`,
        frequency_text: medication.frequency_text?.trim() || undefined,
      };
    },
    []
  );

  const buildDraftPayload = React.useCallback((): ConsultationDraftUpdateInput => {
    return {
      chief_complaint: chiefComplaint,
      diagnosis,
      notes,
      prescription_type: prescriptionType,
      prescription_notes: prescriptionNotes,
      medications: medications.map(normalizeMedicationForDraft),
      tests,
      surgeries,
    };
  }, [chiefComplaint, diagnosis, notes, prescriptionType, prescriptionNotes, medications, tests, surgeries, normalizeMedicationForDraft]);

  const hasIncompleteDraftEntries = React.useMemo(() => {
    const hasIncompleteMedication = medications.some((medication) => !medication.medicine_name?.trim());
    const hasIncompleteTest = tests.some((test) => !test.test_name?.trim());
    const hasIncompleteProcedure = surgeries.some((surgery) => !surgery.procedure_name?.trim());

    return hasIncompleteMedication || hasIncompleteTest || hasIncompleteProcedure;
  }, [medications, tests, surgeries]);

  const createDraftSnapshot = React.useCallback(
    (payload: ConsultationDraftUpdateInput): string => {
      const normalizedPayload: ConsultationDraftUpdateInput = {
        chief_complaint: payload.chief_complaint ?? "",
        diagnosis: payload.diagnosis ?? "",
        notes: payload.notes ?? "",
        prescription_type: payload.prescription_type ?? "medication",
        prescription_notes: payload.prescription_notes ?? "",
        medications: (payload.medications ?? []).map(normalizeMedicationForDraft),
        tests: payload.tests ?? [],
        surgeries: payload.surgeries ?? [],
      };
      return JSON.stringify(normalizedPayload);
    },
    [normalizeMedicationForDraft]
  );

  const hydrateConsultationState = React.useCallback(async (consultationId: string) => {
    if (isHydratingDraftRef.current) {
      return;
    }

    isHydratingDraftRef.current = true;
    try {
      const consultationData = await getConsultation(consultationId);
      const consultationDraftIdFromConsultation = normalizeConsultationId(consultationData.draft_id);
      let draftData: ConsultationDraftPayload | null = null;

      const shouldLoadDraft = consultationData.status === "open" || Boolean(consultationDraftIdFromConsultation);

      if (shouldLoadDraft && consultationDraftIdFromConsultation) {
        try {
          draftData = await getConsultationDraftById(consultationDraftIdFromConsultation);
        } catch (draftByIdError: unknown) {
          const draftByIdMessage = getErrorMessage(draftByIdError, "").toLowerCase();
          if (!draftByIdMessage.includes("draft not found")) {
            throw draftByIdError;
          }

          if (consultationData.status === "open") {
            draftData = await getConsultationDraft(consultationId);
          }
        }
      } else if (shouldLoadDraft) {
        draftData = await getConsultationDraft(consultationId);
      }

      const resolvedDraftId = normalizeConsultationId(draftData?.draft_id) ?? consultationDraftIdFromConsultation;
      const sortedPrescriptions = [...(consultationData.prescriptions ?? [])].sort(
        (a, b) => parseIsoDateToTimestamp(a.created_at) - parseIsoDateToTimestamp(b.created_at)
      );
      const latestPrescription = sortedPrescriptions[sortedPrescriptions.length - 1];

      const persistedMedications: MedicationPrescriptionInput[] = sortedPrescriptions.flatMap((prescriptionItem) =>
        (prescriptionItem.medications ?? []).map((medicationItem) => ({
          medicine_name: medicationItem.medicine_name,
          generic_name: medicationItem.generic_name,
          medicine_type: medicationItem.medicine_type,
          strength: medicationItem.strength,
          dose_morning: medicationItem.dose_morning,
          dose_afternoon: medicationItem.dose_afternoon,
          dose_evening: Boolean(medicationItem.dose_evening || medicationItem.dose_night),
          dose_night: false,
          dose_morning_amount: medicationItem.dose_morning_amount,
          dose_afternoon_amount: medicationItem.dose_afternoon_amount,
          dose_evening_amount: medicationItem.dose_evening_amount || medicationItem.dose_night_amount,
          dose_night_amount: undefined,
          frequency_per_day: medicationItem.frequency_per_day,
          dosage_type: medicationItem.dosage_type,
          dosage_pattern: medicationItem.dosage_pattern,
          frequency_text: medicationItem.frequency_text,
          duration_value: medicationItem.duration_value,
          duration_unit: medicationItem.duration_unit,
          meal_instruction: medicationItem.meal_instruction,
          special_instructions: medicationItem.special_instructions,
          start_date: medicationItem.start_date,
          end_date: medicationItem.end_date,
          quantity: medicationItem.quantity,
          refills: medicationItem.refills,
        }))
      );

      const persistedTests: TestPrescriptionInput[] = sortedPrescriptions.flatMap((prescriptionItem) =>
        (prescriptionItem.tests ?? []).map((testItem) => ({
          test_name: testItem.test_name,
          test_type: testItem.test_type,
          instructions: testItem.instructions,
          urgency: testItem.urgency,
          preferred_lab: testItem.preferred_lab,
          expected_date: testItem.expected_date,
        }))
      );

      const persistedSurgeries: SurgeryRecommendationInput[] = sortedPrescriptions.flatMap((prescriptionItem) =>
        (prescriptionItem.surgeries ?? []).map((surgeryItem) => ({
          procedure_name: surgeryItem.procedure_name,
          procedure_type: surgeryItem.procedure_type,
          reason: surgeryItem.reason,
          urgency: surgeryItem.urgency,
          recommended_date: surgeryItem.recommended_date,
          estimated_cost_min: surgeryItem.estimated_cost_min,
          estimated_cost_max: surgeryItem.estimated_cost_max,
          pre_op_instructions: surgeryItem.pre_op_instructions,
          notes: surgeryItem.notes,
          preferred_facility: surgeryItem.preferred_facility,
        }))
      );

      setConsultation(consultationData);
      setConsultationDraftId(draftData ? resolvedDraftId : null);
      setChiefComplaint(draftData?.chief_complaint ?? consultationData.chief_complaint ?? "");
      setDiagnosis(draftData?.diagnosis ?? consultationData.diagnosis ?? "");
      setNotes(draftData?.notes ?? consultationData.notes ?? "");
      setPrescriptionType(draftData?.prescription_type ?? latestPrescription?.type ?? "medication");
      setPrescriptionNotes(draftData?.prescription_notes ?? latestPrescription?.notes ?? "");
      const hydratedMedications = draftData
        ? (draftData.medications ?? []).map((medication) => ({
            ...medication,
            dose_evening: Boolean(medication.dose_evening || medication.dose_night),
            dose_evening_amount: medication.dose_evening_amount || medication.dose_night_amount,
            dose_night: false,
            dose_night_amount: undefined,
          }))
        : persistedMedications;
      const hydratedTests = draftData ? (draftData.tests ?? []) : persistedTests;
      const hydratedSurgeries = draftData ? (draftData.surgeries ?? []) : persistedSurgeries;

      setMedications(hydratedMedications);
      setTests(hydratedTests);
      setSurgeries(hydratedSurgeries);

      lastSavedDraftHashRef.current = createDraftSnapshot({
        chief_complaint: draftData?.chief_complaint ?? consultationData.chief_complaint ?? "",
        diagnosis: draftData?.diagnosis ?? consultationData.diagnosis ?? "",
        notes: draftData?.notes ?? consultationData.notes ?? "",
        prescription_type: draftData?.prescription_type ?? "medication",
        prescription_notes: draftData?.prescription_notes ?? "",
        medications: hydratedMedications,
        tests: hydratedTests,
        surgeries: hydratedSurgeries,
      });
      setRequiresManualSave(false);
      lastDraftHydrationAtRef.current = Date.now();

      const currentQueryConsultationId = normalizeConsultationId(searchParams.get("consultation_id"));
      if (currentQueryConsultationId !== consultationData.id) {
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("consultation_id", consultationData.id);
        router.replace(`/doctor/patient/${patientId}/consultation?${nextParams.toString()}`, { scroll: false });
      }
    } finally {
      isHydratingDraftRef.current = false;
    }
  }, [createDraftSnapshot, patientId, router, searchParams]);

  const persistDraft = React.useCallback(
    async ({
      silent = true,
      suppressError = true,
    }: {
      silent?: boolean;
      suppressError?: boolean;
    } = {}): Promise<ConsultationDraftPayload | null> => {
      if (!consultation) return null;
      if (silent && persistDraftInFlightRef.current) {
        return null;
      }

      const payload = buildDraftPayload();
      let updatedDraft: ConsultationDraftPayload | null = null;

      try {
        if (!silent) {
          setSaving(true);
          setError(null);
        } else {
          persistDraftInFlightRef.current = true;
          setAutosavingDraft(true);
        }

        const activeDraftId = normalizeConsultationId(consultationDraftId);

        try {
          updatedDraft = activeDraftId
            ? await saveConsultationDraftById(activeDraftId, payload)
            : await saveConsultationDraft(consultation.id, payload);
        } catch (saveError: unknown) {
          const saveMessage = getErrorMessage(saveError, "").toLowerCase();
          const canFallback =
            Boolean(activeDraftId)
            && (saveMessage.includes("draft not found") || saveMessage.includes("consultation not found"));

          if (!canFallback) {
            throw saveError;
          }

          updatedDraft = await saveConsultationDraft(consultation.id, payload);
        }

        const returnedConsultationId = normalizeConsultationId(updatedDraft.consultation_id);
        if (!returnedConsultationId) {
          throw new Error("Save failed: backend returned an invalid consultation ID");
        }

        const returnedDraftId = normalizeConsultationId(updatedDraft.draft_id);
        setConsultationDraftId(returnedDraftId);

        if (returnedConsultationId !== consultation.id) {
          setConsultation((previous) => (
            previous
              ? {
                  ...previous,
                  id: returnedConsultationId,
                  draft_id: returnedDraftId ?? undefined,
                }
              : previous
          ));
        } else {
          setConsultation((previous) => (
            previous
              ? {
                  ...previous,
                  draft_id: returnedDraftId ?? previous.draft_id,
                }
              : previous
          ));
        }

        lastSavedDraftHashRef.current = createDraftSnapshot(payload);
        setRequiresManualSave(false);

        return updatedDraft;
      } catch (err: unknown) {
        if (handleAuthError(err)) {
          if (suppressError) {
            return null;
          }
          throw err;
        }

        if (!suppressError) {
          setError(getErrorMessage(err, "Failed to save consultation draft"));
          throw err;
        }

        return null;
      } finally {
        if (!silent) {
          setSaving(false);
        } else {
          persistDraftInFlightRef.current = false;
          setAutosavingDraft(false);
        }
      }
    },
    [consultation, consultationDraftId, buildDraftPayload, createDraftSnapshot, handleAuthError]
  );

  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(() => {
    void loadData();
  }, [patientId]);
  /* eslint-enable react-hooks/exhaustive-deps */

  React.useEffect(() => {
    if (!consultation || isHydratingDraftRef.current) {
      return;
    }

    const currentDraftHash = createDraftSnapshot(buildDraftPayload());
    setRequiresManualSave(currentDraftHash !== lastSavedDraftHashRef.current);
  }, [consultation, chiefComplaint, diagnosis, notes, prescriptionType, prescriptionNotes, medications, tests, surgeries, buildDraftPayload, createDraftSnapshot]);

  React.useEffect(() => {
    if (!consultation || isHydratingDraftRef.current) {
      return;
    }

    if (!requiresManualSave) {
      return;
    }

    if (hasIncompleteDraftEntries) {
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      void persistDraft({ silent: true, suppressError: true });
    }, 2200);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [consultation, chiefComplaint, diagnosis, notes, prescriptionType, prescriptionNotes, medications, tests, surgeries, requiresManualSave, hasIncompleteDraftEntries, persistDraft]);

  React.useEffect(() => {
    if (!consultation) return;

    const reloadDraft = () => {
      if (isHydratingDraftRef.current) return;
      if (saving || autosavingDraft) return;

      const timeSinceLastHydration = Date.now() - lastDraftHydrationAtRef.current;
      if (timeSinceLastHydration < 15_000) return;

      // Never clobber unsaved local edits when window focus changes.
      if (requiresManualSave) return;

      void hydrateConsultationState(consultation.id).catch((hydrateError: unknown) => {
        if (handleAuthError(hydrateError)) {
          return;
        }
        setError(getErrorMessage(hydrateError, "Failed to refresh consultation draft"));
      });
    };

    window.addEventListener("focus", reloadDraft);
    return () => {
      window.removeEventListener("focus", reloadDraft);
    };
  }, [consultation, hydrateConsultationState, requiresManualSave, handleAuthError, autosavingDraft, saving]);

  React.useEffect(() => {
    return () => {
      if (ocrAttachmentPreviewUrl) {
        URL.revokeObjectURL(ocrAttachmentPreviewUrl);
      }
    };
  }, [ocrAttachmentPreviewUrl]);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const patientData = await getPatientForDoctor(patientId);
      setPatient({
        id: patientId,
        first_name: patientData.first_name || "",
        last_name: patientData.last_name || "",
        email: patientData.email,
        phone: patientData.phone,
        profile_photo_url: patientData.profile_photo_url,
        date_of_birth: patientData.date_of_birth,
        gender: patientData.gender,
        blood_group: patientData.blood_group,
      });

      if (requestedConsultationId) {
        await hydrateConsultationState(requestedConsultationId);
        return;
      }

      try {
        const newConsultation = await startConsultation({ patient_id: patientId });
        await hydrateConsultationState(newConsultation.id);
      } catch (err: unknown) {
        const message = getErrorMessage(err, "Failed to start consultation");

        if (message.includes("Active consultation already exists")) {
          const activeConsultations = await getDoctorActiveConsultations();
          const existingConsultation = selectActiveConsultationForPatient(activeConsultations.consultations, patientId);

          if (existingConsultation) {
            await hydrateConsultationState(existingConsultation.id);
            setSuccess("Loaded existing active consultation");
          } else {
            setError("An active consultation exists but could not be loaded. Please try again.");
          }
        } else {
          throw err;
        }
      }
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }

      console.error("Failed to load data:", err);
      setError(getErrorMessage(err, "Failed to load patient data"));
    } finally {
      setLoading(false);
    }
  }, [patientId, requestedConsultationId, hydrateConsultationState, handleAuthError]);

  const handleSaveNotes = async () => {
    if (!consultation) return;

    if (hasIncompleteDraftEntries) {
      setError("Please complete or remove empty medicine, test, or procedure entries before saving.");
      return;
    }

    try {
      await persistDraft({ silent: false, suppressError: false });
      setSuccess("Consultation saved");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      // Error state is already surfaced by persistDraft.
    }
  };

  const handleAddPrescription = async () => {
    if (!consultation) return;

    const hasMedications = medications.length > 0;
    const hasTests = tests.length > 0;
    const hasSurgeries = surgeries.length > 0;

    if (!hasMedications && !hasTests && !hasSurgeries) {
      setError("Please add at least one medication, test, or procedure");
      return;
    }

    if (hasMedications) {
      for (const med of medications) {
        if (!med.medicine_name.trim()) {
          setError("Medicine name is required for all medications");
          return;
        }
        if ((med.dosage_type || "pattern") === "pattern" && !med.dose_morning && !med.dose_afternoon && !med.dose_evening) {
          setError("Please select at least one dosage slot (Morning/Noon/Night) for each medication");
          return;
        }
        if ((med.dosage_type || "pattern") === "frequency" && !med.frequency_text?.trim() && !med.frequency_per_day) {
          setError("Please provide frequency text or times-per-day for frequency-based medications");
          return;
        }
      }
    }

    if (hasTests) {
      for (const test of tests) {
        if (!test.test_name.trim()) {
          setError("Test name is required for all tests");
          return;
        }
      }
    }

    if (hasSurgeries) {
      for (const surgery of surgeries) {
        if (!surgery.procedure_name.trim()) {
          setError("Procedure name is required for all procedures");
          return;
        }
      }
    }

    const normalizedMedications = hasMedications
      ? medications.map((medication) => normalizeMedicationForDraft(medication))
      : undefined;

    try {
      setSubmitting(true);
      setError(null);

      const updatedDraft = await persistDraft({ silent: true, suppressError: false });
      const activeDraftId = normalizeConsultationId(updatedDraft?.draft_id) ?? normalizeConsultationId(consultationDraftId);
      const previewPayload = await getFullPrescriptionByConsultation(consultation.id, activeDraftId || undefined);
      const snapshotGeneratedAt = new Date().toISOString();
      const renderedPrescriptionHtml = buildClinicalPrescriptionDocumentHtml(previewPayload, {
        consultationId: consultation.id,
        generatedAtIso: snapshotGeneratedAt,
      });

      await addPrescription(consultation.id, {
        type: prescriptionType,
        notes: prescriptionNotes,
        rendered_prescription_html: renderedPrescriptionHtml,
        rendered_prescription_snapshot: previewPayload,
        rendered_prescription_generated_at: snapshotGeneratedAt,
        medications: normalizedMedications,
        tests: hasTests ? tests : undefined,
        surgeries: hasSurgeries ? surgeries : undefined,
      });

      isHydratingDraftRef.current = true;
      setConsultationDraftId(null);
      setConsultation((previous) => (previous ? { ...previous, draft_id: undefined } : previous));
      setMedications([]);
      setTests([]);
      setSurgeries([]);
      setPrescriptionNotes("");
      window.setTimeout(() => {
        isHydratingDraftRef.current = false;
      }, 0);

      setShowSuccessDialog(true);
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }
      setError(getErrorMessage(err, "Failed to add prescription"));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreviewPrescription = async () => {
    if (!consultation) return;

    if (hasIncompleteDraftEntries) {
      setError("Please complete or remove empty medicine, test, or procedure entries before preview.");
      return;
    }

    try {
      setError(null);
      setPreviewLoading(true);

      let activeDraftId = normalizeConsultationId(consultationDraftId);

      if (requiresManualSave || !activeDraftId) {
        const updatedDraft = await persistDraft({
          silent: false,
          suppressError: false,
        });
        activeDraftId = normalizeConsultationId(updatedDraft?.draft_id) ?? normalizeConsultationId(consultationDraftId);
      }

      if (!activeDraftId) {
        setError("Draft is not initialized. Please save consultation again.");
        return;
      }

      router.push(`/prescription/preview/${consultation.id}?draft_id=${activeDraftId}`);
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to open prescription preview";
      setError(message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImportHandwrittenPrescription = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      setOcrImporting(true);
      setOcrError(null);

      const nextPreviewUrl = URL.createObjectURL(file);
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      setOcrAttachmentPreviewUrl((previous) => {
        if (previous) {
          URL.revokeObjectURL(previous);
        }
        return nextPreviewUrl;
      });
      setOcrAttachmentName(file.name);
      setOcrAttachmentKind(isPdf ? "pdf" : "image");

      const extracted = await extractPrescriptionFromImage(file, { saveFile: false });
      const detectedMedicines = (extracted.medications || [])
        .map((item) => ({
          name: (item.name || "").trim(),
          dosage: item.dosage || undefined,
          frequency: item.frequency || undefined,
          quantity: item.quantity || undefined,
        }))
        .filter((item) => item.name);
      setOcrDetectedMedicines(detectedMedicines);

      const parsed = detectedMedicines
        .map((item) => {
          if (!item.name) return null;
          const schedule = parseDoseSchedule(item.frequency || undefined);
          const normalizedFrequency = (item.frequency || "").trim();
          const patternMatch = normalizedFrequency.match(/(\d)\s*[+\-]\s*(\d)\s*[+\-]\s*(\d)/);
          const hasPattern = Boolean(patternMatch);
          const instructionParts = [item.frequency, item.quantity].filter(Boolean).map((part) => String(part).trim());
          return {
            medicine_name: item.name,
            strength: item.dosage || undefined,
            dose_morning: schedule.morning,
            dose_afternoon: schedule.noon,
            dose_evening: schedule.night,
            dose_night: false,
            dosage_type: hasPattern ? ("pattern" as const) : ("frequency" as const),
            dosage_pattern: patternMatch ? `${patternMatch[1]}-${patternMatch[2]}-${patternMatch[3]}` : undefined,
            frequency_text: hasPattern ? undefined : (normalizedFrequency || undefined),
            duration_value: 7,
            duration_unit: "days" as const,
            meal_instruction: "after_meal" as const,
            special_instructions: instructionParts.length ? instructionParts.join(" | ") : undefined,
          };
        })
        .filter(Boolean) as MedicationPrescriptionInput[];

      if (parsed.length === 0) {
        setOcrError("No medicines were detected. Please review the scan and try again.");
        return;
      }

      setPrescriptionType("medication");
      setMedications((prev) => {
        const existing = new Set(prev.map((med) => med.medicine_name.trim().toLowerCase()));
        const additions = parsed.filter((med) => !existing.has(med.medicine_name.trim().toLowerCase()));
        return [...prev, ...additions];
      });

      setSuccess(`Imported ${parsed.length} medicine(s) from handwritten prescription. Please review before sending.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: unknown) {
      setOcrError(getErrorMessage(err, "Failed to import handwritten prescription."));
    } finally {
      setOcrImporting(false);
    }
  };

  const handleCompleteConsultation = async () => {
    if (!consultation) return;

    try {
      setSubmitting(true);
      setError(null);

      await persistDraft({ silent: true, suppressError: false });

      await completeConsultation(consultation.id);
      setSuccess("Consultation completed successfully");

      setTimeout(() => {
        router.push("/doctor/patients");
      }, 1500);
    } catch (err: unknown) {
      if (handleAuthError(err)) {
        return;
      }
      setError(getErrorMessage(err, "Failed to complete consultation"));
      setSubmitting(false);
    }
  };

  const calculateAge = (dob?: string) => {
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

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-12.5">
          <PageLoadingShell label="Loading consultation..." cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-12.5">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Stethoscope className="w-7 h-7 text-primary" />
                Consultation Session
              </h1>
              <p className="text-muted-foreground mt-1">
                Prescribe medications, tests, or procedures for your patient
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => router.push(`/doctor/patient/${patientId}/consultation/ai`)}
            className="gap-2"
          >
            <Sparkles className="w-4 h-4" />
            AI Pre-Step
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <p className="text-success">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {patient && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Patient Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {patient.profile_photo_url ? (
                        <Image
                          src={patient.profile_photo_url}
                          alt={patient.first_name}
                          width={64}
                          height={64}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <User className="w-8 h-8 text-primary" />
                      )}
                    </div>
                    <div>
                      <Badge variant="outline" className="mb-1 text-[11px] font-semibold text-primary border-primary/35 bg-primary/5">
                        Patient ID: {patient.id}
                      </Badge>
                      <h3 className="font-semibold text-foreground">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {calculateAge(patient.date_of_birth) && (
                          <Badge variant="secondary" className="text-xs">
                            {calculateAge(patient.date_of_birth)} years
                          </Badge>
                        )}
                        {patient.gender && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {patient.gender}
                          </Badge>
                        )}
                        {patient.blood_group && (
                          <Badge variant="outline" className="text-xs">
                            {patient.blood_group}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {(patient.phone || patient.email) && (
                    <div className="text-sm text-muted-foreground space-y-1">
                      {patient.phone && <p>Phone: {patient.phone}</p>}
                      {patient.email && <p>Email: {patient.email}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Consultation Notes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Chief Complaint</Label>
                  <Textarea
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Patient's main complaint..."
                    rows={2}
                    className="rounded-lg resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Diagnosis</Label>
                  <Textarea
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Your diagnosis..."
                    rows={2}
                    className="rounded-lg resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes..."
                    rows={3}
                    className="rounded-lg resize-none"
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSaveNotes}
                  disabled={saving || !consultation}
                >
                  {saving ? (
                    <ButtonLoader className="mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Consultation
                </Button>
                {autosavingDraft ? (
                  <p className="text-xs text-muted-foreground">Autosave backup is running...</p>
                ) : null}
                {requiresManualSave ? (
                  <p className="text-xs text-warning">Unsaved changes. Click Save Consultation before preview.</p>
                ) : null}
              </CardContent>
            </Card>

            <Button
              variant="transaction"
              className="w-full"
              onClick={handleCompleteConsultation}
              disabled={submitting || !consultation}
            >
              {submitting ? (
                <ButtonLoader className="mr-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Complete Consultation
            </Button>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  Write Prescription
                </CardTitle>
                <CardDescription>
                  Add medications, tests, or procedures for this patient
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={prescriptionType} onValueChange={(v) => setPrescriptionType(v as PrescriptionType)}>
                  <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="medication" className="flex items-center gap-2">
                      <Pill className="w-4 h-4" />
                      <span className="hidden sm:inline">Medications</span>
                    </TabsTrigger>
                    <TabsTrigger value="test" className="flex items-center gap-2">
                      <FlaskConical className="w-4 h-4" />
                      <span className="hidden sm:inline">Tests</span>
                    </TabsTrigger>
                    <TabsTrigger value="surgery" className="flex items-center gap-2">
                      <Scissors className="w-4 h-4" />
                      <span className="hidden sm:inline">Procedures</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="medication" className="space-y-6">
                    <MedicationForm
                      medications={medications}
                      onMedicationsChange={setMedications}
                    />
                  </TabsContent>

                  <TabsContent value="test" className="space-y-6">
                    <TestForm
                      tests={tests}
                      onTestsChange={setTests}
                    />
                  </TabsContent>

                  <TabsContent value="surgery" className="space-y-6">
                    <SurgeryForm
                      surgeries={surgeries}
                      onSurgeriesChange={setSurgeries}
                    />
                  </TabsContent>
                </Tabs>

                <div className="mt-6 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => ocrInputRef.current?.click()}
                      disabled={ocrImporting}
                    >
                      {ocrImporting ? "Importing..." : "Import Handwritten Prescription"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => ocrCameraInputRef.current?.click()}
                      disabled={ocrImporting}
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Take Prescription Photo
                    </Button>
                    <input
                      ref={ocrInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                      className="hidden"
                      onChange={handleImportHandwrittenPrescription}
                    />
                    <input
                      ref={ocrCameraInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      capture="environment"
                      className="hidden"
                      onChange={handleImportHandwrittenPrescription}
                    />
                  </div>
                  {ocrError ? <p className="text-sm text-destructive">{ocrError}</p> : null}

                  {(ocrAttachmentPreviewUrl || ocrDetectedMedicines.length > 0) ? (
                    <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/60 bg-surface/20 p-3 md:grid-cols-2">
                      <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Uploaded Attachment</p>
                        {ocrAttachmentName ? (
                          <p className="mb-2 truncate text-xs text-foreground">{ocrAttachmentName}</p>
                        ) : null}

                        {ocrAttachmentPreviewUrl ? (
                          ocrAttachmentKind === "pdf" ? (
                            <iframe
                              src={ocrAttachmentPreviewUrl}
                              title="Prescription attachment preview"
                              className="h-56 w-full rounded-md border border-border/50 bg-background"
                            />
                          ) : (
                            <Image
                              src={ocrAttachmentPreviewUrl}
                              alt="Prescription attachment preview"
                              width={800}
                              height={600}
                              className="h-56 w-full rounded-md border border-border/50 bg-background object-contain"
                              unoptimized
                            />
                          )
                        ) : (
                          <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
                            No attachment preview available
                          </div>
                        )}
                      </div>

                      <div className="rounded-lg border border-border/60 bg-background/70 p-2">
                        <p className="mb-2 text-xs font-semibold text-muted-foreground">Inferred OCR Medicines</p>
                        {ocrDetectedMedicines.length === 0 ? (
                          <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border/60 text-xs text-muted-foreground">
                            No medicines detected from OCR yet
                          </div>
                        ) : (
                          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                            {ocrDetectedMedicines.map((item, index) => (
                              <div key={`${item.name}-${index}`} className="rounded-md border border-border/50 bg-surface/40 p-2">
                                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.dosage || "No dosage"}
                                  {item.frequency ? ` | ${item.frequency}` : ""}
                                  {item.quantity ? ` | ${item.quantity}` : ""}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  <Label>Prescription Notes (Optional)</Label>
                  <Textarea
                    value={prescriptionNotes}
                    onChange={(e) => setPrescriptionNotes(e.target.value)}
                    placeholder="Any additional notes for this prescription..."
                    rows={2}
                    className="rounded-lg resize-none"
                  />
                </div>

                <div className="mt-6">
                  <PrescriptionReview
                    medications={medications}
                    tests={tests}
                    surgeries={surgeries}
                    notes={prescriptionNotes}
                    attachmentPreviewUrl={ocrAttachmentPreviewUrl}
                    attachmentName={ocrAttachmentName}
                    attachmentKind={ocrAttachmentKind}
                  />
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handlePreviewPrescription}
                    disabled={!consultation || previewLoading || saving}
                    className="sm:min-w-50"
                  >
                    {previewLoading ? (
                      <ButtonLoader className="mr-2" />
                    ) : (
                      <Printer className="w-4 h-4 mr-2" />
                    )}
                    Preview Prescription
                  </Button>
                  <Button
                    variant="medical"
                    size="lg"
                    onClick={handleAddPrescription}
                    disabled={submitting || !consultation}
                    className="min-w-50"
                  >
                    {submitting ? (
                      <ButtonLoader className="mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Prescription
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-success/10">
              <CheckCircle2 className="w-6 h-6 text-success" />
            </div>
            <DialogTitle className="text-center">Prescription Sent Successfully!</DialogTitle>
            <DialogDescription className="text-center">
              The prescription has been sent to the patient. They will be notified and can review it in their dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button
              variant="medical"
              onClick={() => setShowSuccessDialog(false)}
              className="min-w-37.5"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppBackground>
  );
}

