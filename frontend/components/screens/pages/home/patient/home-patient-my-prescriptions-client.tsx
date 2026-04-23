"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Pill,
  FlaskConical,
  Scissors,
  CheckCircle2,
  XCircle,
  Calendar,
  User,
  FileText,
  AlertCircle,
  Sun,
  Cloud,
  Star,
  Clock,
  MapPin,
} from "lucide-react";
import {
  getPatientPrescriptions,
  acceptPrescription,
  rejectPrescription,
  Prescription,
  PrescriptionStatus,
} from "@/lib/prescription-actions";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { PageLoadingShell } from "@/components/ui/page-loading-shell";
import { useT } from "@/i18n/client";

export default function MyPrescriptionsPage() {
  const tCommon = useT("common");
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const [prescriptions, setPrescriptions] = React.useState<Prescription[]>([]);
  const [activeFilter, setActiveFilter] = React.useState<"all" | PrescriptionStatus>("all");
  
  // Rejection dialog
  const [showRejectDialog, setShowRejectDialog] = React.useState(false);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = React.useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = React.useState("");

  React.useEffect(() => {
    loadPrescriptions();
  }, [activeFilter]);

  const loadPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const filter = activeFilter === "all" ? undefined : activeFilter;
      const data = await getPatientPrescriptions(filter, 100, 0);
      setPrescriptions(data.prescriptions);
    } catch (err: any) {
      console.error("Failed to load prescriptions:", err);
      setError(err.message || tCommon("prescriptions.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (prescriptionId: string) => {
    try {
      setSubmitting(true);
      setError(null);

      await acceptPrescription(prescriptionId);
      setSuccess(tCommon("prescriptions.messages.accepted"));
      
      // Reload prescriptions
      setTimeout(() => {
        loadPrescriptions();
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || tCommon("prescriptions.errors.acceptFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectClick = (prescriptionId: string) => {
    setSelectedPrescriptionId(prescriptionId);
    setRejectionReason("");
    setShowRejectDialog(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedPrescriptionId) return;

    try {
      setSubmitting(true);
      setError(null);

      await rejectPrescription(selectedPrescriptionId, rejectionReason);
      setShowRejectDialog(false);
      setSuccess(tCommon("prescriptions.messages.rejected"));
      
      // Reload prescriptions
      setTimeout(() => {
        loadPrescriptions();
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err.message || tCommon("prescriptions.errors.rejectFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const getMealInstructionLabel = (instruction: string) => {
    const labels: Record<string, string> = {
      before_meal: "Before Meal",
      after_meal: "After Meal",
      with_meal: "With Meal",
      empty_stomach: "Empty Stomach",
      any_time: "Any Time",
    };
    return labels[instruction] || instruction;
  };

  const getMedicineTypeLabel = (type: string) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600">{tCommon("medicalHistory.status.pending")}</Badge>;
      case "accepted":
        return <Badge variant="secondary" className="bg-success/10 text-success border-success/20">{tCommon("prescriptions.status.accepted")}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{tCommon("prescriptions.status.rejected")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPrescriptions = prescriptions.filter((p) => {
    if (activeFilter === "all") return true;
    return p.status === activeFilter;
  });

  if (loading) {
    return (
      <AppBackground className="container-padding">
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
          <PageLoadingShell label={tCommon("prescriptions.loading")} cardCount={4} />
        </main>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-7 h-7 text-primary" />
              {tCommon("prescriptions.title")}
            </h1>
            <p className="text-muted-foreground mt-1">
              {tCommon("prescriptions.myPrescriptionsSubtitle")}
            </p>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-destructive">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-success/10 border border-success/20 rounded-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <p className="text-success">{success}</p>
          </div>
        )}

        {/* Filter Tabs */}
        <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as any)} className="mb-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">{tCommon("prescriptions.filters.all")}</TabsTrigger>
            <TabsTrigger value="pending">{tCommon("prescriptions.filters.pending")}</TabsTrigger>
            <TabsTrigger value="accepted">{tCommon("prescriptions.filters.accepted")}</TabsTrigger>
            <TabsTrigger value="rejected">{tCommon("prescriptions.filters.rejected")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Prescriptions List */}
        {filteredPrescriptions.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-12 text-center text-muted-foreground">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">{tCommon("prescriptions.empty.title")}</p>
              <p className="text-sm mt-2">
                {activeFilter === "all"
                  ? tCommon("prescriptions.empty.all")
                  : tCommon("prescriptions.empty.filtered", { status: tCommon(`prescriptions.filters.${activeFilter}`) })}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredPrescriptions.map((prescription) => (
              <Card key={prescription.id} className="rounded-2xl overflow-hidden">
                <CardHeader className="bg-surface/50 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {prescription.doctor_name || "Unknown Doctor"}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(prescription.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(prescription.status)}
                  </div>
                </CardHeader>

                <CardContent className="pt-6 space-y-6">
                  {/* Medications */}
                  {prescription.medications && prescription.medications.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Pill className="w-5 h-5 text-primary" />
                        Medications ({prescription.medications.length})
                      </h3>
                      <div className="space-y-3">
                        {prescription.medications.map((med) => (
                          <div key={med.id} className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-foreground">{med.medicine_name}</h4>
                                {med.generic_name && (
                                  <p className="text-sm text-muted-foreground">{med.generic_name}</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Badge variant="secondary" className="text-xs">
                                  {getMedicineTypeLabel(med.medicine_type)}
                                </Badge>
                                {med.strength && (
                                  <Badge variant="outline" className="text-xs">{med.strength}</Badge>
                                )}
                              </div>
                            </div>

                            {/* Dosage Schedule */}
                            <div className="flex flex-wrap gap-2 mb-2">
                              {med.dose_morning && (
                                <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded-lg text-xs">
                                  <Sun className="w-3 h-3" />
                                  <span>Morning {med.dose_morning_amount && `(${med.dose_morning_amount})`}</span>
                                </div>
                              )}
                              {med.dose_afternoon && (
                                <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg text-xs">
                                  <Cloud className="w-3 h-3" />
                                  <span>Noon {med.dose_afternoon_amount && `(${med.dose_afternoon_amount})`}</span>
                                </div>
                              )}
                              {(med.dose_night || med.dose_evening) && (
                                <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs">
                                  <Star className="w-3 h-3" />
                                  <span>Night {(med.dose_night_amount || med.dose_evening_amount) && `(${med.dose_night_amount || med.dose_evening_amount})`}</span>
                                </div>
                              )}
                            </div>

                            {/* Duration & Instructions */}
                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {med.duration_value && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {med.duration_value} {med.duration_unit}
                                </span>
                              )}
                              <span>{getMealInstructionLabel(med.meal_instruction)}</span>
                              {med.quantity && <span>Qty: {med.quantity}</span>}
                            </div>

                            {med.special_instructions && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                "{med.special_instructions}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tests */}
                  {prescription.tests && prescription.tests.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <FlaskConical className="w-5 h-5 text-purple-600" />
                        Medical Tests ({prescription.tests.length})
                      </h3>
                      <div className="space-y-3">
                        {prescription.tests.map((test) => (
                          <div key={test.id} className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground">{test.test_name}</h4>
                              <div className="flex gap-1">
                                {test.test_type && (
                                  <Badge variant="secondary" className="text-xs">{test.test_type}</Badge>
                                )}
                                {test.urgency === "urgent" && (
                                  <Badge variant="destructive" className="text-xs">Urgent</Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {test.preferred_lab && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {test.preferred_lab}
                                </span>
                              )}
                              {test.expected_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(test.expected_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>

                            {test.instructions && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                "{test.instructions}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Procedures */}
                  {prescription.surgeries && prescription.surgeries.length > 0 && (
                    <div>
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        <Scissors className="w-5 h-5 text-red-600" />
                        Procedures ({prescription.surgeries.length})
                      </h3>
                      <div className="space-y-3">
                        {prescription.surgeries.map((surgery) => (
                          <div key={surgery.id} className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 border border-red-200 dark:border-red-800">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-foreground">{surgery.procedure_name}</h4>
                              <div className="flex gap-1">
                                {surgery.procedure_type && (
                                  <Badge variant="secondary" className="text-xs">{surgery.procedure_type}</Badge>
                                )}
                                {surgery.urgency === "immediate" && (
                                  <Badge variant="destructive" className="text-xs">Immediate</Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                              {surgery.preferred_facility && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {surgery.preferred_facility}
                                </span>
                              )}
                              {surgery.recommended_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(surgery.recommended_date).toLocaleDateString()}
                                </span>
                              )}
                              {(surgery.estimated_cost_min || surgery.estimated_cost_max) && (
                                <span>
                                  Est. Cost: ৳{surgery.estimated_cost_min?.toLocaleString() || "0"} - ৳{surgery.estimated_cost_max?.toLocaleString() || "0"}
                                </span>
                              )}
                            </div>

                            {surgery.reason && (
                              <p className="text-sm text-muted-foreground mt-2">
                                <strong>Reason:</strong> {surgery.reason}
                              </p>
                            )}

                            {surgery.pre_op_instructions && (
                              <p className="text-sm text-muted-foreground mt-1">
                                <strong>Pre-op:</strong> {surgery.pre_op_instructions}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {prescription.notes && (
                    <div className="bg-surface/50 rounded-lg p-4 border">
                      <p className="text-sm text-muted-foreground">
                        <strong>Notes:</strong> {prescription.notes}
                      </p>
                    </div>
                  )}

                  {/* Rejection Reason */}
                  {prescription.status === "rejected" && prescription.rejection_reason && (
                    <div className="bg-destructive/10 rounded-lg p-4 border border-destructive/20">
                      <p className="text-sm text-destructive">
                        <strong>Rejection Reason:</strong> {prescription.rejection_reason}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {prescription.status === "pending" && (
                    <div className="flex gap-3 pt-4 border-t">
                      <Button
                        variant="medical"
                        onClick={() => handleAccept(prescription.id)}
                        disabled={submitting}
                        className="flex-1"
                      >
                        {submitting ? (
                          <ButtonLoader className="mr-2" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        )}
                        {tCommon("prescriptions.actions.accept")}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleRejectClick(prescription.id)}
                        disabled={submitting}
                        className="flex-1"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        {tCommon("prescriptions.actions.reject")}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tCommon("prescriptions.dialogs.rejectTitle")}</DialogTitle>
            <DialogDescription>
              {tCommon("prescriptions.dialogs.rejectDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">{tCommon("prescriptions.dialogs.reasonOptional")}</Label>
              <Textarea
                id="reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={tCommon("prescriptions.dialogs.reasonPlaceholder")}
                rows={3}
                className="rounded-lg resize-none"
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={submitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRejectConfirm}
              disabled={submitting}
            >
              {submitting ? (
                <ButtonLoader className="mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              {tCommon("prescriptions.actions.rejectPrescription")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppBackground>
  );
}

