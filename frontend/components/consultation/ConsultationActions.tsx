"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, ShieldCheck, ShieldX, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runConsultationSafetyCheck, type SafetyCheckResponse } from "@/lib/ai-consultation-actions";
import { ButtonLoader } from "@/components/ui/medora-loader";

interface ConsultationActionsProps {
  consultationId: string;
  notes: string;
  plannedMedications: string[];
  allergies: string[];
  onGeneratePrescription: () => Promise<void> | void;
  onEndConsultation: () => Promise<void> | void;
  generatingPrescription: boolean;
  endingConsultation: boolean;
}

export function ConsultationActions({
  consultationId,
  notes,
  plannedMedications,
  allergies,
  onGeneratePrescription,
  onEndConsultation,
  generatingPrescription,
  endingConsultation,
}: ConsultationActionsProps) {
  const [runningSafetyCheck, setRunningSafetyCheck] = React.useState(false);
  const [safetyResult, setSafetyResult] = React.useState<SafetyCheckResponse | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");

  const runSafetyCheck = async () => {
    setRunningSafetyCheck(true);
    try {
      const result = await runConsultationSafetyCheck(consultationId, {
        notes,
        planned_medications: plannedMedications,
        allergies,
      });
      setSafetyResult(result);
      setDialogOpen(true);
    } catch {
      setSafetyResult({
        status: "warning",
        issues: ["Safety check service is unavailable. Proceed carefully and verify manually."],
        override_required: true,
      });
      setDialogOpen(true);
    } finally {
      setRunningSafetyCheck(false);
    }
  };

  const canProceed =
    safetyResult?.status !== "blocked" &&
    (safetyResult?.status !== "warning" || overrideReason.trim().length >= 10);

  const handleGeneratePrescription = async () => {
    if (safetyResult?.status === "blocked") {
      setDialogOpen(true);
      return;
    }
    if (safetyResult?.status === "warning" && overrideReason.trim().length < 10) {
      setDialogOpen(true);
      return;
    }
    await onGeneratePrescription();
  };

  const handleEndConsultation = async () => {
    if (safetyResult?.status === "blocked") {
      setDialogOpen(true);
      return;
    }
    if (safetyResult?.status === "warning" && overrideReason.trim().length < 10) {
      setDialogOpen(true);
      return;
    }
    await onEndConsultation();
  };

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-background/95 backdrop-blur-md">
        <div className="page-main !pt-4 !pb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <Button
            variant="outline"
            className="w-full sm:w-auto border-warning/40 bg-warning/20 text-warning-foreground hover:bg-warning/30"
            onClick={runSafetyCheck}
            disabled={runningSafetyCheck}
          >
            {runningSafetyCheck ? <ButtonLoader className="mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
            Run Safety Check
          </Button>

          <Button
            variant="medical"
            className="w-full sm:w-auto"
            onClick={handleGeneratePrescription}
            disabled={generatingPrescription || (safetyResult?.status === "blocked")}
          >
            {generatingPrescription ? <ButtonLoader className="mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Generate Prescription
          </Button>

          <Button
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={handleEndConsultation}
            disabled={endingConsultation || (safetyResult?.status === "blocked")}
          >
            {endingConsultation ? <ButtonLoader className="mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
            End Consultation
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {safetyResult?.status === "safe" ? (
                <ShieldCheck className="h-5 w-5 text-success" />
              ) : safetyResult?.status === "warning" ? (
                <AlertTriangle className="h-5 w-5 text-warning" />
              ) : (
                <ShieldX className="h-5 w-5 text-destructive" />
              )}
              Safety Check Result
            </DialogTitle>
            <DialogDescription>
              {safetyResult?.status === "safe"
                ? "SAFE: No blocking issues detected."
                : safetyResult?.status === "warning"
                  ? "WARNING: Review issues before continuing."
                  : "BLOCKED: Resolve safety conflicts before proceeding."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {safetyResult?.issues?.length ? (
              <ul className="space-y-2">
                {safetyResult.issues.map((issue) => (
                  <li key={issue} className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm">
                    {issue}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No issues detected.</p>
            )}

            {safetyResult?.status === "warning" ? (
              <div className="space-y-2">
                <Label>Override reason (required to proceed)</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={3}
                  placeholder="Document your clinical reasoning for override..."
                />
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button
              variant="medical"
              onClick={() => setDialogOpen(false)}
              disabled={!canProceed && safetyResult?.status !== "safe"}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
