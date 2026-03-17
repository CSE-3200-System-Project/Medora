"use client";

import React, { useState, useCallback } from "react";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { MedicineCard, MedicineSearch, MedicineDetailDrawer } from "@/components/medicine";
import { PrescriptionUploadDemo } from "@/components/medicine/prescription-upload-demo";
import { AddMedicationDialog, type Medication } from "@/components/medicine/add-medication-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Pill, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getPatientOnboardingData, updatePatientOnboarding } from "@/lib/auth-actions";
import {
  getMedicineDetails,
  searchMedicines,
  type MedicineDetail,
  type MedicineResult,
  type MedicineSearchFilters,
} from "@/lib/medicine-actions";

export function PatientFindMedicineClient() {
  const [results, setResults] = useState<MedicineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [medicineToAdd, setMedicineToAdd] = useState<MedicineResult | null>(null);

  const handleSearch = useCallback(async (query: string, filters: MedicineSearchFilters) => {
    setSearchQuery(query);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const searchResults = await searchMedicines(query, filters);
      setResults(searchResults);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMedicineClick = async (medicine: MedicineResult) => {
    setDetailLoading(true);
    setDrawerOpen(true);

    try {
      const data = await getMedicineDetails(medicine.drug_id);
      setSelectedMedicine(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAddToMedications = async (medicine: MedicineDetail) => {
    const medicineResult: MedicineResult = {
      drug_id: medicine.drug_id,
      display_name: medicine.brands[0]?.brand_name || medicine.generic_name,
      generic_name: medicine.generic_name,
      strength: medicine.strength,
      dosage_form: medicine.dosage_form,
      is_brand: medicine.brands.length > 0,
    };

    setMedicineToAdd(medicineResult);
    setDrawerOpen(false);
    setAddDialogOpen(true);
  };

  const handleSaveMedication = async (medication: Medication) => {
    try {
      const onboardingData = await getPatientOnboardingData();
      const existingMeds = onboardingData?.medications || [];

      const newMed: Record<string, string | null> = {
        name: medication.display_name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        duration: medication.duration,
        generic_name: medication.generic_name || null,
      };

      if (medication.prescribing_doctor && medication.prescribing_doctor.trim()) {
        newMed.prescribing_doctor = medication.prescribing_doctor;
      }

      await updatePatientOnboarding({
        medications: [...existingMeds, newMed],
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving medication:", error);
      alert("Failed to save medication. Please try again.");
    }
  };

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <Alert className="bg-success/10 border-success shadow-lg min-w-75">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success font-medium">
              Redirecting to Medical History...
            </AlertDescription>
          </Alert>
        </div>
      )}

      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-12.5 animate-page-enter">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
            Find Medicine
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Search medicines by brand or generic name
          </p>
        </div>

        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            This information is for general awareness only. Always consult your doctor before taking any medication.
          </AlertDescription>
        </Alert>

        <div className="mb-6">
          <PrescriptionUploadDemo />
        </div>

        <MedicineSearch
          onSearch={handleSearch}
          loading={loading}
          resultCount={searchQuery.length >= 2 ? results.length : undefined}
        />

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="h-12 w-12 rounded-xl bg-surface" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-surface rounded w-1/3" />
                        <div className="h-3 bg-surface rounded w-1/2" />
                        <div className="h-3 bg-surface rounded w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : searchQuery.length >= 2 && results.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-border">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">No medicines found</p>
              <p className="text-sm text-muted-foreground">
                Try searching with a different name or spelling
              </p>
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-border">
              <Pill className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">Search for medicines</p>
              <p className="text-sm text-muted-foreground">
                Enter at least 2 characters to start searching
              </p>
            </div>
          ) : (
            results.map((medicine) => (
              <MedicineCard
                key={`${medicine.drug_id}-${medicine.brand_id || "generic"}`}
                medicine={medicine}
                onClick={() => handleMedicineClick(medicine)}
              />
            ))
          )}
        </div>
      </main>

      <MedicineDetailDrawer
        medicine={selectedMedicine}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAddToMedications={handleAddToMedications}
      />

      <AddMedicationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleSaveMedication}
        prefilledMedicine={medicineToAdd}
      />

      {drawerOpen && detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-xl p-6 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading details...</p>
          </div>
        </div>
      )}
    </AppBackground>
  );
}
