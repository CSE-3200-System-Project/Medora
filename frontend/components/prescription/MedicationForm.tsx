"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Pill, Sun, Cloud, Moon, Star, X, Loader2 } from "lucide-react";
import { MedicationPrescriptionInput, MedicineType, MealInstruction, DurationUnit } from "@/lib/prescription-actions";

interface MedicationFormProps {
  medications: MedicationPrescriptionInput[];
  onMedicationsChange: (medications: MedicationPrescriptionInput[]) => void;
}

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

const MEDICINE_TYPES: { value: MedicineType; label: string }[] = [
  { value: "tablet", label: "Tablet" },
  { value: "capsule", label: "Capsule" },
  { value: "syrup", label: "Syrup" },
  { value: "injection", label: "Injection" },
  { value: "cream", label: "Cream" },
  { value: "ointment", label: "Ointment" },
  { value: "drops", label: "Drops" },
  { value: "inhaler", label: "Inhaler" },
  { value: "powder", label: "Powder" },
  { value: "gel", label: "Gel" },
  { value: "other", label: "Other" },
];

const MEAL_INSTRUCTIONS: { value: MealInstruction; label: string }[] = [
  { value: "after_meal", label: "After Meal" },
  { value: "before_meal", label: "Before Meal" },
  { value: "with_meal", label: "With Meal" },
  { value: "empty_stomach", label: "Empty Stomach" },
  { value: "any_time", label: "Any Time" },
];

const DURATION_UNITS: { value: DurationUnit; label: string }[] = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

const emptyMedication: MedicationPrescriptionInput = {
  medicine_name: "",
  generic_name: "",
  medicine_type: "tablet",
  strength: "",
  dose_morning: false,
  dose_afternoon: false,
  dose_evening: false,
  dose_night: false,
  dose_morning_amount: "1",
  dose_afternoon_amount: "1",
  dose_evening_amount: "1",
  dose_night_amount: "1",
  duration_value: 7,
  duration_unit: "days",
  meal_instruction: "after_meal",
  special_instructions: "",
};

