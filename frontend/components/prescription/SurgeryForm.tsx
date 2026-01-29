"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Scissors, AlertTriangle, Clock } from "lucide-react";
import { SurgeryRecommendationInput, SurgeryUrgency } from "@/lib/prescription-actions";

interface SurgeryFormProps {
  surgeries: SurgeryRecommendationInput[];
  onSurgeriesChange: (surgeries: SurgeryRecommendationInput[]) => void;
}

const PROCEDURE_TYPES = [
  "Major Surgery",
  "Minor Surgery",
  "Diagnostic Procedure",
  "Endoscopy",
  "Laparoscopy",
  "Biopsy",
  "Other",
];

const emptySurgery: SurgeryRecommendationInput = {
  procedure_name: "",
  procedure_type: "Minor Surgery",
  reason: "",
  urgency: "scheduled",
  recommended_date: "",
  pre_op_instructions: "",
  notes: "",
  preferred_facility: "",
};

export function SurgeryForm({ surgeries, onSurgeriesChange }: SurgeryFormProps) {
  const addSurgery = () => {
    onSurgeriesChange([...surgeries, { ...emptySurgery }]);
  };

  const removeSurgery = (index: number) => {
    const updated = surgeries.filter((_, i) => i !== index);
    onSurgeriesChange(updated);
  };

  const updateSurgery = (index: number, field: keyof SurgeryRecommendationInput, value: any) => {
    const updated = [...surgeries];
    updated[index] = { ...updated[index], [field]: value };
    onSurgeriesChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Scissors className="w-5 h-5 text-red-600" />
          Surgery / Procedures
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={addSurgery}>
          <Plus className="w-4 h-4 mr-1" />
          Add Procedure
        </Button>
      </div>

      {surgeries.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
          <Scissors className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No procedures added yet</p>
          <Button type="button" variant="ghost" size="sm" onClick={addSurgery} className="mt-2">
            <Plus className="w-4 h-4 mr-1" />
            Add First Procedure
          </Button>
        </div>
      )}

      {surgeries.map((surgery, index) => (
        <Card key={index} className="rounded-xl border-red-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Procedure {index + 1}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeSurgery(index)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Procedure Name & Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Procedure Name *</Label>
                <Input
                  value={surgery.procedure_name}
                  onChange={(e) => updateSurgery(index, "procedure_name", e.target.value)}
                  placeholder="e.g., Appendectomy"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Procedure Type</Label>
                <select
                  value={surgery.procedure_type || ""}
                  onChange={(e) => updateSurgery(index, "procedure_type", e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select type...</option>
                  {PROCEDURE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Urgency */}
            <div className="space-y-2">
              <Label>Urgency</Label>
              <div className="flex gap-3">
                <div
                  onClick={() => updateSurgery(index, "urgency", "scheduled")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    surgery.urgency === "scheduled"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Clock className={`w-4 h-4 ${surgery.urgency === "scheduled" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Scheduled</span>
                </div>
                <div
                  onClick={() => updateSurgery(index, "urgency", "immediate")}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    surgery.urgency === "immediate"
                      ? "border-destructive bg-destructive/10"
                      : "border-border hover:border-destructive/50"
                  }`}
                >
                  <AlertTriangle className={`w-4 h-4 ${surgery.urgency === "immediate" ? "text-destructive" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Immediate</span>
                </div>
              </div>
            </div>

            {/* Date & Facility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recommended Date</Label>
                <Input
                  type="date"
                  value={surgery.recommended_date || ""}
                  onChange={(e) => updateSurgery(index, "recommended_date", e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Facility</Label>
                <Input
                  value={surgery.preferred_facility || ""}
                  onChange={(e) => updateSurgery(index, "preferred_facility", e.target.value)}
                  placeholder="e.g., Square Hospital"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Cost Estimate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Cost (Min)</Label>
                <Input
                  type="number"
                  min="0"
                  value={surgery.estimated_cost_min || ""}
                  onChange={(e) => updateSurgery(index, "estimated_cost_min", parseFloat(e.target.value) || undefined)}
                  placeholder="e.g., 50000"
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Cost (Max)</Label>
                <Input
                  type="number"
                  min="0"
                  value={surgery.estimated_cost_max || ""}
                  onChange={(e) => updateSurgery(index, "estimated_cost_max", parseFloat(e.target.value) || undefined)}
                  placeholder="e.g., 80000"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason for Procedure</Label>
              <Textarea
                value={surgery.reason || ""}
                onChange={(e) => updateSurgery(index, "reason", e.target.value)}
                placeholder="Explain why this procedure is recommended..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>

            {/* Pre-op Instructions */}
            <div className="space-y-2">
              <Label>Pre-operative Instructions</Label>
              <Textarea
                value={surgery.pre_op_instructions || ""}
                onChange={(e) => updateSurgery(index, "pre_op_instructions", e.target.value)}
                placeholder="e.g., NPO (nothing by mouth) 8 hours before surgery..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                value={surgery.notes || ""}
                onChange={(e) => updateSurgery(index, "notes", e.target.value)}
                placeholder="Any additional information..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
