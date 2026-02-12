"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  getPatientPrescription,
  acceptPrescription,
  rejectPrescription,
  Prescription,
} from "@/lib/prescription-actions";
import {
  FileText,
  Pill,
  FlaskConical,
  Scissors,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  Utensils,
  Building2,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

export default function PatientPrescriptionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const prescriptionId = params.id as string;

  const [prescription, setPrescription] = React.useState<Prescription | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [showRejectForm, setShowRejectForm] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  React.useEffect(() => {
    loadPrescription();
  }, [prescriptionId]);

  const loadPrescription = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPatientPrescription(prescriptionId);
      setPrescription(data);
    } catch (err: any) {
      console.error("Failed to load prescription:", err);
      setError(err.message || "Failed to load prescription");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setActionLoading(true);
      setError(null);
      await acceptPrescription(prescriptionId);
      // Refetch prescription to get updated status
      await loadPrescription();
    } catch (err: any) {
      setError(err.message || "Failed to accept prescription");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }
    
    try {
      setActionLoading(true);
      setError(null);
      await rejectPrescription(prescriptionId, rejectReason);
      // Refetch prescription to get updated status
      await loadPrescription();
      setShowRejectForm(false);
    } catch (err: any) {
      setError(err.message || "Failed to reject prescription");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        );
      case "accepted":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "routine":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Routine</Badge>;
      case "urgent":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Urgent</Badge>;
      case "emergency":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Emergency</Badge>;
      case "elective":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Elective</Badge>;
      default:
        return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getMealInstructionText = (instruction: string) => {
    switch (instruction) {
      case "before_meal":
        return "Before Meal";
      case "after_meal":
        return "After Meal";
      case "with_meal":
        return "With Meal";
      case "empty_stomach":
        return "Empty Stomach";
      case "any_time":
        return "Any Time";
      default:
        return instruction;
    }
  };

  const getDosageTimeIcon = (time: string) => {
    switch (time) {
      case "morning":
        return <Sunrise className="h-4 w-4 text-orange-500" />;
      case "afternoon":
        return <Sun className="h-4 w-4 text-yellow-500" />;
      case "evening":
        return <Sunset className="h-4 w-4 text-purple-500" />;
      case "night":
        return <Moon className="h-4 w-4 text-blue-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <AppBackground>
        <Navbar />
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppBackground>
    );
  }

  if (error && !prescription) {
    return (
      <AppBackground>
        <Navbar />
        <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px]">
          <Card className="border-destructive">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive mb-4">{error}</p>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </main>
      </AppBackground>
    );
  }

  if (!prescription) return null;

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />
      
      <main className="container mx-auto container-padding py-6 pt-16 md:pt-[50px] max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/patient/prescriptions")}
            className="mb-3"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Prescriptions
          </Button>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                Prescription Details
              </h1>
              <p className="text-muted-foreground mt-1">
                Prescribed on {new Date(prescription.created_at).toLocaleDateString()}
              </p>
            </div>
            {getStatusBadge(prescription.status)}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Card className="mb-6 border-destructive">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <span className="text-destructive">{error}</span>
            </CardContent>
          </Card>
        )}

        {/* Doctor Info */}
        {prescription.doctor_name && (
          <Card className="mb-6">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {prescription.doctor_photo ? (
                  <img 
                    src={prescription.doctor_photo} 
                    alt={prescription.doctor_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  Dr. {prescription.doctor_name}
                </p>
                {prescription.doctor_specialization && (
                  <p className="text-sm text-muted-foreground">
                    {prescription.doctor_specialization}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {prescription.notes && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Prescription Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground">{prescription.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Medications */}
        {prescription.medications && prescription.medications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Pill className="h-5 w-5 text-blue-600" />
                Medications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.medications.map((med, index) => (
                  <div key={index} className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-foreground">{med.medicine_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {med.medicine_type} • {med.strength}
                        </p>
                      </div>
                      {med.quantity && (
                        <Badge variant="outline" className="bg-white">
                          Qty: {med.quantity}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Dosage Schedule */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm text-muted-foreground">Dosage:</span>
                      <div className="flex gap-2">
                        {med.dose_morning && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 rounded text-sm">
                            <Sunrise className="h-3 w-3 text-orange-600" />
                            {med.dose_morning_amount || "Morning"}
                          </div>
                        )}
                        {med.dose_afternoon && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 rounded text-sm">
                            <Sun className="h-3 w-3 text-yellow-600" />
                            {med.dose_afternoon_amount || "Afternoon"}
                          </div>
                        )}
                        {med.dose_evening && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 rounded text-sm">
                            <Sunset className="h-3 w-3 text-purple-600" />
                            {med.dose_evening_amount || "Evening"}
                          </div>
                        )}
                        {med.dose_night && (
                          <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 rounded text-sm">
                            <Moon className="h-3 w-3 text-blue-600" />
                            {med.dose_night_amount || "Night"}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Duration and Meal Instructions */}
                    <div className="flex flex-wrap gap-4 text-sm">
                      {med.duration_value && med.duration_unit && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>{med.duration_value} {med.duration_unit}</span>
                        </div>
                      )}
                      {med.meal_instruction && (
                        <div className="flex items-center gap-1">
                          <Utensils className="h-4 w-4 text-muted-foreground" />
                          <span>{getMealInstructionText(med.meal_instruction)}</span>
                        </div>
                      )}
                    </div>

                    {/* Special Instructions */}
                    {med.special_instructions && (
                      <div className="mt-3 p-2 bg-white rounded border border-blue-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Note:</strong> {med.special_instructions}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tests */}
        {prescription.tests && prescription.tests.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-purple-600" />
                Medical Tests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.tests.map((test, index) => (
                  <div key={index} className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{test.test_name}</h4>
                        <p className="text-sm text-muted-foreground">{test.test_type}</p>
                      </div>
                      {test.urgency && getUrgencyBadge(test.urgency)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm">
                      {test.preferred_lab && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{test.preferred_lab}</span>
                        </div>
                      )}
                      {test.expected_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Before {new Date(test.expected_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {test.instructions && (
                      <div className="mt-3 p-2 bg-white rounded border border-purple-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Instructions:</strong> {test.instructions}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Surgeries */}
        {prescription.surgeries && prescription.surgeries.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scissors className="h-5 w-5 text-orange-600" />
                Procedures & Surgeries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {prescription.surgeries.map((surgery, index) => (
                  <div key={index} className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-foreground">{surgery.procedure_name}</h4>
                        <p className="text-sm text-muted-foreground">{surgery.procedure_type}</p>
                      </div>
                      {surgery.urgency && getUrgencyBadge(surgery.urgency)}
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm mb-3">
                      {surgery.preferred_facility && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{surgery.preferred_facility}</span>
                        </div>
                      )}
                      {surgery.recommended_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Scheduled: {new Date(surgery.recommended_date).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    {/* Cost Estimates */}
                    {(surgery.estimated_cost_min || surgery.estimated_cost_max) && (
                      <div className="flex items-center gap-1 text-sm mb-3">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Estimated Cost: ৳{surgery.estimated_cost_min?.toLocaleString() || "N/A"} 
                          {surgery.estimated_cost_max && ` - ৳${surgery.estimated_cost_max.toLocaleString()}`}
                        </span>
                      </div>
                    )}

                    {surgery.pre_op_instructions && (
                      <div className="mt-3 p-2 bg-white rounded border border-orange-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Pre-operative Instructions:</strong> {surgery.pre_op_instructions}
                        </p>
                      </div>
                    )}

                    {/* Reason for Surgery */}
                    {surgery.reason && (
                      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-100">
                        <p className="text-sm text-muted-foreground">
                          <strong>Reason:</strong> {surgery.reason}
                        </p>
                      </div>
                    )}

                    {/* Additional Notes */}
                    {surgery.notes && (
                      <div className="mt-3 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-muted-foreground">
                          <strong>Notes:</strong> {surgery.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Rejection Reason (if rejected) */}
        {prescription.status === "rejected" && prescription.rejection_reason && (
          <Card className="mb-6 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-700">Rejection Reason</p>
                  <p className="text-sm text-red-600 mt-1">{prescription.rejection_reason}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons (only for pending prescriptions) */}
        {prescription.status === "pending" && (
          <Card>
            <CardContent className="p-6">
              {!showRejectForm ? (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground mb-4">
                    Please review the prescription carefully before accepting or rejecting.
                  </p>
                  <div className="flex gap-4 justify-center flex-wrap">
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                      onClick={() => setShowRejectForm(true)}
                      disabled={actionLoading}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Prescription
                    </Button>
                    <Button
                      variant="default"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={handleAccept}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                      )}
                      Accept Prescription
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Label htmlFor="rejectReason">Reason for Rejection</Label>
                  <Textarea
                    id="rejectReason"
                    placeholder="Please explain why you are rejecting this prescription (e.g., allergies, side effects concern, cost, etc.)"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                  <div className="flex gap-4 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={actionLoading || !rejectReason.trim()}
                    >
                      {actionLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirm Rejection
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Added to History Indicator */}
        {prescription.added_to_history && (
          <Card className="mt-6 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-green-700 dark:text-green-300">
                This prescription has been added to your medical history.
              </span>
            </CardContent>
          </Card>
        )}
      </main>
    </AppBackground>
  );
}