// Medicine Search Input with Autocomplete
function MedicineSearchInput({
  value,
  onChange,
  onSelectMedicine,
}: {
  value: string;
  onChange: (name: string) => void;
  onSelectMedicine: (medicine: MedicineResult) => void;
}) {
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<MedicineResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const response = await fetch(`${backendUrl}/medicine/search?q=${encodeURIComponent(query)}&limit=15`);
        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        }
      } catch (error) {
        console.error("Medicine search error:", error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync with external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    onChange(newValue);
    if (!isOpen && newValue.length >= 2) setIsOpen(true);
  };

  const handleSelect = (medicine: MedicineResult) => {
    setQuery(medicine.display_name);
    onChange(medicine.display_name);
    onSelectMedicine(medicine);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder="Search medicine name..."
          className="pr-10 rounded-lg"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <button
              type="button"
              onClick={() => { setQuery(""); onChange(""); }}
              className="p-1 hover:bg-muted rounded"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-primary/20 rounded-lg shadow-xl max-h-60 overflow-y-auto">
          <ul className="py-1">
            {results.map((medicine, idx) => (
              <li key={`${medicine.drug_id}-${idx}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(medicine)}
                  className="w-full px-4 py-2.5 text-left hover:bg-primary/5 transition-colors"
                >
                  <div className="font-medium text-foreground">{medicine.display_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>{medicine.generic_name}</span>
                    {medicine.strength && <span>• {medicine.strength}</span>}
                    {medicine.dosage_form && <span>• {medicine.dosage_form}</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-primary/20 rounded-lg shadow-xl p-3 text-center text-sm text-muted-foreground">
          No medicines found. You can type a custom name.
        </div>
      )}
    </div>
  );
}

export function MedicationForm({ medications, onMedicationsChange }: MedicationFormProps) {
  const addMedication = () => {
    onMedicationsChange([...medications, { ...emptyMedication }]);
  };

  const removeMedication = (index: number) => {
    const updated = medications.filter((_, i) => i !== index);
    onMedicationsChange(updated);
  };

  const updateMedication = (index: number, field: keyof MedicationPrescriptionInput, value: any) => {
    const updated = [...medications];
    updated[index] = { ...updated[index], [field]: value };
    onMedicationsChange(updated);
  };

  const handleSelectMedicine = (index: number, medicine: MedicineResult) => {
    const updated = [...medications];
    const dosageForm = medicine.dosage_form?.toLowerCase() || "tablet";
    const medicineType = MEDICINE_TYPES.find(t => 
      dosageForm.includes(t.value) || t.label.toLowerCase() === dosageForm
    )?.value || "tablet";

    updated[index] = {
      ...updated[index],
      medicine_name: medicine.display_name,
      generic_name: medicine.generic_name,
      strength: medicine.strength || "",
      medicine_type: medicineType,
    };
    onMedicationsChange(updated);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary" />
          Medications
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={addMedication}>
          <Plus className="w-4 h-4 mr-1" />
          Add Medicine
        </Button>
      </div>

      {medications.length === 0 && (
        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
          <Pill className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No medications added yet</p>
          <Button type="button" variant="ghost" size="sm" onClick={addMedication} className="mt-2">
            <Plus className="w-4 h-4 mr-1" />
            Add First Medicine
          </Button>
        </div>
      )}

      {medications.map((med, index) => (
        <Card key={index} className="rounded-xl border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Medicine {index + 1}</CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeMedication(index)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Medicine Name & Generic Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Medicine Name *</Label>
                <MedicineSearchInput
                  value={med.medicine_name}
                  onChange={(name) => updateMedication(index, "medicine_name", name)}
                  onSelectMedicine={(medicine) => handleSelectMedicine(index, medicine)}
                />
              </div>
              <div className="space-y-2">
                <Label>Generic Name</Label>
                <Input
                  value={med.generic_name || ""}
                  onChange={(e) => updateMedication(index, "generic_name", e.target.value)}
                  placeholder="e.g., Paracetamol + Caffeine"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Type & Strength */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Medicine Type</Label>
                <select
                  value={med.medicine_type}
                  onChange={(e) => updateMedication(index, "medicine_type", e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {MEDICINE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Strength</Label>
                <Input
                  value={med.strength || ""}
                  onChange={(e) => updateMedication(index, "strength", e.target.value)}
                  placeholder="e.g., 500mg, 10ml"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Dosage Schedule */}
            <div className="space-y-2">
              <Label>Dosage Schedule</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Morning */}
                <div
                  onClick={() => updateMedication(index, "dose_morning", !med.dose_morning)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    med.dose_morning
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Sun className={`w-6 h-6 mb-1 ${med.dose_morning ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Morning</span>
                  {med.dose_morning && (
                    <Input
                      value={med.dose_morning_amount || "1"}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateMedication(index, "dose_morning_amount", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="1"
                      className="w-16 h-7 text-center mt-2 text-xs rounded-lg"
                    />
                  )}
                </div>

                {/* Afternoon */}
                <div
                  onClick={() => updateMedication(index, "dose_afternoon", !med.dose_afternoon)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    med.dose_afternoon
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Cloud className={`w-6 h-6 mb-1 ${med.dose_afternoon ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Afternoon</span>
                  {med.dose_afternoon && (
                    <Input
                      value={med.dose_afternoon_amount || "1"}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateMedication(index, "dose_afternoon_amount", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="1"
                      className="w-16 h-7 text-center mt-2 text-xs rounded-lg"
                    />
                  )}
                </div>

                {/* Evening */}
                <div
                  onClick={() => updateMedication(index, "dose_evening", !med.dose_evening)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    med.dose_evening
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Moon className={`w-6 h-6 mb-1 ${med.dose_evening ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Evening</span>
                  {med.dose_evening && (
                    <Input
                      value={med.dose_evening_amount || "1"}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateMedication(index, "dose_evening_amount", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="1"
                      className="w-16 h-7 text-center mt-2 text-xs rounded-lg"
                    />
                  )}
                </div>

                {/* Night */}
                <div
                  onClick={() => updateMedication(index, "dose_night", !med.dose_night)}
                  className={`flex flex-col items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    med.dose_night
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Star className={`w-6 h-6 mb-1 ${med.dose_night ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-sm font-medium">Night</span>
                  {med.dose_night && (
                    <Input
                      value={med.dose_night_amount || "1"}
                      onChange={(e) => {
                        e.stopPropagation();
                        updateMedication(index, "dose_night_amount", e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="1"
                      className="w-16 h-7 text-center mt-2 text-xs rounded-lg"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Duration & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={med.duration_value || ""}
                    onChange={(e) => updateMedication(index, "duration_value", parseInt(e.target.value) || undefined)}
                    placeholder="7"
                    className="rounded-lg w-20"
                  />
                  <select
                    value={med.duration_unit}
                    onChange={(e) => updateMedication(index, "duration_unit", e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {DURATION_UNITS.map((unit) => (
                      <option key={unit.value} value={unit.value}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meal Instructions</Label>
                <select
                  value={med.meal_instruction}
                  onChange={(e) => updateMedication(index, "meal_instruction", e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm"
                >
                  {MEAL_INSTRUCTIONS.map((inst) => (
                    <option key={inst.value} value={inst.value}>
                      {inst.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={med.quantity || ""}
                  onChange={(e) => updateMedication(index, "quantity", parseInt(e.target.value) || undefined)}
                  placeholder="e.g., 21"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div className="space-y-2">
              <Label>Special Instructions</Label>
              <Textarea
                value={med.special_instructions || ""}
                onChange={(e) => updateMedication(index, "special_instructions", e.target.value)}
                placeholder="e.g., Take with plenty of water, avoid dairy products..."
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

