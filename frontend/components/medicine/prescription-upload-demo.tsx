"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileImage, FileText, Loader2, Plus, ScanText, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { extractPrescriptionFromImage, PrescriptionExtractionResponse } from "@/lib/file-storage-actions";

type EditableMedication = {
  name: string;
  dosage: string;
  frequency: string;
  quantity: string;
  confidence: number;
};

export function PrescriptionUploadDemo() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [medications, setMedications] = useState<EditableMedication[]>([]);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);

    return () => {
      URL.revokeObjectURL(nextPreviewUrl);
    };
  }, [selectedFile]);

  const canExtract = useMemo(() => {
    return !!selectedFile && !isProcessing;
  }, [selectedFile, isProcessing]);

  const isPdfPreview = useMemo(() => {
    if (!selectedFile) {
      return false;
    }

    return selectedFile.type === "application/pdf" || selectedFile.name.toLowerCase().endsWith(".pdf");
  }, [selectedFile]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setError(null);
    setExtractedText("");
    setConfidence(null);
    setMedications([]);
    setIsApproved(false);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const normalizedType = (file.type || "").toLowerCase();
    const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(normalizedType) && !(hasPdfExtension && !normalizedType)) {
      setError("Please upload a JPG, PNG, WEBP image, or PDF file.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleExtract = async () => {
    if (!selectedFile) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const parsed = await extractPrescriptionFromImage(selectedFile, { saveFile: false });
      const normalizedMedications = normalizeMedications(parsed);
      setMedications(normalizedMedications);
      setExtractedText(buildOrderedExtractedText(parsed, normalizedMedications));
      setConfidence(typeof parsed.confidence === "number" ? parsed.confidence : null);
    } catch (processingError: unknown) {
      if (processingError instanceof Error) {
        setError(processingError.message);
      } else {
        setError("Extraction failed. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const updateMedicationField = (index: number, field: keyof EditableMedication, value: string) => {
    setIsApproved(false);
    setMedications((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const addMedicationRow = () => {
    setIsApproved(false);
    setMedications((previous) => [
      ...previous,
      { name: "", dosage: "", frequency: "", quantity: "", confidence: 0 },
    ]);
  };

  const removeMedicationRow = (index: number) => {
    setIsApproved(false);
    setMedications((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <Card className="overflow-hidden border-border bg-background shadow-sm">
      <CardHeader className="border-b border-border/70 bg-linear-to-r from-primary/8 via-primary/4 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-foreground">
          <ScanText className="h-5 w-5 text-primary" />
          Prescription Upload Demo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a prescription image or PDF to extract readable text for medicine search assistance.
        </p>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <section className="lg:col-span-6">
            <div className="rounded-2xl border border-dashed border-primary/40 bg-surface/50 p-4">
              <label
                htmlFor="prescription-upload"
                className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-5 text-center transition hover:border-primary/60"
              >
                <UploadCloud className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Choose Prescription File</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, or PDF up to 15MB</p>
                </div>
              </label>
              <input
                id="prescription-upload"
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                onChange={onFileChange}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="truncate text-xs text-muted-foreground">
                  {selectedFile ? selectedFile.name : "No file selected"}
                </p>
                <Button
                  type="button"
                  variant="medical"
                  className="h-11 min-w-36"
                  disabled={!canExtract}
                  onClick={handleExtract}
                >
                  {isProcessing ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing
                    </span>
                  ) : (
                    "Extract Text"
                  )}
                </Button>
              </div>
            </div>

            <div className="relative mt-4 min-h-72 overflow-hidden rounded-2xl border border-border bg-muted/20">
              {previewUrl ? (
                <>
                  {isPdfPreview ? (
                    <div className="h-full min-h-72 w-full bg-background p-2">
                      <div className="mb-2 flex items-center gap-2 rounded-md border border-border/60 bg-surface/40 px-3 py-2 text-xs text-muted-foreground">
                        <FileText className="h-4 w-4 text-primary" />
                        PDF preview
                      </div>
                      <iframe
                        src={previewUrl}
                        title="Prescription PDF preview"
                        className="h-80 w-full rounded-md border border-border/60"
                      />
                    </div>
                  ) : (
                    <Image
                      src={previewUrl}
                      alt="Prescription preview"
                      width={1200}
                      height={900}
                      unoptimized
                      className="h-full min-h-72 w-full object-contain bg-background"
                    />
                  )}

                  {isProcessing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-[2px]">
                      <div className="w-56 space-y-2">
                        <div className="h-2 animate-pulse rounded-full bg-primary/35" />
                        <div className="h-2 animate-pulse rounded-full bg-primary/45 [animation-delay:100ms]" />
                        <div className="h-2 animate-pulse rounded-full bg-primary/60 [animation-delay:200ms]" />
                      </div>
                      <div className="flex items-center gap-2 text-sm text-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Reading prescription text...
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                  <FileImage className="h-10 w-10 text-primary/30" />
                  <p className="text-sm">Preview will appear here after upload</p>
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-6">
            <div className="min-h-112 rounded-2xl border border-border bg-background p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">Extracted Text</h3>
                {confidence !== null && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {Math.round(confidence * 100)}% confidence
                  </span>
                )}
              </div>

              {error && (
                <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive-muted">
                  {error}
                </p>
              )}

              {isProcessing ? (
                <div className="space-y-3 pt-2">
                  {[1, 2, 3, 4, 5, 6].map((line) => (
                    <div
                      key={line}
                      className="h-3 animate-pulse rounded-full bg-surface"
                      style={{ width: `${92 - line * 8}%` }}
                    />
                  ))}
                </div>
              ) : extractedText ? (
                <pre className="whitespace-pre-wrap wrap-break-word rounded-xl border border-border/60 bg-surface/30 p-3 text-sm leading-6 text-foreground">
                  {extractedText}
                </pre>
              ) : (
                <div className="flex min-h-60 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 text-center">
                  <ShieldCheck className="h-8 w-8 text-primary/50" />
                  <p className="text-sm text-muted-foreground">
                    Upload and process a prescription image to view extracted text here.
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-border/60 bg-surface/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">Medicine Review (Human Approval)</h4>
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved
                    </span>
                  )}
                </div>

                {medications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No structured medicines detected yet. You can add rows manually after extraction.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {medications.map((medication, index) => (
                      <div key={`${index}-${medication.name}`} className="grid grid-cols-1 gap-2 rounded-lg border border-border/50 bg-background/70 p-2">
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeMedicationRow(index)}
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete medicine row ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={medication.name}
                          onChange={(event) => updateMedicationField(index, "name", event.target.value)}
                          placeholder="Medicine name"
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Input
                            value={medication.dosage}
                            onChange={(event) => updateMedicationField(index, "dosage", event.target.value)}
                            placeholder="Dosage (e.g. 10 mg)"
                          />
                          <Input
                            value={medication.frequency}
                            onChange={(event) => updateMedicationField(index, "frequency", event.target.value)}
                            placeholder="Frequency (e.g. 1+0+1)"
                          />
                          <Input
                            value={medication.quantity}
                            onChange={(event) => updateMedicationField(index, "quantity", event.target.value)}
                            placeholder="Quantity/Duration"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addMedicationRow}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Medicine Row
                  </Button>
                  <Button
                    type="button"
                    variant="medical"
                    size="sm"
                    onClick={() => setIsApproved(true)}
                    disabled={medications.length === 0}
                  >
                    Approve Structured List
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}

function normalizeMedications(parsed: PrescriptionExtractionResponse): EditableMedication[] {
  return (parsed.medications || []).map((medication) => ({
    name: medication.name || "",
    dosage: medication.dosage || "",
    frequency: medication.frequency || "",
    quantity: medication.quantity || "",
    confidence: typeof medication.confidence === "number" ? medication.confidence : 0,
  }));
}

function buildOrderedExtractedText(
  parsed: PrescriptionExtractionResponse,
  medications: EditableMedication[]
): string {
  if (medications.length > 0) {
    return medications
      .map((medication, index) => {
        const header = `${index + 1}. ${medication.name || "Unknown Medicine"}`;
        const details = [
          medication.dosage ? `   Dosage: ${medication.dosage}` : null,
          medication.frequency ? `   Frequency: ${medication.frequency}` : null,
          medication.quantity ? `   Quantity: ${medication.quantity}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        return [header, details].filter(Boolean).join("\n");
      })
      .join("\n\n");
  }

  const fallbackText = (parsed.raw_text || parsed.extracted_text || "").trim();
  return fallbackText || "No readable text detected.";
}
