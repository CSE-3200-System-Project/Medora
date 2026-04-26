"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileImage,
  FileText,
  Gauge,
  Plus,
  RefreshCw,
  ScanText,
  Search,
  ShieldCheck,
  Sun,
  Cloud,
  Moon,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/client";
import {
  extractPrescriptionFromImage,
  PrescriptionExtractionResponse,
  PrescriptionOCRMeta,
} from "@/lib/file-storage-actions";
import { matchMedicineFromText, searchMedicines, type MedicineResult } from "@/lib/medicine-actions";
import {
  buildFrequencyFromDoseSchedule,
  parseDoseScheduleFromFrequency,
  normalizeDoseAmount,
  type DoseSchedule,
} from "@/lib/patient-medication";

/**
 * One reviewable row built from an OCR extraction. Carries the original OCR
 * fragments alongside the resolved DB record (when matching succeeded) and the
 * structured dose schedule that mirrors the manual add-medication dialog.
 */
export type EditableMedication = {
  // Original OCR scrap — kept so callers can fall back when no DB match.
  name: string;
  dosage: string;
  frequency: string;
  quantity: string;
  confidence: number;
  // Resolved DB record (when matchMedicineFromText found something)
  matched?: MedicineResult | null;
  matchPending?: boolean;
  // Structured dose schedule (always populated; defaults if frequency unparseable)
  schedule: DoseSchedule;
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
  const [searchOpenForIndex, setSearchOpenForIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedicineResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

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

  const canExtract = useMemo(() => !!selectedFile && !isProcessing, [selectedFile, isProcessing]);

  const isPdfPreview = useMemo(() => {
    if (!selectedFile) return false;
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
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);

    try {
      const parsed = await extractPrescriptionFromImage(selectedFile, { saveFile: false });
      // Build initial rows with structured dose schedules, mark each as pending DB match.
      const initial: EditableMedication[] = (parsed.medications || []).map((medication) => {
        const name = (medication.name || "").trim();
        const dosage = (medication.dosage || "").trim();
        const frequency = (medication.frequency || "").trim();
        const quantity = (medication.quantity || "").trim();
        const schedule = parseDoseScheduleFromFrequency(frequency);
        return {
          name,
          dosage,
          frequency: buildFrequencyFromDoseSchedule(schedule),
          quantity,
          confidence: typeof medication.confidence === "number" ? medication.confidence : 0,
          matched: null,
          matchPending: name.length >= 2,
          schedule,
        };
      });
      setMedications(initial);
      setExtractedText(
        buildOrderedExtractedText(parsed, initial, {
          unknownMedicine: tCommon("medicine.uploadDemo.unknownMedicine"),
          dosageLabel: tCommon("medicine.uploadDemo.dosageLabel"),
          frequencyLabel: tCommon("medicine.uploadDemo.frequencyLabel"),
          quantityLabel: tCommon("medicine.uploadDemo.quantityLabel"),
          noReadable: tCommon("medicine.uploadDemo.noReadable"),
        }),
      );
      setConfidence(typeof parsed.confidence === "number" ? parsed.confidence : null);
      setMeta(parsed.meta ?? null);

      // Kick off DB matching for every row in parallel — does not block the user from
      // editing fields in the meantime.
      const matchPromises = initial.map((row, index) =>
        row.name.length >= 2
          ? matchMedicineFromText(row.name)
              .catch(() => null)
              .then((matched) => ({ index, matched }))
          : Promise.resolve({ index, matched: null as MedicineResult | null }),
      );
      // Apply matches as they resolve; if a single search is slow it doesn't gate the others.
      for (const promise of matchPromises) {
        promise.then(({ index, matched }) => {
          setMedications((prev) =>
            prev.map((entry, entryIndex) =>
              entryIndex === index
                ? {
                    ...entry,
                    matched: matched || null,
                    matchPending: false,
                    // If the OCR didn't pick up a strength but the DB did, fill it in.
                    dosage: entry.dosage || matched?.strength || "",
                  }
                : entry,
            ),
          );
        });
      }
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

  const updateMedicationField = <K extends keyof EditableMedication>(
    index: number,
    field: K,
    value: EditableMedication[K],
  ) => {
    setIsApproved(false);
    setMedications((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  };

  const updateRowSchedule = (index: number, updates: Partial<DoseSchedule>) => {
    setIsApproved(false);
    setMedications((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        const nextSchedule: DoseSchedule = {
          ...item.schedule,
          ...updates,
          dose_evening: false,
          dose_evening_amount: "1",
          dose_morning_amount: normalizeDoseAmount(
            updates.dose_morning_amount ?? item.schedule.dose_morning_amount,
          ),
          dose_afternoon_amount: normalizeDoseAmount(
            updates.dose_afternoon_amount ?? item.schedule.dose_afternoon_amount,
          ),
          dose_night_amount: normalizeDoseAmount(
            updates.dose_night_amount ?? item.schedule.dose_night_amount,
          ),
        };
        return {
          ...item,
          schedule: nextSchedule,
          frequency: buildFrequencyFromDoseSchedule(nextSchedule),
        };
      }),
    );
  };

  const addMedicationRow = () => {
    setIsApproved(false);
    setMedications((previous) => [
      ...previous,
      {
        name: "",
        dosage: "",
        frequency: "0+0+0",
        quantity: "",
        confidence: 0,
        matched: null,
        matchPending: false,
        schedule: parseDoseScheduleFromFrequency(""),
      },
    ]);
  };

  const removeMedicationRow = (index: number) => {
    setIsApproved(false);
    setMedications((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const openSearchForRow = async (index: number) => {
    setSearchOpenForIndex(index);
    const initialQuery = medications[index]?.name?.trim() || "";
    setSearchQuery(initialQuery);
    if (initialQuery.length >= 2) {
      setSearchLoading(true);
      try {
        const results = await searchMedicines(initialQuery);
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  // Debounced search inside the picker panel
  useEffect(() => {
    if (searchOpenForIndex === null) return;
    const handle = window.setTimeout(async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const results = await searchMedicines(searchQuery.trim());
        setSearchResults(results);
      } finally {
        setSearchLoading(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchQuery, searchOpenForIndex]);

  const applyMatchSelection = (index: number, match: MedicineResult) => {
    setIsApproved(false);
    setMedications((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              matched: match,
              matchPending: false,
              name: match.display_name,
              dosage: item.dosage || match.strength || "",
            }
          : item,
      ),
    );
    setSearchOpenForIndex(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleApprove = async () => {
    if (medications.length === 0 || isSavingApproved) return;

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
        <p className="text-sm text-muted-foreground">{tCommon("medicine.uploadDemo.subtitle")}</p>
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
                  <div className="space-y-3">
                    {medications.map((medication, index) => (
                      <MedicationReviewRow
                        key={index}
                        index={index}
                        medication={medication}
                        searchOpen={searchOpenForIndex === index}
                        searchQuery={searchOpenForIndex === index ? searchQuery : ""}
                        searchResults={searchOpenForIndex === index ? searchResults : []}
                        searchLoading={searchOpenForIndex === index && searchLoading}
                        onOpenSearch={() => openSearchForRow(index)}
                        onCloseSearch={() => {
                          setSearchOpenForIndex(null);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                        onSearchChange={setSearchQuery}
                        onSelectMatch={(match) => applyMatchSelection(index, match)}
                        onClearMatch={() => updateMedicationField(index, "matched", null)}
                        onChangeName={(value) => updateMedicationField(index, "name", value)}
                        onChangeDosage={(value) => updateMedicationField(index, "dosage", value)}
                        onChangeQuantity={(value) => updateMedicationField(index, "quantity", value)}
                        onUpdateSchedule={(updates) => updateRowSchedule(index, updates)}
                        onRemove={() => removeMedicationRow(index)}
                      />
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

type MedicationReviewRowProps = {
  index: number;
  medication: EditableMedication;
  searchOpen: boolean;
  searchQuery: string;
  searchResults: MedicineResult[];
  searchLoading: boolean;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onSearchChange: (value: string) => void;
  onSelectMatch: (match: MedicineResult) => void;
  onClearMatch: () => void;
  onChangeName: (value: string) => void;
  onChangeDosage: (value: string) => void;
  onChangeQuantity: (value: string) => void;
  onUpdateSchedule: (updates: Partial<DoseSchedule>) => void;
  onRemove: () => void;
};

function MedicationReviewRow(props: MedicationReviewRowProps) {
  const {
    medication,
    searchOpen,
    searchQuery,
    searchResults,
    searchLoading,
    onOpenSearch,
    onCloseSearch,
    onSearchChange,
    onSelectMatch,
    onClearMatch,
    onChangeName,
    onChangeDosage,
    onChangeQuantity,
    onUpdateSchedule,
    onRemove,
  } = props;

  const matched = medication.matched || null;

  return (
    <div className="rounded-lg border border-border/60 bg-background/80 p-3 space-y-3">
      {/* Match status banner */}
      <div className="flex items-start justify-between gap-2">
        {medication.matchPending ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ButtonLoader className="h-3.5 w-3.5" />
            <span>Matching against medicine database…</span>
          </div>
        ) : matched ? (
          <div className="flex flex-1 items-start gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {matched.display_name}
                {matched.is_brand && matched.generic_name && matched.generic_name !== matched.display_name ? (
                  <span className="ml-1 text-xs text-muted-foreground">({matched.generic_name})</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {[matched.strength, matched.dosage_form, matched.manufacturer].filter(Boolean).join(" · ")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onOpenSearch}
              title="Pick a different medicine"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 p-2 dark:bg-amber-500/10">
            <Search className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No database match</p>
              <p className="text-xs text-amber-700 dark:text-amber-400/80">
                Pick from the medicine database so it links to the official record.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onOpenSearch}>
              Find match
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
          aria-label="Remove this medicine"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Inline search panel */}
      {searchOpen ? (
        <div className="rounded-md border border-border/60 bg-card/40 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search the medicine database…"
              autoFocus
              className="h-9"
            />
            <Button type="button" variant="ghost" size="sm" onClick={onCloseSearch}>
              Cancel
            </Button>
          </div>
          {searchLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ButtonLoader className="h-3.5 w-3.5" />
              Searching…
            </div>
          ) : searchResults.length === 0 && searchQuery.length >= 2 ? (
            <p className="text-xs text-muted-foreground">No medicines found for &quot;{searchQuery}&quot;.</p>
          ) : searchResults.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto divide-y divide-border/60 rounded-md border border-border/60 bg-background">
              {searchResults.map((result) => (
                <li key={`${result.drug_id}-${result.brand_id || "generic"}`}>
                  <button
                    type="button"
                    onClick={() => onSelectMatch(result)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{result.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[result.generic_name, result.strength, result.dosage_form].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {result.is_brand ? (
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        Brand
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Type at least 2 characters.</p>
          )}
        </div>
      ) : null}

      {/* OCR'd name + dosage + quantity */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            value={medication.name}
            onChange={(event) => onChangeName(event.target.value)}
            placeholder="Medicine name"
            disabled={!!matched}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Strength / Dosage</Label>
          <Input
            value={medication.dosage}
            onChange={(event) => onChangeDosage(event.target.value)}
            placeholder="e.g. 500mg"
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Quantity / Duration</Label>
          <Input
            value={medication.quantity}
            onChange={(event) => onChangeQuantity(event.target.value)}
            placeholder="e.g. 7 days"
            className="mt-1"
          />
        </div>
      </div>

      {/* Structured dose schedule (Morning / Noon / Night) */}
      <div>
        <Label className="text-xs text-muted-foreground">Dosage schedule</Label>
        <div className="mt-1 grid grid-cols-3 gap-2">
          <DoseSlot
            icon={<Sun className="h-4 w-4" />}
            label="Morning"
            checked={medication.schedule.dose_morning}
            amount={medication.schedule.dose_morning_amount}
            onToggle={(next) => onUpdateSchedule({ dose_morning: next })}
            onAmountChange={(value) => onUpdateSchedule({ dose_morning_amount: value })}
          />
          <DoseSlot
            icon={<Cloud className="h-4 w-4" />}
            label="Noon"
            checked={medication.schedule.dose_afternoon}
            amount={medication.schedule.dose_afternoon_amount}
            onToggle={(next) => onUpdateSchedule({ dose_afternoon: next })}
            onAmountChange={(value) => onUpdateSchedule({ dose_afternoon_amount: value })}
          />
          <DoseSlot
            icon={<Moon className="h-4 w-4" />}
            label="Night"
            checked={medication.schedule.dose_night}
            amount={medication.schedule.dose_night_amount}
            onToggle={(next) => onUpdateSchedule({ dose_night: next })}
            onAmountChange={(value) => onUpdateSchedule({ dose_night_amount: value })}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Pattern: <span className="font-mono">{medication.frequency || "0+0+0"}</span>
          {medication.matched ? null : (
            <button
              type="button"
              onClick={onClearMatch}
              className="hidden"
              aria-hidden="true"
            />
          )}
        </p>
      </div>
    </div>
  );
}

function DoseSlot({
  icon,
  label,
  checked,
  amount,
  onToggle,
  onAmountChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  amount: string;
  onToggle: (next: boolean) => void;
  onAmountChange: (value: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-md border p-2 text-xs transition-colors",
        checked ? "border-primary/50 bg-primary/10" : "border-border/60 bg-card/40",
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(!checked)}
        className={cn(
          "flex items-center gap-1.5 font-medium",
          checked ? "text-primary" : "text-muted-foreground",
        )}
      >
        {icon}
        {label}
      </button>
      {checked ? (
        <Input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          className="h-7 px-2 text-xs"
        />
      ) : null}
    </div>
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

function buildOrderedExtractedText(
  parsed: PrescriptionExtractionResponse,
  medications: EditableMedication[],
  labels: {
    unknownMedicine: string;
    dosageLabel: string;
    frequencyLabel: string;
    quantityLabel: string;
    noReadable: string;
  },
): string {
  if (medications.length > 0) {
    return medications
      .map((medication, index) => {
        const header = `${index + 1}. ${medication.name || labels.unknownMedicine}`;
        const details = [
          medication.dosage ? `   ${labels.dosageLabel}${medication.dosage}` : null,
          medication.frequency ? `   ${labels.frequencyLabel}${medication.frequency}` : null,
          medication.quantity ? `   ${labels.quantityLabel}${medication.quantity}` : null,
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
