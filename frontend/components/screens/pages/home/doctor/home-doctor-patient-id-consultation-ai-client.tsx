"use client";

import React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, User, X } from "lucide-react";

import { AIAssistantPanel } from "@/components/ai/AIAssistantPanel";
import { AppBackground } from "@/components/ui/app-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { Navbar } from "@/components/ui/navbar";
import { Textarea } from "@/components/ui/textarea";
import { getPatientForDoctor } from "@/lib/patient-access-actions";

interface PatientInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo_url?: string;
  gender?: string;
  blood_group?: string;
}

type SuggestionType = "condition" | "test" | "medication";

interface AIConsultationPrefill {
  chiefComplaint: string;
  diagnosis: string;
  notes: string;
  selectedMedications: string[];
  selectedTests: string[];
}

function getPrefillStorageKey(patientId: string): string {
  return `medora:consultation-ai-prefill:${patientId}`;
}

export default function ConsultationAIPreStepPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [patient, setPatient] = React.useState<PatientInfo | null>(null);

  const [chiefComplaint, setChiefComplaint] = React.useState("");
  const [diagnosis, setDiagnosis] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [selectedMedications, setSelectedMedications] = React.useState<string[]>([]);
  const [selectedTests, setSelectedTests] = React.useState<string[]>([]);
  const clinicalContext = [chiefComplaint, diagnosis, notes].filter((value) => value.trim()).join("\n");

  React.useEffect(() => {
    let isMounted = true;

    async function loadPatient() {
      try {
        setLoading(true);
        setError(null);
        const patientData = await getPatientForDoctor(patientId);
        if (!isMounted) {
          return;
        }

        setPatient({
          id: patientId,
          first_name: patientData.first_name || "",
          last_name: patientData.last_name || "",
          profile_photo_url: patientData.profile_photo_url,
          gender: patientData.gender,
          blood_group: patientData.blood_group,
        });
      } catch (err: any) {
        if (!isMounted) {
          return;
        }
        setError(err.message || "Failed to load patient data");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadPatient();
    return () => {
      isMounted = false;
    };
  }, [patientId]);

  const handleInsertSuggestion = React.useCallback(
    (suggestion: { type: SuggestionType; text: string; confidence: number }) => {
      const confidenceLabel = `${Math.round(suggestion.confidence * 100)}%`;
      setNotes((prev) => `${prev.trim()}\n- ${suggestion.text} (${confidenceLabel})`.trim());

      if (suggestion.type === "medication") {
        const medicationName = suggestion.text.replace("Suggested medication:", "").trim();
        setSelectedMedications((prev) => (prev.includes(medicationName) ? prev : [...prev, medicationName]));
      }

      if (suggestion.type === "test") {
        const testName = suggestion.text.replace("Suggested test:", "").trim();
        setSelectedTests((prev) => (prev.includes(testName) ? prev : [...prev, testName]));
      }

      if (suggestion.type === "condition") {
        const conditionName = suggestion.text.replace("Possible condition:", "").trim();
        if (!chiefComplaint.trim()) {
          setChiefComplaint(conditionName);
        }
        if (!diagnosis.trim()) {
          setDiagnosis(conditionName);
        }
      }
    },
    [chiefComplaint, diagnosis]
  );

  const removeMedication = (name: string) => {
    setSelectedMedications((prev) => prev.filter((item) => item !== name));
  };

  const removeTest = (name: string) => {
    setSelectedTests((prev) => prev.filter((item) => item !== name));
  };

  const continueToConsultation = () => {
    const payload: AIConsultationPrefill = {
      chiefComplaint,
      diagnosis,
      notes,
      selectedMedications,
      selectedTests,
    };

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(getPrefillStorageKey(patientId), JSON.stringify(payload));
    }

    router.push(`/doctor/patient/${patientId}/consultation?from=ai`);
  };

  if (loading) {
    return (
      <AppBackground>
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-12.5">
          <div className="flex items-center justify-center py-20">
            <MedoraLoader size="lg" label="Loading AI pre-consultation..." />
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
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-7 h-7 text-primary" />
                AI Pre-Consultation
              </h1>
              <p className="text-muted-foreground mt-1">
                Collect AI-assisted suggestions before opening the prescription workspace
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={() => router.push(`/doctor/patient/${patientId}/consultation`)}>
            Skip AI Step
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            {patient && (
              <Card className="rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Patient</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                      {patient.profile_photo_url ? (
                        <Image
                          src={patient.profile_photo_url}
                          alt={patient.first_name}
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <User className="w-7 h-7 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {patient.gender ? (
                          <Badge variant="outline" className="text-xs capitalize">
                            {patient.gender}
                          </Badge>
                        ) : null}
                        {patient.blood_group ? (
                          <Badge variant="outline" className="text-xs">
                            {patient.blood_group}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pre-Consultation Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Chief Complaint</Label>
                  <Textarea
                    value={chiefComplaint}
                    onChange={(event) => setChiefComplaint(event.target.value)}
                    rows={2}
                    placeholder="Main complaint"
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Provisional Diagnosis</Label>
                  <Textarea
                    value={diagnosis}
                    onChange={(event) => setDiagnosis(event.target.value)}
                    rows={2}
                    placeholder="Diagnosis draft"
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>AI-Assisted Notes</Label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="Suggestions and notes"
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selected Suggestions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Medications</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMedications.length ? (
                      selectedMedications.map((name) => (
                        <Badge key={name} variant="secondary" className="gap-1 pr-1">
                          {name}
                          <button
                            type="button"
                            onClick={() => removeMedication(name)}
                            className="inline-flex items-center justify-center rounded-full hover:bg-black/10"
                            aria-label={`Remove ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No medications selected</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Tests</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedTests.length ? (
                      selectedTests.map((name) => (
                        <Badge key={name} variant="secondary" className="gap-1 pr-1">
                          {name}
                          <button
                            type="button"
                            onClick={() => removeTest(name)}
                            className="inline-flex items-center justify-center rounded-full hover:bg-black/10"
                            aria-label={`Remove ${name}`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No tests selected</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button variant="medical" className="w-full" onClick={continueToConsultation}>
              Continue To Consultation
            </Button>
          </div>

          <div className="lg:col-span-2">
            <AIAssistantPanel
              patientId={patientId}
              notes={notes}
              clinicalContext={clinicalContext}
              onInsertSuggestion={handleInsertSuggestion}
            />
          </div>
        </div>
      </main>
    </AppBackground>
  );
}
