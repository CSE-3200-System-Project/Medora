"use client";

import React from "react";
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
  acceptPrescription,
  rejectPrescription,
  Prescription,
} from "@/lib/prescription-actions";
import { buildClinicalPrescriptionDocumentHtml } from "@/lib/clinical-prescription-document";
import { downloadPrescriptionPdfFromElement } from "@/lib/prescription-document-export";
import {
  getPatientPrescriptionAssistantSummary,
  type PatientPrescriptionAssistantSummaryResponse,
} from "@/lib/ai-consultation-actions";
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Download,
  Printer,
} from "lucide-react";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { PrescriptionVapiVoiceSummary } from "@/components/ai/prescription-vapi-voice-summary";

type AssistantMedicationPlanItem = {
  name: string;
  schedule: string;
  quantity: string | number | null;
};

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
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
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  const prescriptionDocumentHtml = React.useMemo(() => {
    if (!prescription) return "";

    if (prescription.rendered_prescription_html?.trim()) {
      return prescription.rendered_prescription_html;
    }

    if (prescription.rendered_prescription_snapshot) {
      return buildClinicalPrescriptionDocumentHtml(prescription.rendered_prescription_snapshot, {
        consultationId: prescription.consultation_id,
        generatedAtIso: prescription.rendered_prescription_generated_at,
      });
    }

    return "";
  }, [prescription]);

  const assistantMedicationPlan = React.useMemo<AssistantMedicationPlanItem[]>(() => {
    const rawPlan = assistantSummary?.summary?.["medication_plan"];
    if (!Array.isArray(rawPlan)) {
      return [];
    }

    return rawPlan
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const payload = item as Record<string, unknown>;
        const name = typeof payload.name === "string" ? payload.name.trim() : "";
        const schedule = typeof payload.schedule === "string" ? payload.schedule.trim() : "";
        if (!name || !schedule) {
          return null;
        }

        const quantity =
          typeof payload.quantity === "number" || typeof payload.quantity === "string"
            ? payload.quantity
            : null;

        return { name, schedule, quantity };
      })
      .filter((item): item is AssistantMedicationPlanItem => item !== null);
  }, [assistantSummary]);

  const loadPrescription = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPatientPrescription(prescriptionId);
      setPrescription(data);
    } catch (err: unknown) {
      console.error("Failed to load prescription:", err);
      setError(resolveErrorMessage(err, "Failed to load prescription"));
    } finally {
      setLoading(false);
    }
  }, [prescriptionId]);

  React.useEffect(() => {
    void loadPrescription();
  }, [loadPrescription]);

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await acceptPrescription(prescriptionId);
      await loadPrescription();
    } catch (err: unknown) {
      setError(resolveErrorMessage(err, "Failed to accept prescription"));
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
      await loadPrescription();
      setShowRejectForm(false);
    } catch (err: unknown) {
      setError(resolveErrorMessage(err, "Failed to reject prescription"));
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
    } catch (err: unknown) {
      setAssistantError(resolveErrorMessage(err, "Failed to load summary"));
    } finally {
      setAssistantLoading(false);
    }
  };

  const handlePrintDocument = React.useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = React.useCallback(async () => {
    const paper = document.getElementById("patient-prescription-paper");
    if (!paper) return;

    try {
      setIsDownloadingPdf(true);
      await downloadPrescriptionPdfFromElement(paper, `prescription-${prescriptionId}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [prescriptionId]);

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

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="container mx-auto container-padding py-6 pt-(--nav-content-offset) max-w-5xl">
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

      <main className="container mx-auto container-padding py-6 pt-(--nav-content-offset) max-w-5xl space-y-6">
        <div className="prescription-page-chrome">
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
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button variant="outline" onClick={handleAssistantSummary} disabled={assistantLoading}>
                {assistantLoading ? <ButtonLoader className="h-4 w-4 mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
                Summarize This Prescription
              </Button>
              {prescriptionDocumentHtml ? (
                <Button variant="outline" onClick={handlePrintDocument}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
              ) : null}
              {prescriptionDocumentHtml ? (
                <Button variant="outline" onClick={handleDownloadPdf} disabled={isDownloadingPdf}>
                  {isDownloadingPdf ? <ButtonLoader className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                  Download PDF
                </Button>
              ) : null}
              {getStatusBadge(prescription.status)}
            </div>
          </div>
        </div>

        {(assistantSummary || assistantError) && (
          <Card className="border-primary/20 prescription-page-chrome">
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
                <pre className="text-xs whitespace-pre-wrap rounded-lg bg-muted/40 p-3 border border-border">
                  {JSON.stringify(assistantSummary.summary, null, 2)}
                </pre>
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

        {error ? (
          <Card className="border-destructive prescription-page-chrome">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </CardContent>
          </Card>
        ) : null}

        {prescriptionDocumentHtml ? (
          <Card className="overflow-hidden print:border-0 print:shadow-none">
            <CardContent className="p-0">
              <div
                id="patient-prescription-paper"
                className="bg-[#dfe3e8] p-2 sm:p-4 print:bg-white print:p-0"
                dangerouslySetInnerHTML={{ __html: prescriptionDocumentHtml }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-200 prescription-page-chrome">
            <CardContent className="p-4">
              <p className="text-sm text-amber-700">
                This prescription does not have a rendered document snapshot yet.
              </p>
            </CardContent>
          </Card>
        )}

        {prescription.status === "rejected" && prescription.rejection_reason ? (
          <Card className="border-red-200 prescription-page-chrome">
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
        ) : null}

        {prescription.status === "pending" ? (
          <Card className="prescription-page-chrome">
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
        ) : null}

        {prescription.added_to_history ? (
          <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 prescription-page-chrome">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300">
                This prescription has been added to your medical history.
              </span>
            </CardContent>
          </Card>
        ) : null}
      </main>

      <style jsx global>{`
        @media print {
          .prescription-page-chrome,
          nav,
          button {
            display: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #patient-prescription-paper {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
          }
        }
      `}</style>
    </AppBackground>
  );
}
