"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getMedicalReport,
  addReportComment,
  type MedicalReport,
} from "@/lib/medical-report-actions";
import { MedoraLoader } from "@/components/ui/medora-loader";
import {
  ArrowLeft,
  FlaskConical,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  ExternalLink,
  Loader2,
  Send,
  AlertTriangle,
  FileText,
} from "lucide-react";

export default function DoctorPatientReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = params.id as string;
  const reportId = params.reportId as string;

  const [report, setReport] = React.useState<MedicalReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Comment state
  const [commentText, setCommentText] = React.useState("");
  const [submittingComment, setSubmittingComment] = React.useState(false);
  const [commentError, setCommentError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (reportId) loadReport();
  }, [reportId]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMedicalReport(reportId);
      setReport(data);
    } catch (err: any) {
      console.error("Failed to load report:", err);
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    try {
      setSubmittingComment(true);
      setCommentError(null);
      const newComment = await addReportComment(reportId, commentText.trim());

      // Add to local state
      if (report) {
        setReport({
          ...report,
          comments: [...report.comments, newComment],
        });
      }
      setCommentText("");
    } catch (err: any) {
      console.error("Failed to add comment:", err);
      setCommentError(err.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "normal":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Normal
          </Badge>
        );
      case "high":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
          >
            <ArrowUp className="h-3 w-3 mr-1" />
            High
          </Badge>
        );
      case "low":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
          >
            <ArrowDown className="h-3 w-3 mr-1" />
            Low
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            --
          </Badge>
        );
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

  if (error || !report) {
    return (
      <AppBackground>
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)] px-4">
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-6 text-center text-destructive">
              {error || "Report not found"}
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(`/doctor/patient/${patientId}/reports`)
                  }
                >
                  Back to Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </AppBackground>
    );
  }

  const abnormalResults = report.results.filter(
    (r) => r.status === "high" || r.status === "low"
  );

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
        {/* Navigation */}
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-1"
          onClick={() =>
            router.push(`/doctor/patient/${patientId}/reports`)
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Reports
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              {report.file_name || "Lab Report"}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span>
                Uploaded {new Date(report.created_at).toLocaleDateString()}
              </span>
              {report.report_date && (
                <span>
                  Report date:{" "}
                  {new Date(report.report_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          {report.file_url && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => window.open(report.file_url!, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              View Original
            </Button>
          )}
        </div>

        {/* Abnormal Alert */}
        {abnormalResults.length > 0 && (
          <Card className="mb-6 rounded-xl border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">
                  {abnormalResults.length} abnormal result
                  {abnormalResults.length > 1 ? "s" : ""} detected
                </span>
              </div>
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {abnormalResults.map((r) => (
                  <span key={r.id} className="mr-3">
                    {r.test_name}:{" "}
                    {r.value !== null ? r.value : r.value_text}{" "}
                    {r.unit || ""} ({r.status})
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Test Results Table */}
        <Card className="rounded-xl mb-8">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              Test Results ({report.results.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report.results.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No test results extracted.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 pr-4 font-medium">Test Name</th>
                      <th className="pb-3 pr-4 font-medium">Value</th>
                      <th className="pb-3 pr-4 font-medium">Unit</th>
                      <th className="pb-3 pr-4 font-medium">
                        Reference Range
                      </th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.results.map((result) => (
                      <tr
                        key={result.id}
                        className={`border-b last:border-0 ${
                          result.status === "high" || result.status === "low"
                            ? "bg-red-50/50 dark:bg-red-900/10"
                            : ""
                        }`}
                      >
                        <td className="py-3 pr-4 font-medium">
                          {result.test_name}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={
                              result.status === "high" ||
                              result.status === "low"
                                ? "font-semibold text-red-600 dark:text-red-400"
                                : ""
                            }
                          >
                            {result.value !== null
                              ? result.value
                              : result.value_text || "--"}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {result.unit || "--"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {result.reference_range_min !== null &&
                          result.reference_range_max !== null
                            ? `${result.reference_range_min} - ${result.reference_range_max}`
                            : result.reference_range_text || "--"}
                        </td>
                        <td className="py-3 pr-4">
                          {getStatusBadge(result.status)}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {result.confidence !== null
                            ? `${Math.round(result.confidence * 100)}%`
                            : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments Section */}
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Doctor Notes ({report.comments.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing comments */}
            {report.comments.map((comment) => (
              <div
                key={comment.id}
                className="p-4 rounded-lg bg-muted/50 border"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">
                    {comment.doctor_name || "Doctor"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {comment.comment}
                </p>
              </div>
            ))}

            {/* Add comment */}
            <div className="border-t pt-4 space-y-3">
              <Label className="font-medium">Add a Note</Label>
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write your clinical notes, observations, or recommendations..."
                className="min-h-[100px] rounded-lg"
              />
              {commentError && (
                <p className="text-sm text-destructive">{commentError}</p>
              )}
              <Button
                onClick={handleAddComment}
                disabled={!commentText.trim() || submittingComment}
                className="gap-2"
              >
                {submittingComment ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {submittingComment ? "Saving..." : "Add Note"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </AppBackground>
  );
}
