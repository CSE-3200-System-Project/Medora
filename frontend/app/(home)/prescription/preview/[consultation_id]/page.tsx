"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/medora-loader";
import type { FullPrescriptionResponse } from "@/lib/prescription-actions";
import { buildClinicalPrescriptionDocumentHtml } from "@/lib/clinical-prescription-document";
import { downloadPrescriptionPdfFromElement } from "@/lib/prescription-document-export";
import { useT } from "@/i18n/client";

type FetchState = "idle" | "loading" | "success" | "error";

export default function PrescriptionPreviewPage() {
  const tPrescription = useT("prescription");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationId = String(params.consultation_id || "");
  const draftId = searchParams.get("draft_id") || "";

  const [state, setState] = React.useState<FetchState>("idle");
  const [error, setError] = React.useState<string>("");
  const [data, setData] = React.useState<FullPrescriptionResponse | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);
  const [previewGeneratedAt] = React.useState(() => new Date().toISOString());

  React.useEffect(() => {
    if (!consultationId) {
      setError(tPrescription("invalidConsultationId"));
      setState("error");
      return;
    }

    let mounted = true;

    const loadData = async () => {
      try {
        setState("loading");
        setError("");

        const url = draftId
          ? `/api/consultations/${consultationId}/full?draft_id=${encodeURIComponent(draftId)}`
          : `/api/consultations/${consultationId}/full`;

        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
        });

        const json = (await response.json().catch(() => null)) as
          | FullPrescriptionResponse
          | { detail?: string; error?: string }
          | null;

        if (!response.ok) {
          const message =
            (json && "detail" in json && typeof json.detail === "string" && json.detail) ||
            (json && "error" in json && typeof json.error === "string" && json.error) ||
            tPrescription("loadPreviewFailed");
          throw new Error(message);
        }

        if (!mounted) return;

        setData(json as FullPrescriptionResponse);
        setState("success");
      } catch (err) {
        if (!mounted) return;

        const message = err instanceof Error ? err.message : tPrescription("loadPreviewFailed");
        setError(message);
        setState("error");
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [consultationId, draftId, tPrescription]);

  const handlePrint = React.useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = React.useCallback(async () => {
    const paper = document.getElementById("prescription-paper");
    if (!paper) return;

    try {
      setIsDownloadingPdf(true);
      await downloadPrescriptionPdfFromElement(paper, `prescription-${consultationId}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF", err);
      setError(tPrescription("generatePdfFailed"));
      setState("error");
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [consultationId, tPrescription]);

  const documentHtml = React.useMemo(() => {
    if (!data) return "";
    return buildClinicalPrescriptionDocumentHtml(data, {
      consultationId,
      generatedAtIso: data.snapshot_generated_at || previewGeneratedAt,
      labels: {
        brandSub: tPrescription("document.brandSub"),
        providerChamber: tPrescription("document.providerChamber"),
        contact: tPrescription("document.contact"),
        title: tPrescription("document.title"),
        patientInformation: tPrescription("document.patientInformation"),
        providerInformation: tPrescription("document.providerInformation"),
        name: tPrescription("document.name"),
        patientId: tPrescription("document.patientId"),
        ageGender: tPrescription("document.ageGender"),
        bloodGroup: tPrescription("document.bloodGroup"),
        practitioner: tPrescription("document.practitioner"),
        qualification: tPrescription("document.qualification"),
        specialization: tPrescription("document.specialization"),
        registrationNumber: tPrescription("document.registrationNumber"),
        prescribedMedications: tPrescription("document.prescribedMedications"),
        medicineStrength: tPrescription("document.medicineStrength"),
        dosage: tPrescription("document.dosage"),
        route: tPrescription("document.route"),
        duration: tPrescription("document.duration"),
        laboratoryInvestigations: tPrescription("document.laboratoryInvestigations"),
        scheduledProcedures: tPrescription("document.scheduledProcedures"),
        clinicalObservations: tPrescription("document.clinicalObservations"),
        chiefComplaint: tPrescription("document.chiefComplaint"),
        diagnosis: tPrescription("document.diagnosis"),
        notes: tPrescription("document.notes"),
        digitalHash: tPrescription("document.digitalHash"),
        generatedVia: tPrescription("document.generatedVia"),
        physicianSign: tPrescription("document.physicianSign"),
        printDate: tPrescription("document.printDate"),
        qty: tPrescription("document.qty"),
        noMedication: tPrescription("document.noMedication"),
        noTests: tPrescription("document.noTests"),
        noProcedures: tPrescription("document.noProcedures"),
        asDirected: tPrescription("document.asDirected"),
        asAdvised: tPrescription("document.asAdvised"),
        na: tPrescription("document.na"),
      },
    });
  }, [consultationId, data, previewGeneratedAt, tPrescription]);

  return (
    <div className="min-h-dvh bg-[#dfe3e8] px-2 py-4 sm:px-6 sm:py-6 print:bg-white print:p-0">
      <div className="preview-actions mx-auto mb-4 flex w-full max-w-[210mm] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tPrescription("back")}
        </Button>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            {tPrescription("printDocument")}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || state !== "success"}
            className="w-full sm:w-auto"
          >
            {isDownloadingPdf ? <ButtonLoader className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
            {tPrescription("downloadPdf")}
          </Button>
        </div>
      </div>

      <div
        id="prescription-paper"
        className="mx-auto w-full max-w-[210mm] bg-white px-4 py-6 text-[#101828] shadow-[0_24px_48px_rgba(15,23,42,0.18)] sm:px-8 sm:py-10 print:max-w-none print:shadow-none"
      >
        {state === "loading" ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <ButtonLoader />
          </div>
        ) : null}

        {state === "error" ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error || tPrescription("loadPreviewFailed")}
          </div>
        ) : null}

        {state === "success" && data ? (
          <div dangerouslySetInnerHTML={{ __html: documentHtml }} />
        ) : null}
      </div>

      <style jsx global>{`
        @media print {
          .preview-actions {
            display: none !important;
          }

          html,
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #prescription-paper {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
          }

          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
