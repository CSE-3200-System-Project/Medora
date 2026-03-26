"use client";

import React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
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
import { MedoraLoader, ButtonLoader } from "@/components/ui/medora-loader";
import {
  startConsultation,
  updateConsultation,
  completeConsultation,
  addPrescription,
  getDoctorActiveConsultations,
  Consultation,
  MedicationPrescriptionInput,
  TestPrescriptionInput,
  SurgeryRecommendationInput,
  PrescriptionType,
} from "@/lib/prescription-actions";
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
} from "lucide-react";

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

interface AIConsultationPrefill {
  chiefComplaint?: string;
  diagnosis?: string;
  notes?: string;
  selectedMedications?: string[];
  selectedTests?: string[];
}

interface OcrDetectedMedication {
  name: string;
  dosage?: string;
  frequency?: string;
  quantity?: string;
}

function getPrefillStorageKey(patientId: string): string {
  return `medora:consultation-ai-prefill:${patientId}`;
}

export default function ConsultationPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = React.useState(false);

  const [patient, setPatient] = React.useState<PatientInfo | null>(null);
  const [consultation, setConsultation] = React.useState<Consultation | null>(null);

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
  const [ocrAttachmentPreviewUrl, setOcrAttachmentPreviewUrl] = React.useState<string | null>(null);
  const [ocrAttachmentName, setOcrAttachmentName] = React.useState<string>("");
  const [ocrAttachmentKind, setOcrAttachmentKind] = React.useState<"image" | "pdf" | null>(null);
  const [ocrDetectedMedicines, setOcrDetectedMedicines] = React.useState<OcrDetectedMedication[]>([]);

  const parseDoseSchedule = React.useCallback((frequencyText: string | undefined) => {
    const normalized = (frequencyText || "").trim().toLowerCase();
    const pattern = normalized.match(/(\d)\s*\+\s*(\d)\s*\+\s*(\d)(?:\s*\+\s*(\d))?/);
    if (pattern) {
      return {
        morning: Number(pattern[1] || "0") > 0,
        afternoon: Number(pattern[2] || "0") > 0,
        evening: Number(pattern[3] || "0") > 0,
        night: Number(pattern[4] || "0") > 0,
      };
    }
    return { morning: true, afternoon: false, evening: false, night: false };
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [patientId]);

  React.useEffect(() => {
    if (!consultation || typeof window === "undefined") {
      return;
    }

    const storageKey = getPrefillStorageKey(patientId);
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AIConsultationPrefill;

      if (parsed.chiefComplaint && !chiefComplaint.trim()) {
        setChiefComplaint(parsed.chiefComplaint);
      }
      if (parsed.diagnosis && !diagnosis.trim()) {
        setDiagnosis(parsed.diagnosis);
      }
      if (parsed.notes) {
        const mergedNotes = notes.trim() ? `${notes.trim()}\n\n${parsed.notes.trim()}` : parsed.notes.trim();
        setNotes(mergedNotes);
      }

      const selectedMedications = parsed.selectedMedications ?? [];
      if (selectedMedications.length) {
        setMedications((prev) => {
          const existingNames = new Set(prev.map((item) => item.medicine_name.trim().toLowerCase()));
          const additions = selectedMedications
            .map((name) => name.trim())
            .filter((name) => name.length > 0 && !existingNames.has(name.toLowerCase()))
            .map((name) => ({
              medicine_name: name,
              dose_morning: true,
              duration_value: 7,
              duration_unit: "days" as const,
              meal_instruction: "after_meal" as const,
            }));
          return [...prev, ...additions];
        });
      }

      const selectedTests = parsed.selectedTests ?? [];
      if (selectedTests.length) {
        setTests((prev) => {
          const existingNames = new Set(prev.map((item) => item.test_name.trim().toLowerCase()));
          const additions = selectedTests
            .map((name) => name.trim())
            .filter((name) => name.length > 0 && !existingNames.has(name.toLowerCase()))
            .map((name) => ({
              test_name: name,
              urgency: "normal" as const,
            }));
          return [...prev, ...additions];
        });
      }

      setSuccess("AI suggestions loaded. Please review and edit before sending.");
      setTimeout(() => setSuccess(null), 3500);
    } catch {
      setError("Failed to load AI suggestions into consultation.");
    } finally {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [consultation, patientId, chiefComplaint, diagnosis, notes]);

  React.useEffect(() => {
    return () => {
      if (ocrAttachmentPreviewUrl) {
        URL.revokeObjectURL(ocrAttachmentPreviewUrl);
      }
    };
  }, [ocrAttachmentPreviewUrl]);

  const loadData = async () => {
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

      try {
        const newConsultation = await startConsultation({ patient_id: patientId });
        setConsultation(newConsultation);
        setChiefComplaint(newConsultation.chief_complaint || "");
        setDiagnosis(newConsultation.diagnosis || "");
        setNotes(newConsultation.notes || "");
      } catch (err: any) {
        if (err.message?.includes("Active consultation already exists")) {
          const activeConsultations = await getDoctorActiveConsultations();
          const existingConsultation = activeConsultations.consultations.find(
            (c: any) => c.patient_ref === patientId || c.patient_id === patientId
          );

          if (existingConsultation) {
            setConsultation(existingConsultation);
            setChiefComplaint(existingConsultation.chief_complaint || "");
            setDiagnosis(existingConsultation.diagnosis || "");
            setNotes(existingConsultation.notes || "");
            setSuccess("Loaded existing active consultation");
          } else {
            setError("An active consultation exists but could not be loaded. Please try again.");
          }
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setError(err.message || "Failed to load patient data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!consultation) return;

    try {
      setSaving(true);
      setError(null);

      const updated = await updateConsultation(consultation.id, {
        chief_complaint: chiefComplaint,
        diagnosis,
        notes,
      });

      setConsultation(updated);
      setSuccess("Notes saved successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save notes");
    } finally {
      setSaving(false);
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
        if (!med.dose_morning && !med.dose_afternoon && !med.dose_evening && !med.dose_night) {
          setError("Please select at least one dosage time for each medication");
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

    try {
      setSubmitting(true);
      setError(null);

      await addPrescription(consultation.id, {
        type: prescriptionType,
        notes: prescriptionNotes,
        medications: hasMedications ? medications : undefined,
        tests: hasTests ? tests : undefined,
        surgeries: hasSurgeries ? surgeries : undefined,
      });

      setMedications([]);
      setTests([]);
      setSurgeries([]);
      setPrescriptionNotes("");

      setShowSuccessDialog(true);
    } catch (err: any) {
      setError(err.message || "Failed to add prescription");
    } finally {
      setSubmitting(false);
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
          const instructionParts = [item.frequency, item.quantity].filter(Boolean).map((part) => String(part).trim());
          return {
            medicine_name: item.name,
            strength: item.dosage || undefined,
            dose_morning: schedule.morning,
            dose_afternoon: schedule.afternoon,
            dose_evening: schedule.evening,
            dose_night: schedule.night,
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
    } catch (err: any) {
      setOcrError(err?.message || "Failed to import handwritten prescription.");
    } finally {
      setOcrImporting(false);
    }
  };

  const handleCompleteConsultation = async () => {
    if (!consultation) return;

    try {
      setSubmitting(true);
      setError(null);

      await completeConsultation(consultation.id);
      setSuccess("Consultation completed successfully");

      setTimeout(() => {
        router.push("/doctor/patients");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to complete consultation");
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
      <AppBackground>
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-12.5">
          <div className="flex items-center justify-center py-20">
            <MedoraLoader size="lg" label="Loading consultation..." />
          </div>
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
                  Save Notes
                </Button>
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
                    <input
                      ref={ocrInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
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
                    type={prescriptionType}
                    medications={medications}
                    tests={tests}
                    surgeries={surgeries}
                    notes={prescriptionNotes}
                  />
                </div>

                <div className="mt-6 flex justify-end">
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

