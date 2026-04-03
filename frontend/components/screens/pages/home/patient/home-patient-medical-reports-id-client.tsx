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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getMedicalReport,
  updateReportResult,
  addReportResult,
  deleteReportResult,
  updateReportVisibility,
  type MedicalReport,
  type ReportResultCreatePayload,
  type ReportResultUpdatePayload,
  type ReportTestResult,
} from "@/lib/medical-report-actions";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import {
  ArrowLeft,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  MessageSquare,
  FileText,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react";

interface EditingResult {
  test_name: string;
  value: string;
  value_text: string;
  unit: string;
  status: string;
  reference_range_min: string;
  reference_range_max: string;
  reference_range_text: string;
}

function resultToEditing(r: ReportTestResult): EditingResult {
  return {
    test_name: r.test_name,
    value: r.value !== null ? String(r.value) : "",
    value_text: r.value_text || "",
    unit: r.unit || "",
    status: r.status || "",
    reference_range_min:
      r.reference_range_min !== null ? String(r.reference_range_min) : "",
    reference_range_max:
      r.reference_range_max !== null ? String(r.reference_range_max) : "",
    reference_range_text: r.reference_range_text || "",
  };
}

function emptyEditing(): EditingResult {
  return {
    test_name: "",
    value: "",
    value_text: "",
    unit: "",
    status: "",
    reference_range_min: "",
    reference_range_max: "",
    reference_range_text: "",
  };
}

export default function PatientMedicalReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [report, setReport] = React.useState<MedicalReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<EditingResult>(emptyEditing());
  const [saving, setSaving] = React.useState(false);

  // Add new row state
  const [showAddRow, setShowAddRow] = React.useState(false);
  const [addForm, setAddForm] = React.useState<EditingResult>(emptyEditing());
  const [addingSaving, setAddingSaving] = React.useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Visibility toggle
  const [togglingVisibility, setTogglingVisibility] = React.useState(false);

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

  // ── Inline edit ───────────────────────────────────────────────────────────

  const startEdit = (result: ReportTestResult) => {
    setEditingId(result.id);
    setEditForm(resultToEditing(result));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyEditing());
  };

  const saveEdit = async () => {
    if (!editingId || !report) return;
    setSaving(true);
    try {
      const payload: ReportResultUpdatePayload = {};
      if (editForm.test_name) payload.test_name = editForm.test_name;
      if (editForm.value !== "")
        payload.value = parseFloat(editForm.value) || null;
      if (editForm.value_text) payload.value_text = editForm.value_text;
      if (editForm.unit) payload.unit = editForm.unit;
      if (editForm.status) payload.status = editForm.status;
      if (editForm.reference_range_min !== "")
        payload.reference_range_min =
          parseFloat(editForm.reference_range_min) || null;
      if (editForm.reference_range_max !== "")
        payload.reference_range_max =
          parseFloat(editForm.reference_range_max) || null;
      if (editForm.reference_range_text)
        payload.reference_range_text = editForm.reference_range_text;

      const updated = await updateReportResult(reportId, editingId, payload);

      setReport({
        ...report,
        results: report.results.map((r) =>
          r.id === editingId ? updated : r
        ),
      });
      setEditingId(null);
    } catch (err: any) {
      alert(err.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // ── Add new row ───────────────────────────────────────────────────────────

  const saveNewRow = async () => {
    if (!addForm.test_name.trim() || !report) return;
    setAddingSaving(true);
    try {
      const payload: ReportResultCreatePayload = {
        test_name: addForm.test_name.trim(),
      };
      if (addForm.value !== "") payload.value = parseFloat(addForm.value);
      if (addForm.value_text) payload.value_text = addForm.value_text;
      if (addForm.unit) payload.unit = addForm.unit;
      if (addForm.status) payload.status = addForm.status;
      if (addForm.reference_range_min !== "")
        payload.reference_range_min = parseFloat(addForm.reference_range_min);
      if (addForm.reference_range_max !== "")
        payload.reference_range_max = parseFloat(addForm.reference_range_max);
      if (addForm.reference_range_text)
        payload.reference_range_text = addForm.reference_range_text;

      const newResult = await addReportResult(reportId, payload);
      setReport({
        ...report,
        results: [...report.results, newResult],
      });
      setShowAddRow(false);
      setAddForm(emptyEditing());
    } catch (err: any) {
      alert(err.message || "Failed to add result");
    } finally {
      setAddingSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async (resultId: string) => {
    if (!report) return;
    if (!confirm("Are you sure you want to delete this test result?")) return;
    setDeletingId(resultId);
    try {
      await deleteReportResult(reportId, resultId);
      setReport({
        ...report,
        results: report.results.filter((r) => r.id !== resultId),
      });
    } catch (err: any) {
      alert(err.message || "Failed to delete result");
    } finally {
      setDeletingId(null);
    }
  };

  // ── Visibility toggle ─────────────────────────────────────────────────────

  const handleVisibilityToggle = async (newVal: boolean) => {
    if (!report) return;
    setTogglingVisibility(true);
    try {
      await updateReportVisibility(reportId, newVal);
      setReport({ ...report, shared_with_doctors: newVal });
    } catch (err: any) {
      alert(err.message || "Failed to update visibility");
    } finally {
      setTogglingVisibility(false);
    }
  };

  // ── Status badge helper ───────────────────────────────────────────────────

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

  // ── Editable row form fields ──────────────────────────────────────────────

  const renderEditFields = (
    form: EditingResult,
    setForm: (f: EditingResult) => void
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-lg">
      <div>
        <Label className="text-xs">Test Name *</Label>
        <Input
          value={form.test_name}
          onChange={(e) => setForm({ ...form, test_name: e.target.value })}
          className="h-8 text-sm"
          placeholder="e.g. Hemoglobin"
        />
      </div>
      <div>
        <Label className="text-xs">Value</Label>
        <Input
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
          className="h-8 text-sm"
          placeholder="e.g. 14.2"
          type="number"
          step="any"
        />
      </div>
      <div>
        <Label className="text-xs">Value (text)</Label>
        <Input
          value={form.value_text}
          onChange={(e) => setForm({ ...form, value_text: e.target.value })}
          className="h-8 text-sm"
          placeholder="e.g. Positive"
        />
      </div>
      <div>
        <Label className="text-xs">Unit</Label>
        <Input
          value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })}
          className="h-8 text-sm"
          placeholder="e.g. g/dL"
        />
      </div>
      <div>
        <Label className="text-xs">Status</Label>
        <select
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          className="h-8 text-sm w-full rounded-md border border-input bg-background px-3"
        >
          <option value="">-- Select --</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div>
        <Label className="text-xs">Ref. Min</Label>
        <Input
          value={form.reference_range_min}
          onChange={(e) =>
            setForm({ ...form, reference_range_min: e.target.value })
          }
          className="h-8 text-sm"
          placeholder="e.g. 12.0"
          type="number"
          step="any"
        />
      </div>
      <div>
        <Label className="text-xs">Ref. Max</Label>
        <Input
          value={form.reference_range_max}
          onChange={(e) =>
            setForm({ ...form, reference_range_max: e.target.value })
          }
          className="h-8 text-sm"
          placeholder="e.g. 17.5"
          type="number"
          step="any"
        />
      </div>
      <div>
        <Label className="text-xs">Ref. Range (text)</Label>
        <Input
          value={form.reference_range_text}
          onChange={(e) =>
            setForm({ ...form, reference_range_text: e.target.value })
          }
          className="h-8 text-sm"
          placeholder="e.g. 12.0-17.5"
        />
      </div>
    </div>
  );

  // ── Loading / Error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
          <PageLoadingShell label="Loading report details..." cardCount={4} />
        </main>
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
                  onClick={() => router.push("/patient/medical-reports")}
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

  const abnormalCount = report.results.filter(
    (r) => r.status === "high" || r.status === "low"
  ).length;

  return (
    <AppBackground className="container-padding animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto py-8 pt-[var(--nav-content-offset)]">
        {/* Back button + header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 gap-1"
            onClick={() => router.push("/patient/medical-reports")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Reports
          </Button>

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {report.file_name || "Lab Report"}
              </h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>
                  Uploaded{" "}
                  {new Date(report.created_at).toLocaleDateString()}
                </span>
                {report.report_date && (
                  <span>
                    Report date:{" "}
                    {new Date(report.report_date).toLocaleDateString()}
                  </span>
                )}
                {report.ocr_engine && (
                  <span className="capitalize">
                    Engine: {report.ocr_engine}
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
        </div>

        {/* Visibility toggle card */}
        <Card className="rounded-xl mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {report.shared_with_doctors ? (
                  <Eye className="h-5 w-5 text-green-600" />
                ) : (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">Doctor Visibility</p>
                  <p className="text-xs text-muted-foreground">
                    {report.shared_with_doctors
                      ? "Doctors you've granted report access to can see this report"
                      : "This report is private — only you can see it"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {togglingVisibility && (
                  <ButtonLoader className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                  checked={report.shared_with_doctors}
                  onCheckedChange={handleVisibilityToggle}
                  disabled={togglingVisibility}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <FlaskConical className="h-6 w-6 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{report.results.length}</p>
              <p className="text-xs text-muted-foreground">Tests Found</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold">
                {report.results.filter((r) => r.status === "normal").length}
              </p>
              <p className="text-xs text-muted-foreground">Normal</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-red-500" />
              <p className="text-2xl font-bold">{abnormalCount}</p>
              <p className="text-xs text-muted-foreground">Abnormal</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl">
            <CardContent className="p-4 text-center">
              <MessageSquare className="h-6 w-6 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{report.comments.length}</p>
              <p className="text-xs text-muted-foreground">Comments</p>
            </CardContent>
          </Card>
        </div>

        {/* Test Results Table with Edit */}
        <Card className="rounded-xl mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                Test Results
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => {
                  setShowAddRow(true);
                  setAddForm(emptyEditing());
                }}
              >
                <Plus className="h-4 w-4" />
                Add Result
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Add new row form */}
            {showAddRow && (
              <div className="mb-4 space-y-3">
                <p className="text-sm font-medium text-foreground flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  Add new test result
                </p>
                {renderEditFields(addForm, setAddForm)}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={saveNewRow}
                    disabled={!addForm.test_name.trim() || addingSaving}
                    className="gap-1"
                  >
                    {addingSaving ? (
                      <ButtonLoader className="h-3 w-3" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddRow(false)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {report.results.length === 0 && !showAddRow ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <p>No test results were extracted from this report.</p>
                <p className="text-sm mt-1">
                  Click "Add Result" above to manually enter your test data.
                </p>
              </div>
            ) : (
              <div className="space-y-0">
                {/* Table header */}
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
                        <th className="pb-3 font-medium w-24">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.results.map((result) => {
                        const isEditing = editingId === result.id;
                        const isDeleting = deletingId === result.id;

                        if (isEditing) {
                          return (
                            <tr key={result.id} className="border-b">
                              <td colSpan={6} className="py-3">
                                {renderEditFields(editForm, setEditForm)}
                                <div className="flex gap-2 mt-2 px-4">
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    disabled={saving}
                                    className="gap-1"
                                  >
                                    {saving ? (
                                      <ButtonLoader className="h-3 w-3" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={cancelEdit}
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={result.id}
                            className={`border-b last:border-0 ${
                              result.status === "high" ||
                              result.status === "low"
                                ? "bg-red-50/50 dark:bg-red-900/10"
                                : ""
                            }`}
                          >
                            <td className="py-3 pr-4 font-medium">
                              <div className="flex items-center gap-1">
                                {result.test_name}
                                {result.is_manually_edited && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 ml-1 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700"
                                  >
                                    Edited
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-3 pr-4">
                              {result.value !== null
                                ? result.value
                                : result.value_text || "--"}
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
                            <td className="py-3">
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => startEdit(result)}
                                  title="Edit this result"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(result.id)}
                                  disabled={isDeleting}
                                  title="Delete this result"
                                >
                                  {isDeleting ? (
                                    <ButtonLoader className="h-3.5 w-3.5" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Doctor Comments */}
        {report.comments.length > 0 && (
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Doctor Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>
        )}
      </main>
    </AppBackground>
  );
}
