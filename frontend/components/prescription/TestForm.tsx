"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FlaskConical, AlertTriangle } from "lucide-react";
import { TestPrescriptionInput, TestUrgency } from "@/lib/prescription-actions";
import { MedicalTestSearch } from "@/components/medical-test";

interface TestFormProps {
  tests: TestPrescriptionInput[];
  onTestsChange: (tests: TestPrescriptionInput[]) => void;
}

const TEST_TYPES = [
  "Blood Test",
  "Urine Test",
  "Imaging (X-Ray)",
  "Imaging (CT Scan)",
  "Imaging (MRI)",
  "Imaging (Ultrasound)",
  "ECG",
  "Echocardiogram",
  "Endoscopy",
  "Biopsy",
  "Pathology",
  "Other",
];

const emptyTest: TestPrescriptionInput = {
  test_name: "",
  test_type: "Blood Test",
  instructions: "",
  urgency: "normal",
  preferred_lab: "",
};

export function TestForm({ tests, onTestsChange }: TestFormProps) {
  const addTest = () => {
    onTestsChange([...tests, { ...emptyTest }]);
  };

  const removeTest = (index: number) => {
    const updated = tests.filter((_, i) => i !== index);
    onTestsChange(updated);
  };

  const updateTest = (index: number, field: keyof TestPrescriptionInput, value: any) => {
    const updated = [...tests];
    updated[index] = { ...updated[index], [field]: value };
    onTestsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-purple-600" />
          Medical Tests
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={addTest}>
          <Plus className="w-4 h-4 mr-1" />
          Add Test
        </Button>
      </div>

      {tests.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
          <FlaskConical className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No tests added yet</p>
          <Button type="button" variant="ghost" size="sm" onClick={addTest} className="mt-2">
            <Plus className="w-4 h-4 mr-1" />
            Add First Test
          </Button>
        </div>
      )}

      {tests.map((test, index) => (
        <Card key={index} className="rounded-xl border-purple-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Test {index + 1}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeTest(index)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Test Name & Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Test Name *</Label>
                <MedicalTestSearch
                  value={test.test_name}
                  onChange={(testName) => updateTest(index, "test_name", testName)}
                  placeholder="Search or type test name..."
                />
              </div>
              <div className="space-y-2">
                <Label>Test Type</Label>
                <select
                  value={test.test_type || ""}
                  onChange={(e) => updateTest(index, "test_type", e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  <option value="">Select type...</option>
                  {TEST_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Urgency & Lab */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Urgency</Label>
                <div className="flex gap-3">
                  <div
                    onClick={() => updateTest(index, "urgency", "normal")}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      test.urgency === "normal"
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span className="text-sm font-medium">Normal</span>
                  </div>
                  <div
                    onClick={() => updateTest(index, "urgency", "urgent")}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      test.urgency === "urgent"
                        ? "border-destructive bg-destructive/10"
                        : "border-border hover:border-destructive/50"
                    }`}
                  >
                    <AlertTriangle className={`w-4 h-4 ${test.urgency === "urgent" ? "text-destructive" : "text-muted-foreground"}`} />
                    <span className="text-sm font-medium">Urgent</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preferred Lab</Label>
                <Input
                  value={test.preferred_lab || ""}
                  onChange={(e) => updateTest(index, "preferred_lab", e.target.value)}
                  placeholder="e.g., Popular Diagnostic Centre"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Expected Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input
                  type="date"
                  value={test.expected_date || ""}
                  onChange={(e) => updateTest(index, "expected_date", e.target.value)}
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label>Instructions for Patient</Label>
              <Textarea
                value={test.instructions || ""}
                onChange={(e) => updateTest(index, "instructions", e.target.value)}
                placeholder="e.g., Fasting required for 12 hours before test..."
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
