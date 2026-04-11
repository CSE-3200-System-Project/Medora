"use client";

import React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getPatientPrescription,
  getPatientPrescriptionAttachments,
  acceptPrescription,
  rejectPrescription,
  Prescription,
  PrescriptionAttachment,
} from "@/lib/prescription-actions";
import {
  getPatientPrescriptionAssistantSummary,
  type PatientPrescriptionAssistantSummaryResponse,
} from "@/lib/ai-consultation-actions";
import { resolveAvatarUrl } from "@/lib/avatar";
import {
  FileText,
  Pill,
  FlaskConical,
  Scissors,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Utensils,
  Building2,
  DollarSign,
  Download,
  ExternalLink,
} from "lucide-react";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { PrescriptionVapiVoiceSummary } from "@/components/ai/prescription-vapi-voice-summary";

type AssistantMedicationPlanItem = {
  name: string;
  schedule: string;
  quantity?: number | string | null;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getAssistantMedicationPlan(summary: Record<string, unknown> | undefined): AssistantMedicationPlanItem[] {
  if (!summary) {
    return [];
  }

  const rawPlan = summary["medication_plan"];
  if (!Array.isArray(rawPlan)) {
    return [];
  }

  const items: AssistantMedicationPlanItem[] = [];
  for (const rawItem of rawPlan) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }
    const item = rawItem as Record<string, unknown>;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const schedule = typeof item.schedule === "string" ? item.schedule.trim() : "";
    if (!name) {
      continue;
    }
    items.push({
      name,
      schedule: schedule || "as directed",
      quantity: item.quantity as number | string | null | undefined,
    });
  }

  return items;
}

