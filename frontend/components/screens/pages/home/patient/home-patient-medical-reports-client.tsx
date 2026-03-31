"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listMedicalReports,
  type MedicalReportListItem,
} from "@/lib/medical-report-actions";
import { uploadMedicalReport } from "@/lib/medical-report-upload";
import { MedoraLoader } from "@/components/ui/medora-loader";
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Loader2,
  FlaskConical,
  MessageSquare,
  X,
  ImageIcon,
  Eye,
  EyeOff,
} from "lucide-react";

export default function PatientMedicalReportsPage() {
  const router = useRouter();
  const [reports, setReports] = React.useState<MedicalReportListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Upload state
  const [showUpload, setShowUpload] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [reportDate, setReportDate] = React.useState("");
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listMedicalReports(undefined, 50, 0);
      setReports(data);
    } catch (err: any) {
      console.error("Failed to load reports:", err);
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError(null);

    // Preview for images
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      setUploadError("Please upload an image (JPG, PNG, WebP) or PDF.");
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    if (file.type.startsWith("image/")) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setUploadError(null);
      const result = await uploadMedicalReport(selectedFile, {
        reportDate: reportDate || undefined,
      });

      // Reset upload state
      setSelectedFile(null);
      setPreviewUrl(null);
      setReportDate("");
      setShowUpload(false);

      // Navigate to the new report
      router.push(`/patient/medical-reports/${result.report.id}`);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <Navbar />
        <div className="pt-[var(--nav-content-offset)]">
          <MedoraLoader />
        </div>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              Medical Reports
            </h1>
            <p className="text-muted-foreground mt-2">
              Upload and view your lab test reports
            </p>
          </div>
          <Button
            onClick={() => setShowUpload(!showUpload)}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Report
          </Button>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <Card className="mb-8 rounded-xl border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Upload Lab Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="space-y-3">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg object-contain"
                      />
                    ) : (
                      <FileText className="h-12 w-12 mx-auto text-primary opacity-70" />
                    )}
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-sm font-medium">
                        {selectedFile.name}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearFile();
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="h-12 w-12 mx-auto opacity-40" />
                    <p className="text-muted-foreground">
                      Drag & drop your report here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Supports JPG, PNG, WebP, PDF (max 15MB)
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {/* Report date */}
              <div className="space-y-2">
                <Label>Report Date (optional)</Label>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="max-w-xs rounded-lg"
                />
              </div>

              {uploadError && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  {uploadError}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="gap-2"
                >
                  {uploading && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {uploading ? "Processing..." : "Upload & Extract"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUpload(false);
                    clearFile();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/10 mb-6">
            <CardContent className="p-6 text-center text-destructive">
              {error}
              <Button
                variant="outline"
                size="sm"
                className="ml-4"
                onClick={loadReports}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Reports List */}
        {reports.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-2">
                No medical reports yet
              </p>
              <p className="text-sm text-muted-foreground">
                Upload your first lab report to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {reports.map((report) => (
              <Card
                key={report.id}
                className="rounded-xl hover:shadow-md transition-shadow cursor-pointer"
                onClick={() =>
                  router.push(`/patient/medical-reports/${report.id}`)
                }
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                        <FlaskConical className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-foreground truncate">
                            {report.file_name || "Lab Report"}
                          </h3>
                          {report.parsed ? (
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Processed
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        {report.summary && (
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {report.summary}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            {new Date(report.created_at).toLocaleDateString()}
                          </span>
                          {report.result_count > 0 && (
                            <span className="flex items-center gap-1">
                              <FlaskConical className="h-3 w-3" />
                              {report.result_count} tests
                            </span>
                          )}
                          {report.comment_count > 0 && (
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" />
                              {report.comment_count} comments
                            </span>
                          )}
                          <span className={`flex items-center gap-1 ${
                            report.shared_with_doctors
                              ? "text-green-600 dark:text-green-400"
                              : ""
                          }`}>
                            {report.shared_with_doctors ? (
                              <>
                                <Eye className="h-3 w-3" />
                                Shared
                              </>
                            ) : (
                              <>
                                <EyeOff className="h-3 w-3" />
                                Private
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0 ml-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </AppBackground>
  );
}
