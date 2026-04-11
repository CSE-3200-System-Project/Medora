"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ButtonLoader, MedoraLoader } from "@/components/ui/medora-loader";
import {
  Pill,
  Sun,
  Cloud,
  Moon,
  Star,
  Calendar,
  User,
  FileText,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildFrequencyFromDoseSchedule,
  normalizeDoseAmount,
  normalizeMealInstruction,
  parseDoseScheduleFromFrequency,
  type DoseSchedule,
  type MealInstructionValue,
  type PatientMedication,
} from "@/lib/patient-medication";
import { useT } from "@/i18n/client";

// Types
interface MedicineResult {
  drug_id: string;
  brand_id?: string;
  display_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  medicine_type?: string;
  manufacturer?: string;
  is_brand: boolean;
}

export type Medication = PatientMedication;

const DEFAULT_SCHEDULE: DoseSchedule = {
  dose_morning: false,
  dose_afternoon: false,
  dose_evening: false,
  dose_night: false,
  dose_morning_amount: "1",
  dose_afternoon_amount: "1",
  dose_evening_amount: "1",
  dose_night_amount: "1",
};

const MEAL_INSTRUCTION_VALUES: MealInstructionValue[] = [
  "after_meal",
  "before_meal",
  "with_meal",
  "empty_stomach",
  "any_time",
];

function hasAtLeastOneDose(schedule: DoseSchedule) {
  return (
    schedule.dose_morning ||
    schedule.dose_afternoon ||
    schedule.dose_evening ||
    schedule.dose_night
  );
}

interface AddMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (medication: Medication) => void;
  prefilledMedicine?: MedicineResult | null;
  editingMedication?: Medication | null;
}

