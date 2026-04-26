"use client";

import React, { useState, useCallback } from "react";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { MedicineCard, MedicineSearch, MedicineDetailDrawer } from "@/components/medicine";
import { PrescriptionUploadDemo, type EditableMedication } from "@/components/medicine/prescription-upload-demo";
import { AddMedicationDialog, type Medication } from "@/components/medicine/add-medication-dialog";
import { buildFrequencyFromDoseSchedule, normalizeMealInstruction } from "@/lib/patient-medication";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MedoraLoader } from "@/components/ui/medora-loader";
import { Pill, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getPatientOnboardingData, updatePatientOnboarding } from "@/lib/auth-actions";
import { toBackendPatientMedication } from "@/lib/patient-medication";
import { useT } from "@/i18n/client";
import {
  getMedicineDetails,
  searchMedicines,
  type MedicineDetail,
  type MedicineResult,
  type MedicineSearchFilters,
} from "@/lib/medicine-actions";

export function PatientFindMedicineClient() {
  const tCommon = useT("common");
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
      const newMed = toBackendPatientMedication(medication);

      await updatePatientOnboarding({
        taking_meds: "yes",
        medications: [...existingMeds, newMed],
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving medication:", error);
      alert(tCommon("medicine.patientPage.saveMedicationFailed"));
    }
  };

  const handleApproveScannedMedications = useCallback(
    async (scanned: EditableMedication[]) => {
      // Filter out empty rows and compute the canonical name from the matched DB record
      // when available, falling back to the OCR'd name otherwise.
      const normalizedScanned = scanned
        .map((item) => {
          const matched = item.matched || null;
          const canonicalName = (matched?.display_name || item.name || "").trim();
          return {
            canonicalName,
            originalName: item.name.trim(),
            dosage: item.dosage.trim(),
            frequency: buildFrequencyFromDoseSchedule(item.schedule) || item.frequency || "0+0+0",
            quantity: item.quantity.trim(),
            schedule: item.schedule,
            matched,
          };
        })
        .filter((item) => item.canonicalName);

      if (normalizedScanned.length === 0) {
        throw new Error("No valid medicines to save.");
      }

      const onboardingData = await getPatientOnboardingData();
      const existingMeds = onboardingData?.medications || [];
      const existingKeys = new Set(
        (existingMeds as Array<Record<string, unknown>>)
          .map((item) => {
            const name = String(item.display_name || item.name || "").trim().toLowerCase();
            const dosage = String(item.dosage || item.strength || "").trim().toLowerCase();
            return name ? `${name}|${dosage}` : null;
          })
          .filter((item): item is string => Boolean(item)),
      );

      const additions = normalizedScanned
        .filter((item) => {
          const key = `${item.canonicalName.toLowerCase()}|${item.dosage.toLowerCase()}`;
          return !existingKeys.has(key);
        })
        .map((item) =>
          toBackendPatientMedication({
            id: crypto.randomUUID(),
            // Wire up the canonical DB record so the medication links to the official drug/brand.
            drug_id: item.matched?.drug_id || "",
            brand_id: item.matched?.brand_id || undefined,
            display_name: item.matched?.display_name || item.canonicalName,
            generic_name: item.matched?.generic_name || item.canonicalName,
            strength: item.matched?.strength || item.dosage || "",
            dosage_form: item.matched?.dosage_form || "",
            dosage: item.dosage || item.matched?.strength || "",
            frequency: item.frequency,
            duration: item.quantity || "7 days",
            status: "current",
            meal_instruction: normalizeMealInstruction("after_meal"),
            notes: "Added from prescription scan",
            // Structured dose schedule mirrors the manual add-medication flow.
            dose_morning: item.schedule.dose_morning,
            dose_afternoon: item.schedule.dose_afternoon,
            dose_evening: false,
            dose_night: item.schedule.dose_night,
            dose_morning_amount: item.schedule.dose_morning_amount,
            dose_afternoon_amount: item.schedule.dose_afternoon_amount,
            dose_evening_amount: "1",
            dose_night_amount: item.schedule.dose_night_amount,
          }),
        );

      if (additions.length === 0) {
        throw new Error("These scanned medicines are already in the patient profile.");
      }

      await updatePatientOnboarding({
        taking_meds: "yes",
        medications: [...existingMeds, ...additions],
      });

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    [],
  );

  return (
    <AppBackground className="animate-page-enter">
      <Navbar />

      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <Alert className="bg-success/10 border-success shadow-lg min-w-75">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success font-medium">
              {tCommon("medicine.patientPage.redirectingMedicalHistory")}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <main className="max-w-6xl mx-auto container-padding py-8 pt-[var(--nav-content-offset)] animate-page-enter">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
            {tCommon("medicine.patientPage.title")}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {tCommon("medicine.patientPage.subtitle")}
          </p>
        </div>

        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            {tCommon("medicine.patientPage.awarenessWarning")}
          </AlertDescription>
        </Alert>

        <div className="mb-6">
          <PrescriptionUploadDemo
            enableProfileSave
            onApproveMedications={handleApproveScannedMedications}
          />
        </div>

        <MedicineSearch
          onSearch={handleSearch}
          loading={loading}
          resultCount={searchQuery.length >= 2 ? results.length : undefined}
        />

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="space-y-3">
              <div className="flex justify-center py-2">
                <MedoraLoader size="md" label={tCommon("medicine.patientPage.loadingMedicines")} />
              </div>
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
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">{tCommon("medicine.patientPage.noMedicinesFound")}</p>
              <p className="text-sm text-muted-foreground">
                {tCommon("medicine.patientPage.searchDifferent")}
              </p>
            </div>
          ) : searchQuery.length < 2 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <Pill className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">{tCommon("medicine.patientPage.searchPromptTitle")}</p>
              <p className="text-sm text-muted-foreground">
                {tCommon("medicine.patientPage.searchPromptSubtitle")}
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
            <MedoraLoader size="md" label={tCommon("medicine.patientPage.loadingDetails")} />
          </div>
        </div>
      )}
    </AppBackground>
  );
}


