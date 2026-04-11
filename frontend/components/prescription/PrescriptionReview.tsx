"use client";

import React from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Pill, 
  FlaskConical, 
  Scissors, 
  Sun, 
  Cloud, 
  Moon, 
  Star,
  Clock,
  AlertTriangle,
  MapPin,
  Calendar,
  Info
} from "lucide-react";
import { 
  MedicationPrescriptionInput, 
  TestPrescriptionInput, 
  SurgeryRecommendationInput,
  PrescriptionType 
} from "@/lib/prescription-actions";

interface PrescriptionReviewProps {
  type: PrescriptionType;
  medications: MedicationPrescriptionInput[];
  tests: TestPrescriptionInput[];
  surgeries: SurgeryRecommendationInput[];
  notes?: string;
  attachmentPreviewUrl?: string | null;
  attachmentName?: string;
  attachmentKind?: "image" | "pdf" | null;
}

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

export function PrescriptionReview({
  medications,
  tests,
  surgeries,
  notes,
  attachmentPreviewUrl,
  attachmentName,
  attachmentKind,
}: PrescriptionReviewProps) {
  // Check if ANY type has content (not just the active type)
  const hasMedications = medications.length > 0;
  const hasTests = tests.length > 0;
  const hasSurgeries = surgeries.length > 0;
  const hasContent = hasMedications || hasTests || hasSurgeries;

  if (!hasContent) {
    return (
      <Card className="rounded-xl border-dashed">
        <CardContent className="p-8 text-center text-muted-foreground">
          <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No items to review</p>
          <p className="text-sm mt-1">Add items above to see preview</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Info className="w-5 h-5 text-primary" />
        Prescription Preview
      </h3>

      {attachmentPreviewUrl && (
        <Card className="rounded-xl border-border/70 bg-card/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attachment Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {attachmentName ? <p className="text-sm text-muted-foreground truncate">{attachmentName}</p> : null}
            {attachmentKind === "pdf" ? (
              <iframe
                src={attachmentPreviewUrl}
                title="Prescription attachment preview"
                className="h-64 w-full rounded-lg border border-border/60 bg-background"
              />
            ) : (
              <Image
                src={attachmentPreviewUrl}
                alt={attachmentName || "Prescription attachment preview"}
                width={1200}
                height={900}
                className="h-64 w-full rounded-lg border border-border/60 bg-background object-contain"
                unoptimized
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Medications Review - Show if there are any medications */}
      {hasMedications && (
        <Card className="rounded-xl bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="w-5 h-5 text-primary" />
              Medications ({medications.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {medications.map((med, index) => (
              <div key={index} className="bg-card rounded-lg p-4 border">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-foreground">{med.medicine_name}</h4>
                    {med.generic_name && (
                      <p className="text-sm text-muted-foreground">{med.generic_name}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-xs">
                      {getMedicineTypeLabel(med.medicine_type || "tablet")}
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
                      <span>Afternoon {med.dose_afternoon_amount && `(${med.dose_afternoon_amount})`}</span>
                    </div>
                  )}
                  {med.dose_evening && (
                    <div className="flex items-center gap-1 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-lg text-xs">
                      <Moon className="w-3 h-3" />
                      <span>Evening {med.dose_evening_amount && `(${med.dose_evening_amount})`}</span>
                    </div>
                  )}
                  {med.dose_night && (
                    <div className="flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg text-xs">
                      <Star className="w-3 h-3" />
                      <span>Night {med.dose_night_amount && `(${med.dose_night_amount})`}</span>
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
                  <span className="flex items-center gap-1">
                    {getMealInstructionLabel(med.meal_instruction || "after_meal")}
                  </span>
                  {med.quantity && (
                    <span>Qty: {med.quantity}</span>
                  )}
                </div>

                {med.special_instructions && (
                  <p className="text-sm text-muted-foreground mt-2 italic">
                    {med.special_instructions}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tests Review - Show if there are any tests */}
      {hasTests && (
        <Card className="rounded-xl bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              Medical Tests ({tests.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tests.map((test, index) => (
              <div key={index} className="bg-card dark:bg-card rounded-lg p-4 border dark:border-border">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-foreground">{test.test_name}</h4>
                  <div className="flex gap-1">
                    {test.test_type && (
                      <Badge variant="secondary" className="text-xs">{test.test_type}</Badge>
                    )}
                    {test.urgency === "urgent" && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Urgent
                      </Badge>
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
                    {test.instructions}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Surgeries Review - Show if there are any surgeries */}
      {hasSurgeries && (
        <Card className="rounded-xl bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="w-5 h-5 text-red-600 dark:text-red-400" />
              Procedures ({surgeries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {surgeries.map((surgery, index) => (
              <div key={index} className="bg-card dark:bg-card rounded-lg p-4 border dark:border-border">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-foreground">{surgery.procedure_name}</h4>
                  <div className="flex gap-1">
                    {surgery.procedure_type && (
                      <Badge variant="secondary" className="text-xs">{surgery.procedure_type}</Badge>
                    )}
                    {surgery.urgency === "immediate" && (
                      <Badge variant="destructive" className="text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Immediate
                      </Badge>
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
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {notes && (
        <Card className="rounded-xl">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong>Notes:</strong> {notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