export function AddMedicationDialog({
  open,
  onOpenChange,
  onAdd,
  prefilledMedicine,
  editingMedication,
}: AddMedicationDialogProps) {
  const tCommon = useT("common");
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedicineResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineResult | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    dosage: "",
    frequency: buildFrequencyFromDoseSchedule(DEFAULT_SCHEDULE),
    dose_morning: DEFAULT_SCHEDULE.dose_morning,
    dose_afternoon: DEFAULT_SCHEDULE.dose_afternoon,
    dose_evening: DEFAULT_SCHEDULE.dose_evening,
    dose_night: DEFAULT_SCHEDULE.dose_night,
    dose_morning_amount: DEFAULT_SCHEDULE.dose_morning_amount,
    dose_afternoon_amount: DEFAULT_SCHEDULE.dose_afternoon_amount,
    dose_evening_amount: DEFAULT_SCHEDULE.dose_evening_amount,
    dose_night_amount: DEFAULT_SCHEDULE.dose_night_amount,
    meal_instruction: "after_meal" as MealInstructionValue,
    duration: "",
    status: "current" as "current" | "past",
    started_date: "",
    stopped_date: "",
    prescribing_doctor: "",
    notes: "",
  });

  const mealInstructionOptions = React.useMemo(
    () =>
      MEAL_INSTRUCTION_VALUES.map((value) => ({
        value,
        label: tCommon(`medicine.addDialog.mealInstructions.${value}`),
      })),
    [tCommon],
  );

  // Initialize with prefilled medicine or editing medication
  useEffect(() => {
    if (prefilledMedicine) {
      setSelectedMedicine(prefilledMedicine);
      setStep(2);
    } else if (editingMedication) {
      const parsed = parseDoseScheduleFromFrequency(editingMedication.frequency);
      const schedule: DoseSchedule = {
        dose_morning: editingMedication.dose_morning ?? parsed.dose_morning,
        dose_afternoon: editingMedication.dose_afternoon ?? parsed.dose_afternoon,
        dose_evening: editingMedication.dose_evening ?? parsed.dose_evening,
        dose_night: editingMedication.dose_night ?? parsed.dose_night,
        dose_morning_amount:
          editingMedication.dose_morning_amount ?? parsed.dose_morning_amount,
        dose_afternoon_amount:
          editingMedication.dose_afternoon_amount ?? parsed.dose_afternoon_amount,
        dose_evening_amount:
          editingMedication.dose_evening_amount ?? parsed.dose_evening_amount,
        dose_night_amount:
          editingMedication.dose_night_amount ?? parsed.dose_night_amount,
      };
      setSelectedMedicine({
        drug_id: editingMedication.drug_id,
        brand_id: editingMedication.brand_id,
        display_name: editingMedication.display_name,
        generic_name: editingMedication.generic_name,
        strength: editingMedication.strength,
        dosage_form: editingMedication.dosage_form,
        is_brand: !!editingMedication.brand_id,
      });
      setFormData({
        dosage: editingMedication.dosage,
        frequency: editingMedication.frequency || buildFrequencyFromDoseSchedule(schedule),
        dose_morning: schedule.dose_morning,
        dose_afternoon: schedule.dose_afternoon,
        dose_evening: schedule.dose_evening,
        dose_night: schedule.dose_night,
        dose_morning_amount: normalizeDoseAmount(schedule.dose_morning_amount),
        dose_afternoon_amount: normalizeDoseAmount(schedule.dose_afternoon_amount),
        dose_evening_amount: normalizeDoseAmount(schedule.dose_evening_amount),
        dose_night_amount: normalizeDoseAmount(schedule.dose_night_amount),
        meal_instruction: normalizeMealInstruction(editingMedication.meal_instruction),
        duration: editingMedication.duration,
        status: editingMedication.status,
        started_date: editingMedication.started_date || "",
        stopped_date: editingMedication.stopped_date || "",
        prescribing_doctor: editingMedication.prescribing_doctor || "",
        notes: editingMedication.notes || "",
      });
      setStep(2);
    }
  }, [prefilledMedicine, editingMedication]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setSearchQuery("");
        setSearchResults([]);
        setSelectedMedicine(null);
        setFormData({
          dosage: "",
          frequency: buildFrequencyFromDoseSchedule(DEFAULT_SCHEDULE),
          dose_morning: DEFAULT_SCHEDULE.dose_morning,
          dose_afternoon: DEFAULT_SCHEDULE.dose_afternoon,
          dose_evening: DEFAULT_SCHEDULE.dose_evening,
          dose_night: DEFAULT_SCHEDULE.dose_night,
          dose_morning_amount: DEFAULT_SCHEDULE.dose_morning_amount,
          dose_afternoon_amount: DEFAULT_SCHEDULE.dose_afternoon_amount,
          dose_evening_amount: DEFAULT_SCHEDULE.dose_evening_amount,
          dose_night_amount: DEFAULT_SCHEDULE.dose_night_amount,
          meal_instruction: "after_meal",
          duration: "",
          status: "current",
          started_date: "",
          stopped_date: "",
          prescribing_doctor: "",
          notes: "",
        });
      }, 200);
    }
  }, [open]);

  // Search medicines
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const params = new URLSearchParams({ q: query, limit: "8" });

      const response = await fetch(`${backendUrl}/medicine/search?${params}`);

      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.results || []);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Medicine search error:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSelectMedicine = (medicine: MedicineResult) => {
    setSelectedMedicine(medicine);
    setSearchResults([]);
    setSearchQuery("");
    setStep(2);
  };

  const updateSchedule = (updates: Partial<DoseSchedule>) => {
    setFormData((prev) => {
      const nextSchedule: DoseSchedule = {
        dose_morning: updates.dose_morning ?? prev.dose_morning,
        dose_afternoon: updates.dose_afternoon ?? prev.dose_afternoon,
        dose_evening: updates.dose_evening ?? prev.dose_evening,
        dose_night: updates.dose_night ?? prev.dose_night,
        dose_morning_amount: updates.dose_morning_amount ?? prev.dose_morning_amount,
        dose_afternoon_amount: updates.dose_afternoon_amount ?? prev.dose_afternoon_amount,
        dose_evening_amount: updates.dose_evening_amount ?? prev.dose_evening_amount,
        dose_night_amount: updates.dose_night_amount ?? prev.dose_night_amount,
      };

      return {
        ...prev,
        ...updates,
        frequency: buildFrequencyFromDoseSchedule(nextSchedule),
      };
    });
  };

  const handleSave = async () => {
    const hasDoseSchedule = hasAtLeastOneDose(formData);
    if (!selectedMedicine || !formData.dosage || !hasDoseSchedule) {
      alert(tCommon("medicine.addDialog.validationRequired"));
      return;
    }

    setSaving(true);
    const frequency = buildFrequencyFromDoseSchedule(formData);

    const medication: Medication = {
      id: crypto.randomUUID(),
      drug_id: selectedMedicine.drug_id,
      brand_id: selectedMedicine.brand_id,
      display_name: selectedMedicine.display_name,
      generic_name: selectedMedicine.generic_name,
      strength: selectedMedicine.strength,
      dosage_form: selectedMedicine.dosage_form,
      ...formData,
      frequency,
      meal_instruction: normalizeMealInstruction(formData.meal_instruction),
    };

    await new Promise((resolve) => setTimeout(resolve, 500));
    onAdd(medication);
    setSaving(false);
    onOpenChange(false);
  };

  const canProceed = () => {
    if (step === 1) return !!selectedMedicine;
    if (step === 2) return formData.dosage && hasAtLeastOneDose(formData);
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            {editingMedication
              ? tCommon("medicine.addDialog.editMedication")
              : tCommon("medicine.addDialog.addMedication")}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && tCommon("medicine.addDialog.step1Description")}
            {step === 2 && tCommon("medicine.addDialog.step2Description")}
            {step === 3 && tCommon("medicine.addDialog.step3Description")}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground"
                )}
              >
                {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-12 h-0.5 mx-1 transition-colors",
                    step > s ? "bg-primary" : "bg-surface"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="space-y-4 min-h-[300px]">
          {/* Step 1: Search Medicine */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search">{tCommon("medicine.addDialog.searchMedicine")}</Label>
                <div>
                  <Input
                    id="search"
                    placeholder={tCommon("medicine.addDialog.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Selected Medicine */}
              {selectedMedicine && !searchQuery && (
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Pill className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {selectedMedicine.display_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedMedicine.generic_name}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {selectedMedicine.strength}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {selectedMedicine.dosage_form}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMedicine(null)}
                    >
                      {tCommon("medicine.addDialog.change")}
                    </Button>
                  </div>
                </Card>
              )}

              {/* Search Results */}
              {searchLoading && (
                <div className="flex items-center justify-center py-8">
                  <MedoraLoader size="sm" label={tCommon("medicine.addDialog.searchingMedicines")} />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">
                    {tCommon("medicine.addDialog.resultsFound", { count: searchResults.length })}
                  </p>
                  {searchResults.map((medicine) => (
                    <Card
                      key={`${medicine.drug_id}-${medicine.brand_id || "generic"}`}
                      className="p-3 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      onClick={() => handleSelectMedicine(medicine)}
                    >
                      <div className="flex items-start gap-3">
                        <Pill className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {medicine.display_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {medicine.generic_name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-xs h-5">
                              {medicine.strength}
                            </Badge>
                            <Badge variant="secondary" className="text-xs h-5">
                              {medicine.dosage_form}
                            </Badge>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    {tCommon("medicine.addDialog.noMedicinesFor", { query: searchQuery })}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Dosage Details */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Selected Medicine Info */}
              {selectedMedicine && (
                <Card className="p-3 border-primary/20 bg-primary/5">
                  <div className="flex items-start gap-2">
                    <Pill className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {selectedMedicine.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedMedicine.generic_name} · {selectedMedicine.strength}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dosage" className="flex items-center gap-2">
                    <Pill className="w-4 h-4" />
                    {tCommon("medicine.addDialog.dosage")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dosage"
                    placeholder={tCommon("medicine.addDialog.dosagePlaceholder")}
                    value={formData.dosage}
                    onChange={(e) =>
                      setFormData({ ...formData, dosage: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">{tCommon("medicine.addDialog.duration")}</Label>
                  <Input
                    id="duration"
                    placeholder={tCommon("medicine.addDialog.durationPlaceholder")}
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meal_instruction">{tCommon("medicine.addDialog.mealInstruction")}</Label>
                  <select
                    id="meal_instruction"
                    value={formData.meal_instruction}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        meal_instruction: normalizeMealInstruction(e.target.value),
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {mealInstructionOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">{tCommon("medicine.addDialog.status")}</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as "current" | "past",
                      })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="current">{tCommon("medicine.addDialog.currentlyTaking")}</option>
                    <option value="past">{tCommon("medicine.addDialog.pastMedication")}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>
                  {tCommon("medicine.addDialog.dosageSchedule")} <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button
                    type="button"
                    onClick={() => updateSchedule({ dose_morning: !formData.dose_morning })}
                    className={cn(
                      "flex flex-col items-center rounded-xl border-2 p-3 text-sm transition-all",
                      formData.dose_morning
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Sun className={cn("mb-1 h-5 w-5", formData.dose_morning ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium">{tCommon("medicine.addDialog.timeOfDay.morning")}</span>
                    {formData.dose_morning && (
                      <Input
                        value={formData.dose_morning_amount}
                        onChange={(e) => updateSchedule({ dose_morning_amount: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 h-7 w-16 rounded-lg text-center text-xs"
                        placeholder="1"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSchedule({ dose_afternoon: !formData.dose_afternoon })}
                    className={cn(
                      "flex flex-col items-center rounded-xl border-2 p-3 text-sm transition-all",
                      formData.dose_afternoon
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Cloud className={cn("mb-1 h-5 w-5", formData.dose_afternoon ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium">{tCommon("medicine.addDialog.timeOfDay.afternoon")}</span>
                    {formData.dose_afternoon && (
                      <Input
                        value={formData.dose_afternoon_amount}
                        onChange={(e) => updateSchedule({ dose_afternoon_amount: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 h-7 w-16 rounded-lg text-center text-xs"
                        placeholder="1"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSchedule({ dose_evening: !formData.dose_evening })}
                    className={cn(
                      "flex flex-col items-center rounded-xl border-2 p-3 text-sm transition-all",
                      formData.dose_evening
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Moon className={cn("mb-1 h-5 w-5", formData.dose_evening ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium">{tCommon("medicine.addDialog.timeOfDay.evening")}</span>
                    {formData.dose_evening && (
                      <Input
                        value={formData.dose_evening_amount}
                        onChange={(e) => updateSchedule({ dose_evening_amount: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 h-7 w-16 rounded-lg text-center text-xs"
                        placeholder="1"
                      />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSchedule({ dose_night: !formData.dose_night })}
                    className={cn(
                      "flex flex-col items-center rounded-xl border-2 p-3 text-sm transition-all",
                      formData.dose_night
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <Star className={cn("mb-1 h-5 w-5", formData.dose_night ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-medium">{tCommon("medicine.addDialog.timeOfDay.night")}</span>
                    {formData.dose_night && (
                      <Input
                        value={formData.dose_night_amount}
                        onChange={(e) => updateSchedule({ dose_night_amount: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-2 h-7 w-16 rounded-lg text-center text-xs"
                        placeholder="1"
                      />
                    )}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {tCommon("medicine.addDialog.storedFrequency")}: <span className="font-mono">{formData.frequency}</span>
                </p>
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> {tCommon("medicine.addDialog.requiredFields")}
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Optional Info */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="started_date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {tCommon("medicine.addDialog.startedDate")}
                  </Label>
                  <Input
                    id="started_date"
                    type="date"
                    value={formData.started_date}
                    onChange={(e) =>
                      setFormData({ ...formData, started_date: e.target.value })
                    }
                  />
                </div>

                {formData.status === "past" && (
                  <div className="space-y-2">
                    <Label htmlFor="stopped_date">{tCommon("medicine.addDialog.stoppedDate")}</Label>
                    <Input
                      id="stopped_date"
                      type="date"
                      value={formData.stopped_date}
                      onChange={(e) =>
                        setFormData({ ...formData, stopped_date: e.target.value })
                      }
                    />
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="prescribing_doctor" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {tCommon("medicine.addDialog.prescribingDoctor")}
                  </Label>
                  <Input
                    id="prescribing_doctor"
                    placeholder={tCommon("medicine.addDialog.prescribingDoctorPlaceholder")}
                    value={formData.prescribing_doctor}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        prescribing_doctor: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {tCommon("medicine.addDialog.notes")}
                </Label>
                <Textarea
                  id="notes"
                  placeholder={tCommon("medicine.addDialog.notesPlaceholder")}
                  rows={3}
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="resize-none"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step > 1 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="w-full sm:w-auto"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              {tCommon("back")}
            </Button>
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="w-full sm:w-auto sm:ml-auto"
            >
              {tCommon("medicine.addDialog.next")}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto sm:ml-auto"
            >
              {saving && <ButtonLoader className="w-4 h-4 mr-2" />}
              {editingMedication
                ? tCommon("medicine.addDialog.updateMedication")
                : tCommon("medicine.addDialog.addMedication")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
