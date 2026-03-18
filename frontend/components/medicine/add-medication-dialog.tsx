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
import {
  Search,
  Pill,
  Clock,
  Calendar,
  User,
  FileText,
  Loader2,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export interface Medication {
  id: string;
  drug_id: string;
  brand_id?: string;
  display_name: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: "current" | "past";
  started_date?: string;
  stopped_date?: string;
  prescribing_doctor?: string;
  notes?: string;
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
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedicineResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineResult | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    dosage: "",
    frequency: "",
    duration: "",
    status: "current" as "current" | "past",
    started_date: "",
    stopped_date: "",
    prescribing_doctor: "",
    notes: "",
  });

  // Initialize with prefilled medicine or editing medication
  useEffect(() => {
    if (prefilledMedicine) {
      setSelectedMedicine(prefilledMedicine);
      setStep(2);
    } else if (editingMedication) {
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
        frequency: editingMedication.frequency,
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
          frequency: "",
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

  const handleSave = async () => {
    if (!selectedMedicine || !formData.dosage || !formData.frequency) {
      alert("Please fill in medicine, dosage, and frequency");
      return;
    }

    setSaving(true);

    const medication: Medication = {
      id: crypto.randomUUID(),
      drug_id: selectedMedicine.drug_id,
      brand_id: selectedMedicine.brand_id,
      display_name: selectedMedicine.display_name,
      generic_name: selectedMedicine.generic_name,
      strength: selectedMedicine.strength,
      dosage_form: selectedMedicine.dosage_form,
      ...formData,
    };

    await new Promise((resolve) => setTimeout(resolve, 500));
    onAdd(medication);
    setSaving(false);
    onOpenChange(false);
  };

  const canProceed = () => {
    if (step === 1) return !!selectedMedicine;
    if (step === 2) return formData.dosage && formData.frequency;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl sm:text-2xl">
            {editingMedication ? "Edit Medication" : "Add Medication"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Search and select a medicine"}
            {step === 2 && "Enter dosage and frequency details"}
            {step === 3 && "Add optional information"}
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
                <Label htmlFor="search">Search Medicine</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Type medicine name or brand..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
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
                      Change
                    </Button>
                  </div>
                </Card>
              )}

              {/* Search Results */}
              {searchLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  <p className="text-sm text-muted-foreground">
                    {searchResults.length} results found
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
                  <p className="text-sm">No medicines found for &quot;{searchQuery}&quot;</p>
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
                    Dosage <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dosage"
                    placeholder="e.g., 1 tablet"
                    value={formData.dosage}
                    onChange={(e) =>
                      setFormData({ ...formData, dosage: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Frequency <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="frequency"
                    placeholder="e.g., 3 times daily"
                    value={formData.frequency}
                    onChange={(e) =>
                      setFormData({ ...formData, frequency: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input
                    id="duration"
                    placeholder="e.g., 7 days"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
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
                    <option value="current">Currently Taking</option>
                    <option value="past">Past Medication</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs text-muted-foreground">
                  <span className="text-destructive">*</span> Required fields
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
                    Started Date
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
                    <Label htmlFor="stopped_date">Stopped Date</Label>
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
                    Prescribing Doctor
                  </Label>
                  <Input
                    id="prescribing_doctor"
                    placeholder="Doctor's name"
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
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes or instructions..."
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
              Back
            </Button>
          )}

          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
              className="w-full sm:w-auto sm:ml-auto"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto sm:ml-auto"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingMedication ? "Update Medication" : "Add Medication"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
