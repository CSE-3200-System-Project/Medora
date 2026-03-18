"use client";

import React, { useEffect, useMemo, useState } from "react";
import { FileImage, Loader2, ScanText, ShieldCheck, UploadCloud } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractPrescriptionFromImage } from "@/lib/file-storage-actions";

export function PrescriptionUploadDemo() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);

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

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setError(null);
    setExtractedText("");
    setConfidence(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Please upload a JPG, PNG, or WEBP image.");
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
      const parsed = await extractPrescriptionFromImage(selectedFile);
      setExtractedText(parsed.extracted_text || "No readable text detected.");
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

  return (
    <Card className="overflow-hidden border-border bg-background shadow-sm">
      <CardHeader className="border-b border-border/70 bg-linear-to-r from-primary/8 via-primary/4 to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-foreground">
          <ScanText className="h-5 w-5 text-primary" />
          Prescription Upload Demo
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a prescription image to extract readable text for medicine search assistance.
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
                  <p className="text-sm font-medium text-foreground">Choose Prescription Image</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 15MB</p>
                </div>
              </label>
              <input
                id="prescription-upload"
                className="hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp"
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
                  <Image
                    src={previewUrl}
                    alt="Prescription preview"
                    width={1200}
                    height={900}
                    unoptimized
                    className="h-full min-h-72 w-full object-contain bg-background"
                  />

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
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
}
