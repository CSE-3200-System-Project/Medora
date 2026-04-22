"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileImage, FileText, Gauge, Plus, ScanText, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { useT } from "@/i18n/client";
import { extractPrescriptionFromImage, PrescriptionExtractionResponse, PrescriptionOCRMeta } from "@/lib/file-storage-actions";

type EditableMedication = {
  name: string;
  dosage: string;
  frequency: string;
  quantity: string;
  confidence: number;
};

type PrescriptionUploadDemoProps = {
  onApproveMedications?: (medications: EditableMedication[]) => Promise<void> | void;
  enableProfileSave?: boolean;
};

export function PrescriptionUploadDemo({
  onApproveMedications,
  enableProfileSave = false,
}: PrescriptionUploadDemoProps) {
  const tCommon = useT("common");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSavingApproved, setIsSavingApproved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [meta, setMeta] = useState<PrescriptionOCRMeta | null>(null);
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
    setMeta(null);
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
      setError(tCommon("medicine.uploadDemo.invalidFile"));
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
      setExtractedText(
        buildOrderedExtractedText(parsed, normalizedMedications, {
          unknownMedicine: tCommon("medicine.uploadDemo.unknownMedicine"),
          dosageLabel: tCommon("medicine.uploadDemo.dosageLabel"),
          frequencyLabel: tCommon("medicine.uploadDemo.frequencyLabel"),
          quantityLabel: tCommon("medicine.uploadDemo.quantityLabel"),
          noReadable: tCommon("medicine.uploadDemo.noReadable"),
        }),
      );
      setConfidence(typeof parsed.confidence === "number" ? parsed.confidence : null);
      setMeta(parsed.meta ?? null);
    } catch (processingError: unknown) {
      if (processingError instanceof Error) {
        setError(processingError.message);
      } else {
        setError(tCommon("medicine.uploadDemo.extractionFailed"));
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

  const handleApprove = async () => {
    if (medications.length === 0 || isSavingApproved) {
      return;
    }

    setError(null);
    setIsSavingApproved(true);

    try {
      if (onApproveMedications) {
        await onApproveMedications(medications);
      }
      setIsApproved(true);
    } catch (saveError: unknown) {
      if (saveError instanceof Error && saveError.message.trim()) {
        setError(saveError.message);
      } else {
        setError("Failed to save approved medicines.");
      }
    } finally {
      setIsSavingApproved(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border bg-background shadow-sm">
      <CardHeader className="border-b border-border/70 bg-linear-to-r from-primary/8 via-primary/4 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-foreground">
          <ScanText className="h-5 w-5 text-primary" />
          {tCommon("medicine.uploadDemo.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {tCommon("medicine.uploadDemo.subtitle")}
        </p>
      </CardHeader>

      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-6">
          <section className="lg:col-span-6">
            <div className="rounded-2xl border border-dashed border-primary/40 bg-surface/50 p-4">
              <div className="flex min-h-44 flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-5 text-center">
                <UploadCloud className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">{tCommon("medicine.uploadDemo.chooseFile")}</p>
                  <p className="text-xs text-muted-foreground">{tCommon("medicine.uploadDemo.fileHint")}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing || isSavingApproved}
                  >
                    Upload File
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isProcessing || isSavingApproved}
                  >
                    Take Photo
                  </Button>
                </div>
              </div>
              <input
                ref={fileInputRef}
                id="prescription-upload"
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
                onChange={onFileChange}
              />
              <input
                ref={cameraInputRef}
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                capture="environment"
                onChange={onFileChange}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="truncate text-xs text-muted-foreground">
                  {selectedFile ? selectedFile.name : tCommon("medicine.uploadDemo.noFileSelected")}
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
                      <ButtonLoader className="h-4 w-4" />
                      {tCommon("medicine.uploadDemo.processing")}
                    </span>
                  ) : (
                    tCommon("medicine.uploadDemo.extractText")
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
                        {tCommon("medicine.uploadDemo.pdfPreview")}
                      </div>
                      <iframe
                        src={previewUrl}
                        title={tCommon("medicine.uploadDemo.pdfPreview")}
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
                        <ButtonLoader className="h-4 w-4 text-primary" />
                        {tCommon("medicine.uploadDemo.readingText")}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex min-h-72 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
                  <FileImage className="h-10 w-10 text-primary/30" />
                  <p className="text-sm">{tCommon("medicine.uploadDemo.previewPlaceholder")}</p>
                </div>
              )}
            </div>
          </section>

          <section className="lg:col-span-6">
            <div className="min-h-112 rounded-2xl border border-border bg-background p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{tCommon("medicine.uploadDemo.extractedText")}</h3>
                {confidence !== null && (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {tCommon("medicine.uploadDemo.confidence", { count: Math.round(confidence * 100) })}
                  </span>
                )}
              </div>

              {meta && (
                <div className="mb-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                      AI Model Transparency
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <MetaStat label="YOLO detector" value={formatConfidenceRange(meta.yolo_avg_confidence, meta.yolo_min_confidence, meta.yolo_max_confidence)} />
                    <MetaStat label="Azure DI (OCR)" value={formatConfidenceRange(meta.ocr_avg_confidence, meta.ocr_min_confidence, meta.ocr_max_confidence)} />
                    <MetaStat label="Regions detected" value={String(meta.detected_regions)} />
                    <MetaStat label="OCR lines" value={String(meta.ocr_line_count)} />
                    <MetaStat label="Model" value={meta.model} />
                    <MetaStat label="Latency" value={`${meta.processing_time_ms} ms`} />
                  </div>
                </div>
              )}

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
                    {tCommon("medicine.uploadDemo.uploadToView")}
                  </p>
                </div>
              )}

              <div className="mt-4 rounded-xl border border-border/60 bg-surface/20 p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{tCommon("medicine.uploadDemo.reviewTitle")}</h4>
                  {isApproved && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {tCommon("medicine.uploadDemo.approved")}
                    </span>
                  )}
                </div>

                {medications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {tCommon("medicine.uploadDemo.noStructured")}
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
                            aria-label={tCommon("medicine.uploadDemo.deleteRow", { count: index + 1 })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <Input
                          value={medication.name}
                          onChange={(event) => updateMedicationField(index, "name", event.target.value)}
                          placeholder={tCommon("medicine.uploadDemo.medicineName")}
                        />
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <Input
                            value={medication.dosage}
                            onChange={(event) => updateMedicationField(index, "dosage", event.target.value)}
                            placeholder={tCommon("medicine.uploadDemo.dosagePlaceholder")}
                          />
                          <Input
                            value={medication.frequency}
                            onChange={(event) => updateMedicationField(index, "frequency", event.target.value)}
                            placeholder={tCommon("medicine.uploadDemo.frequencyPlaceholder")}
                          />
                          <Input
                            value={medication.quantity}
                            onChange={(event) => updateMedicationField(index, "quantity", event.target.value)}
                            placeholder={tCommon("medicine.uploadDemo.quantityPlaceholder")}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={addMedicationRow}>
                    <Plus className="mr-1 h-4 w-4" />
                    {tCommon("medicine.uploadDemo.addRow")}
                  </Button>
                  <Button
                    type="button"
                    variant="medical"
                    size="sm"
                    onClick={handleApprove}
                    disabled={medications.length === 0 || isSavingApproved}
                  >
                    {isSavingApproved ? (
                      <span className="inline-flex items-center gap-2">
                        <ButtonLoader className="h-4 w-4" />
                        Saving...
                      </span>
                    ) : enableProfileSave ? (
                      "Approve & Add to Profile"
                    ) : (
                      tCommon("medicine.uploadDemo.approveList")
                    )}
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

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/50 bg-background/60 px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatConfidenceRange(
  avg: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (typeof avg !== "number") {
    return "N/A";
  }
  const pct = (value: number) => `${Math.round(value * 100)}%`;
  if (typeof min === "number" && typeof max === "number" && (min !== avg || max !== avg)) {
    return `${pct(avg)} avg (${pct(min)}–${pct(max)})`;
  }
  return pct(avg);
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
  medications: EditableMedication[],
  labels: {
    unknownMedicine: string;
    dosageLabel: string;
    frequencyLabel: string;
    quantityLabel: string;
    noReadable: string;
  }
): string {
  const formatValueLabel = (template: string, value: string) =>
    template.replace("{value}", value);

  if (medications.length > 0) {
    return medications
      .map((medication, index) => {
        const header = `${index + 1}. ${medication.name || labels.unknownMedicine}`;
        const details = [
          medication.dosage ? `   ${formatValueLabel(labels.dosageLabel, medication.dosage)}` : null,
          medication.frequency ? `   ${formatValueLabel(labels.frequencyLabel, medication.frequency)}` : null,
          medication.quantity ? `   ${formatValueLabel(labels.quantityLabel, medication.quantity)}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        return [header, details].filter(Boolean).join("\n");
      })
      .join("\n\n");
  }

  const fallbackText = (parsed.raw_text || parsed.extracted_text || "").trim();
  return fallbackText || labels.noReadable;
}
