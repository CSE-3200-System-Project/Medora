"use client";

import React from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/medora-loader";
import type { FullPrescriptionResponse } from "@/lib/prescription-actions";

type FetchState = "idle" | "loading" | "success" | "error";

function formatDateTime(value?: string) {
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildDigitalHash(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }

  return `MDR-${Math.abs(hash).toString(16).toUpperCase().padStart(8, "0")}`;
}

export default function PrescriptionPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const consultationId = String(params.consultation_id || "");
  const draftId = searchParams.get("draft_id") || "";

  const [state, setState] = React.useState<FetchState>("idle");
  const [error, setError] = React.useState<string>("");
  const [data, setData] = React.useState<FullPrescriptionResponse | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = React.useState(false);

  React.useEffect(() => {
    if (!consultationId) {
      setError("Invalid consultation ID");
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
            "Failed to load prescription preview";
          throw new Error(message);
        }

        if (!mounted) return;

        setData(json as FullPrescriptionResponse);
        setState("success");
      } catch (err) {
        if (!mounted) return;

        const message = err instanceof Error ? err.message : "Failed to load prescription preview";
        setError(message);
        setState("error");
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [consultationId, draftId]);

  const handlePrint = React.useCallback(() => {
    window.print();
  }, []);

  const handleDownloadPdf = React.useCallback(async () => {
    const paper = document.getElementById("prescription-paper");
    if (!paper) return;

    try {
      setIsDownloadingPdf(true);
      const html2pdfModule = await import("html2pdf.js");
      const html2pdf = html2pdfModule.default || html2pdfModule;

      await html2pdf()
        .set({
          margin: 0,
          filename: `prescription-${consultationId}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "mm",
            format: "a4",
            orientation: "portrait",
          },
        })
        .from(paper)
        .save();
    } catch (err) {
      console.error("Failed to generate PDF", err);
      setError("Failed to generate PDF. Please try again.");
      setState("error");
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [consultationId]);

  const prescriptionDate = data?.consultation?.date;
  const digitalHash = buildDigitalHash(`${consultationId}:${prescriptionDate || ""}`);

  return (
    <div className="min-h-dvh bg-[#dfe3e8] px-2 py-4 sm:px-6 sm:py-6 print:bg-white print:p-0">
      <div className="preview-actions mx-auto mb-4 flex w-full max-w-[210mm] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => router.back()} className="w-full sm:w-auto">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" />
            Print Document
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf || state !== "success"}
            className="w-full sm:w-auto"
          >
            {isDownloadingPdf ? <ButtonLoader className="mr-2" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
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
            {error || "Failed to load prescription preview"}
          </div>
        ) : null}

        {state === "success" && data ? (
          <div className="space-y-6 print:space-y-4">
            <header className="flex flex-col gap-4 border-b border-[#d0d5dd] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-2xl font-semibold tracking-tight text-[#0a4cc5]">Medora Clinical</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.24em] text-[#344054]">
                  Advanced Medical Systems
                </p>
              </div>
              <div className="text-left sm:max-w-[300px] sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#101828]">Provider Chamber</p>
                <p className="mt-1 text-sm font-medium text-[#101828]">{data.doctor.name}</p>
                {data.doctor.chamber_info ? <p className="text-xs text-[#475467]">{data.doctor.chamber_info}</p> : null}
                {data.doctor.address && data.doctor.address !== data.doctor.chamber_info ? (
                  <p className="text-xs text-[#475467]">{data.doctor.address}</p>
                ) : null}
                {data.doctor.phone ? <p className="text-xs text-[#475467]">Contact: {data.doctor.phone}</p> : null}
              </div>
            </header>

            <section className="border border-[#d0d5dd] bg-[#f9fafb] px-4 py-2 text-center">
              <h1 className="text-base font-semibold uppercase tracking-[0.3em] text-[#101828]">Clinical Prescription</h1>
            </section>

            <section className="grid grid-cols-1 gap-4 border-b border-[#d0d5dd] pb-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a4cc5]">Patient Information</p>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {data.patient.name}</p>
                  <p><span className="font-medium">Patient ID:</span> {data.patient.patient_id}</p>
                  <p><span className="font-medium">Age / Gender:</span> {data.patient.age ?? "N/A"} / {data.patient.gender || "N/A"}</p>
                  <p><span className="font-medium">Blood Group:</span> {data.patient.blood_group || "N/A"}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0a4cc5]">Provider Information</p>
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Practitioner:</span> {data.doctor.name}</p>
                  <p><span className="font-medium">Qualification:</span> {data.doctor.qualification || "N/A"}</p>
                  <p><span className="font-medium">Specialization:</span> {data.doctor.specialization || "N/A"}</p>
                  <p><span className="font-medium">Reg. No:</span> {data.doctor.registration_number || "N/A"}</p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <p className="text-sm font-semibold text-[#101828]">Prescribed Medications</p>
              <div className="overflow-x-auto border border-[#d0d5dd]">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="bg-[#f2f4f7] text-left text-[11px] uppercase tracking-[0.08em] text-[#475467]">
                      <th className="px-3 py-2 font-semibold">Medicine Name + Strength</th>
                      <th className="px-3 py-2 font-semibold">Dosage</th>
                      <th className="px-3 py-2 font-semibold">Route</th>
                      <th className="px-3 py-2 font-semibold">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.medications.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-sm text-[#667085]" colSpan={4}>
                          No medications prescribed.
                        </td>
                      </tr>
                    ) : (
                      data.medications.map((medication, index) => (
                        <tr key={`${medication.medicine_name}-${index}`} className="border-t border-[#eaecf0] text-sm">
                          <td className="px-3 py-3">
                            <p className="font-medium text-[#101828]">
                              {medication.medicine_name}{medication.strength ? ` ${medication.strength}` : ""}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            {medication.dosage_pattern || medication.frequency_text || "As directed"}
                          </td>
                          <td className="px-3 py-3">
                            <p>{medication.route || "As directed"}</p>
                            {medication.meal_instruction ? (
                              <p className="text-xs text-[#667085]">{medication.meal_instruction}</p>
                            ) : null}
                          </td>
                          <td className="px-3 py-3">
                            <p>{medication.duration || "As advised"}</p>
                            {typeof medication.quantity === "number" ? (
                              <p className="text-xs text-[#667085]">Qty: {medication.quantity}</p>
                            ) : null}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="border border-[#d0d5dd] p-3">
                <p className="mb-2 text-sm font-semibold text-[#101828]">Laboratory Investigations</p>
                {data.tests.length === 0 ? (
                  <p className="text-sm text-[#667085]">No tests requested.</p>
                ) : (
                  <div className="space-y-2">
                    {data.tests.map((test, index) => (
                      <div key={`${test.test_name}-${index}`} className="rounded-sm border border-[#eaecf0] px-2 py-1.5 text-sm">
                        <p className="font-medium">{test.test_name}</p>
                        {test.urgency ? <p className="text-xs uppercase tracking-[0.05em] text-[#b42318]">{test.urgency}</p> : null}
                        {test.instructions ? <p className="text-xs text-[#667085]">{test.instructions}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border border-[#d0d5dd] p-3">
                <p className="mb-2 text-sm font-semibold text-[#101828]">Scheduled Procedures</p>
                {data.procedures.length === 0 ? (
                  <p className="text-sm text-[#667085]">No procedures advised.</p>
                ) : (
                  <div className="space-y-2">
                    {data.procedures.map((procedure, index) => (
                      <div key={`${procedure.procedure_name}-${index}`} className="rounded-sm border border-[#eaecf0] px-2 py-1.5 text-sm">
                        <p className="font-medium">{procedure.procedure_name}</p>
                        {procedure.urgency ? <p className="text-xs uppercase tracking-[0.05em] text-[#b42318]">{procedure.urgency}</p> : null}
                        {procedure.notes ? <p className="text-xs text-[#667085]">{procedure.notes}</p> : null}
                        {procedure.reason ? <p className="text-xs text-[#667085]">{procedure.reason}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="border border-[#d0d5dd] p-3">
              <p className="mb-2 text-sm font-semibold text-[#101828]">Clinical Observations and Notes</p>
              <div className="space-y-1 text-sm leading-6 text-[#344054]">
                <p><span className="font-medium">Chief Complaint:</span> {data.consultation.chief_complaint || "N/A"}</p>
                <p><span className="font-medium">Diagnosis:</span> {data.consultation.diagnosis || "N/A"}</p>
                <p><span className="font-medium">Notes:</span> {data.consultation.notes || "N/A"}</p>
              </div>
            </section>

            <footer className="border-t border-[#d0d5dd] pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#475467]">Digital Authentication Hash</p>
                  <p className="mt-1 inline-block rounded border border-[#eaecf0] bg-[#f9fafb] px-2 py-1 text-[11px] text-[#344054]">
                    {digitalHash}
                  </p>
                  <p className="mt-2 text-[11px] text-[#667085]">
                    Generated via Medora Clinical EMR. Timestamp: {formatDateTime(data.consultation.date)}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  {data.doctor.signature_url ? (
                    <Image
                      src={data.doctor.signature_url}
                      alt="Doctor signature"
                      width={180}
                      height={48}
                      className="mx-0 h-12 w-auto object-contain sm:ml-auto"
                      unoptimized
                    />
                  ) : (
                    <div className="h-12" />
                  )}
                  <p className="text-sm font-semibold text-[#101828]">{data.doctor.name}</p>
                  <p className="text-xs text-[#667085]">Physician Signature and Stamp</p>
                  <p className="text-xs text-[#667085]">Print Date: {formatDateTime(new Date().toISOString())}</p>
                </div>
              </div>
            </footer>
          </div>
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
