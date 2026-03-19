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
  
  // Consultation form
  const [chiefComplaint, setChiefComplaint] = React.useState("");
  const [diagnosis, setDiagnosis] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Prescription type tab
  const [prescriptionType, setPrescriptionType] = React.useState<PrescriptionType>("medication");
  
  // Prescription items
  const [medications, setMedications] = React.useState<MedicationPrescriptionInput[]>([]);
  const [tests, setTests] = React.useState<TestPrescriptionInput[]>([]);
  const [surgeries, setSurgeries] = React.useState<SurgeryRecommendationInput[]>([]);
  const [prescriptionNotes, setPrescriptionNotes] = React.useState("");

  React.useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load patient details
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

      // Try to start or get existing consultation
      try {
        const newConsultation = await startConsultation({ patient_id: patientId });
        setConsultation(newConsultation);
        setChiefComplaint(newConsultation.chief_complaint || "");
        setDiagnosis(newConsultation.diagnosis || "");
        setNotes(newConsultation.notes || "");
      } catch (err: any) {
        // If there's already an active consultation, load it
        if (err.message?.includes("Active consultation already exists")) {
          // Fetch all active consultations and find the one for this patient
          const activeConsultations = await getDoctorActiveConsultations();
          const existingConsultation = activeConsultations.consultations.find(
            (c) => c.patient_id === patientId
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

    // Validation - check if at least one item is added across all types
    const hasMedications = medications.length > 0;
    const hasTests = tests.length > 0;
    const hasSurgeries = surgeries.length > 0;

    if (!hasMedications && !hasTests && !hasSurgeries) {
      setError("Please add at least one medication, test, or procedure");
      return;
    }

    // Validate medication fields (if any)
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

    // Validate test fields (if any)
    if (hasTests) {
      for (const test of tests) {
        if (!test.test_name.trim()) {
          setError("Test name is required for all tests");
          return;
        }
      }
    }

    // Validate surgery fields (if any)
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

      // Send all types in a single prescription
      // The backend will handle all types together
      await addPrescription(consultation.id, {
        type: prescriptionType, // Keep for backward compatibility, but all types will be sent
        notes: prescriptionNotes,
        medications: hasMedications ? medications : undefined,
        tests: hasTests ? tests : undefined,
        surgeries: hasSurgeries ? surgeries : undefined,
      });

      // Clear all forms after successful submission
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
        <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
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

      <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
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

        {/* Error/Success Messages */}
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
          {/* Left Column - Patient Info & Notes */}
          <div className="lg:col-span-1 space-y-6">
            {/* Patient Card */}
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

            {/* Consultation Notes */}
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

            {/* Complete Consultation */}
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

          {/* Right Column - Prescription Forms */}
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

                {/* Prescription Notes */}
                <div className="mt-6 space-y-2">
                  <Label>Prescription Notes (Optional)</Label>
                  <Textarea
                    value={prescriptionNotes}
                    onChange={(e) => setPrescriptionNotes(e.target.value)}
                    placeholder="Any additional notes for this prescription..."
                    rows={2}
                    className="rounded-lg resize-none"
                  />
                </div>

                {/* Preview */}
                <div className="mt-6">
                  <PrescriptionReview
                    type={prescriptionType}
                    medications={medications}
                    tests={tests}
                    surgeries={surgeries}
                    notes={prescriptionNotes}
                  />
                </div>

                {/* Submit Button */}
                <div className="mt-6 flex justify-end">
                  <Button
                    variant="medical"
                    size="lg"
                    onClick={handleAddPrescription}
                    disabled={submitting || !consultation}
                    className="min-w-[200px]"
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

      {/* Success Dialog */}
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
              className="min-w-[150px]"
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppBackground>
  );
}