function formatAttachmentSize(fileSize: number): string {
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return "Unknown size";
  }
  if (fileSize < 1024) {
    return `${fileSize} B`;
  }
  if (fileSize < 1024 * 1024) {
    return `${(fileSize / 1024).toFixed(1)} KB`;
  }
  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PatientPrescriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const prescriptionId = params.id as string;

  const [prescription, setPrescription] = React.useState<Prescription | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [assistantSummary, setAssistantSummary] = React.useState<PatientPrescriptionAssistantSummaryResponse | null>(null);
  const [assistantLoading, setAssistantLoading] = React.useState(false);
  const [assistantError, setAssistantError] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<PrescriptionAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = React.useState(false);
  const [attachmentsError, setAttachmentsError] = React.useState<string | null>(null);

  const assistantMedicationPlan = React.useMemo(
    () => getAssistantMedicationPlan(assistantSummary?.summary),
    [assistantSummary]
  );

  const loadPrescription = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setAttachmentsError(null);
      setAttachmentsLoading(true);
      const data = await getPatientPrescription(prescriptionId);
      setPrescription(data);

      try {
        const attachmentData = await getPatientPrescriptionAttachments(prescriptionId);
        setAttachments(attachmentData);
      } catch (attachmentError: unknown) {
        console.error("Failed to load prescription attachments:", attachmentError);
        setAttachments([]);
        setAttachmentsError(getErrorMessage(attachmentError, "Failed to load attached prescription documents"));
      } finally {
        setAttachmentsLoading(false);
      }
    } catch (error: unknown) {
      console.error("Failed to load prescription:", error);
      setError(getErrorMessage(error, "Failed to load prescription"));
      setAttachments([]);
      setAttachmentsLoading(false);
    } finally {
      setLoading(false);
    }
  }, [prescriptionId]);

  React.useEffect(() => {
    loadPrescription();
  }, [loadPrescription]);

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await acceptPrescription(prescriptionId);
      // Refetch prescription to get updated status
      await loadPrescription();
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to accept prescription"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }
    
    try {
      setActionLoading(true);
      setError(null);
      await rejectPrescription(prescriptionId, rejectReason);
      // Refetch prescription to get updated status
      await loadPrescription();
      setShowRejectForm(false);
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Failed to reject prescription"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssistantSummary = async () => {
    try {
      setAssistantLoading(true);
      setAssistantError(null);
      const response = await getPatientPrescriptionAssistantSummary(prescriptionId);
      setAssistantSummary(response);
    } catch (error: unknown) {
      setAssistantError(getErrorMessage(error, "Failed to load summary"));
    } finally {
      setAssistantLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "routine":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Routine</Badge>;
      case "urgent":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Urgent</Badge>;
      case "emergency":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Emergency</Badge>;
      case "elective":
        return <Badge variant="outline" className="bg-muted/30 text-foreground border-border">Elective</Badge>;
      default:
        return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getMealInstructionText = (instruction: string) => {
    switch (instruction) {
      case "before_meal":
        return "Before Meal";
      case "after_meal":
        return "After Meal";
      case "with_meal":
        return "With Meal";
      case "empty_stomach":
        return "Empty Stomach";
      case "any_time":
        return "Any Time";
      default:
        return instruction;
    }
  };

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto container-padding py-6 pt-(--nav-content-offset) max-w-4xl">
          <PageLoadingShell label="Loading prescription..." cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  if (error && !prescription) {
    return (
      <AppBackground>
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-(--nav-content-offset)">
          <Card className="border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </main>
      </AppBackground>
    );
  }

  if (!prescription) return null;

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />
      
      <main className="container mx-auto container-padding py-6 pt-(--nav-content-offset) max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/patient/prescriptions")}
            className="mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Prescriptions
          </Button>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Prescription Details
              </h1>
              <p className="text-muted-foreground mt-1">
                Prescribed on {new Date(prescription.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleAssistantSummary} disabled={assistantLoading}>
                {assistantLoading ? <ButtonLoader className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Summarize This Prescription
              </Button>
              {getStatusBadge(prescription.status)}
            </div>
          </div>
        </div>

        {(assistantSummary || assistantError) && (
          <Card className="mb-6 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Assistant Explanation
              </CardTitle>
              <CardDescription>
                Plain-language support summary from your prescription records. This does not replace doctor advice.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assistantError ? <p className="text-sm text-destructive">{assistantError}</p> : null}

              {assistantSummary?.plain_text_summary ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <h4 className="text-sm font-semibold text-foreground mb-1">Brief Summary</h4>
                  <p className="text-sm text-foreground leading-relaxed">{assistantSummary.plain_text_summary}</p>
                </div>
              ) : null}

              <PrescriptionVapiVoiceSummary prescriptionId={prescriptionId} />

              {assistantMedicationPlan.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Medication Names and Schedule</h4>
                  <ul className="space-y-1">
                    {assistantMedicationPlan.map((item) => (
                      <li key={`${item.name}-${item.schedule}`} className="text-sm text-foreground">
                        - {item.name}: {item.schedule}
                        {item.quantity !== undefined && item.quantity !== null && item.quantity !== "" ? `, quantity ${item.quantity}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {assistantSummary?.highlight_points?.length ? (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">Key Points</h4>
                  <ul className="space-y-1">
                    {assistantSummary.highlight_points.map((point) => (
                      <li key={point} className="text-sm text-foreground">- {point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {assistantSummary?.summary ? (
                <pre className="text-xs whitespace-pre-wrap rounded-lg bg-muted/40 p-3 border border-border">{JSON.stringify(assistantSummary.summary, null, 2)}</pre>
              ) : null}

              {assistantSummary?.cautions?.length ? (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                  <h4 className="text-sm font-semibold text-foreground mb-2">Helpful Notes</h4>
                  <ul className="space-y-1">
                    {assistantSummary.cautions.map((point) => (
                      <li key={point} className="text-sm text-foreground">- {point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Doctor Info */}
        {prescription.doctor_name && (
          <Card className="mb-6">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                <Image
                  src={resolveAvatarUrl(prescription.doctor_photo, prescription.doctor_name || "doctor")}
                  alt={prescription.doctor_name}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Dr. {prescription.doctor_name}
                </p>
                {prescription.doctor_specialization && (
                  <p className="text-sm text-muted-foreground">
                    {prescription.doctor_specialization}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {prescription.notes && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Prescription Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{prescription.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Prescription Attachments */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Prescription Documents
            </CardTitle>
            <CardDescription>
              Uploaded prescription image/PDF attachments linked by your doctor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {attachmentsLoading ? <p className="text-sm text-muted-foreground">Loading attached documents...</p> : null}

            {!attachmentsLoading && !attachmentsError && attachments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 bg-surface/30 p-4 text-sm text-muted-foreground">
                No prescription document has been attached yet.
              </div>
            ) : null}

            {attachmentsError ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {attachmentsError}
              </div>
            ) : null}

            {attachments.map((attachment) => {
              const attachmentUrl = (attachment.public_url || "").trim();
              const contentType = (attachment.content_type || "").toLowerCase();
              const isPdf = contentType.includes("pdf") || (attachment.file_extension || "").toLowerCase() === "pdf";
              const isImage = contentType.startsWith("image/");
              const displayName = attachment.original_file_name || attachment.file_name;

              return (
                <div key={attachment.id} className="rounded-xl border border-border/70 bg-card/70 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {contentType || "Unknown type"} • {formatAttachmentSize(attachment.file_size)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {attachmentUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={attachmentUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="mr-1 h-4 w-4" />
                            Open
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          <ExternalLink className="mr-1 h-4 w-4" />
                          Open
                        </Button>
                      )}
                      {attachmentUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={attachmentUrl} download={displayName}>
                            <Download className="mr-1 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled>
                          <Download className="mr-1 h-4 w-4" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>

                  {attachmentUrl && isPdf ? (
                    <iframe
                      src={attachmentUrl}
                      title={`Prescription attachment ${displayName}`}
                      className="h-72 w-full rounded-lg border border-border/60 bg-background"
                    />
                  ) : null}

                  {attachmentUrl && isImage ? (
                    <Image
                      src={attachmentUrl}
                      alt={displayName}
                      width={1400}
                      height={1000}
                      className="h-72 w-full rounded-lg border border-border/60 bg-background object-contain"
                      unoptimized
                    />
                  ) : null}

                  {!attachmentUrl ? (
                    <div className="rounded-lg border border-dashed border-border/60 bg-surface/20 p-4 text-xs text-muted-foreground">
                      Attachment link is unavailable.
                    </div>
                  ) : null}

                  {attachmentUrl && !isPdf && !isImage ? (
                    <div className="rounded-lg border border-dashed border-border/60 bg-surface/20 p-4 text-xs text-muted-foreground">
                      Preview is not available for this file type. Use Open or Download.
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Medications */}
        {prescription.medications && prescription.medications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-600" />
                Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.medications.map((med, index) => (
                  <div key={index} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-foreground">{med.medicine_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {med.medicine_type} | {med.strength}
                        </p>
                      </div>
                      {med.quantity && (
                        <Badge variant="outline" className="bg-card">
                          Qty: {med.quantity}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Dosage Schedule */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">Dosage:</span>
                      <div className="flex gap-2">
                        {med.dose_morning && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded text-sm">
                            <Sunrise className="h-3 w-3 text-orange-600" />
                            {med.dose_morning_amount || "Morning"}
                          </div>
                        )}
                        {med.dose_afternoon && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded text-sm">
                            <Sun className="h-3 w-3 text-yellow-600" />
                            {med.dose_afternoon_amount || "Afternoon"}
                          </div>
                        )}
                        {med.dose_evening && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-sm">
                            <Sunset className="h-3 w-3 text-purple-600" />
                            {med.dose_evening_amount || "Evening"}
                          </div>
                        )}
                        {med.dose_night && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded text-sm">
                            <Moon className="h-3 w-3 text-blue-600" />
                            {med.dose_night_amount || "Night"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Duration and Meal Instructions */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {med.duration_value && med.duration_unit && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{med.duration_value} {med.duration_unit}</span>
                        </div>
                      )}
                      {med.meal_instruction && (
                        <div className="flex items-center gap-1">
                          <Utensils className="h-4 w-4 text-muted-foreground" />
                          <span>{getMealInstructionText(med.meal_instruction)}</span>
                        </div>
                      )}
                    </div>

                    {/* Special Instructions */}
                    {med.special_instructions && (
                      <div className="mt-3 p-2 bg-card rounded border border-blue-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Note:</strong> {med.special_instructions}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tests */}
        {prescription.tests && prescription.tests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                Medical Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.tests.map((test, index) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{test.test_name}</h4>
                        <p className="text-sm text-muted-foreground">{test.test_type}</p>
                      </div>
                      {test.urgency && getUrgencyBadge(test.urgency)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      {test.preferred_lab && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{test.preferred_lab}</span>
                        </div>
                      )}
                      {test.expected_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Before {new Date(test.expected_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {test.instructions && (
                      <div className="mt-3 p-2 bg-card rounded border border-purple-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Instructions:</strong> {test.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Surgeries */}
        {prescription.surgeries && prescription.surgeries.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scissors className="h-5 w-5 text-orange-600" />
                Procedures & Surgeries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.surgeries.map((surgery, index) => (
                  <div key={index} className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{surgery.procedure_name}</h4>
                        <p className="text-sm text-muted-foreground">{surgery.procedure_type}</p>
                      </div>
                      {surgery.urgency && getUrgencyBadge(surgery.urgency)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      {surgery.preferred_facility && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{surgery.preferred_facility}</span>
                        </div>
                      )}
                      {surgery.recommended_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Scheduled: {new Date(surgery.recommended_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Cost Estimates */}
                    {(surgery.estimated_cost_min || surgery.estimated_cost_max) && (
                      <div className="flex items-center gap-1 text-sm mb-3">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Estimated Cost: ৳{surgery.estimated_cost_min?.toLocaleString() || "N/A"} 
                          {surgery.estimated_cost_max && ` - ৳${surgery.estimated_cost_max.toLocaleString()}`}
                        </span>
                      </div>
                    )}

                    {surgery.pre_op_instructions && (
                      <div className="mt-3 p-2 bg-card rounded border border-orange-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Pre-operative Instructions:</strong> {surgery.pre_op_instructions}
                        </p>
                      </div>
                    )}

                    {/* Reason for Surgery */}
                    {surgery.reason && (
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Reason:</strong> {surgery.reason}
                        </p>
                      </div>
                    )}

                    {/* Additional Notes */}
                    {surgery.notes && (
                      <div className="mt-3 p-2 bg-muted/30 rounded border border-border">
                        <p className="text-sm text-muted-foreground">
                          <strong>Notes:</strong> {surgery.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejection Reason (if rejected) */}
        {prescription.status === "rejected" && prescription.rejection_reason && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-1">{prescription.rejection_reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons (only for pending prescriptions) */}
        {prescription.status === "pending" && (
          <Card>
            <CardContent className="p-6">
              {!showRejectForm ? (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground mb-4">
                    Please review the prescription carefully before accepting or rejecting.
                  </p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setShowRejectForm(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Prescription
                    </Button>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleAccept}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ButtonLoader className="h-4 w-4 mr-2" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Accept Prescription
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label htmlFor="rejectReason">Reason for Rejection</Label>
                  <Textarea
                    id="rejectReason"
                    placeholder="Please explain why you are rejecting this prescription (e.g., allergies, side effects concern, cost, etc.)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-4 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={actionLoading || !rejectReason.trim()}
                    >
                      {actionLoading ? (
                        <ButtonLoader className="h-4 w-4 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Added to History Indicator */}
        {prescription.added_to_history && (
          <Card className="mt-6 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300">
                This prescription has been added to your medical history.
              </span>
            </CardContent>
          </Card>
        )}
      </main>
    </AppBackground>
  );
}


