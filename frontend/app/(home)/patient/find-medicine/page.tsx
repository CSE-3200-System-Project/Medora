"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { AppBackground } from "@/components/ui/app-background";
import { MedicineCard, MedicineSearch, MedicineDetailDrawer } from "@/components/medicine";
import { AddMedicationDialog, type Medication } from "@/components/medicine/add-medication-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Pill, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { updatePatientOnboarding } from "@/lib/auth-actions";

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

interface MedicineDetail {
  drug_id: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  common_uses?: string;
  common_uses_disclaimer?: string;
  brands: Array<{
    id: string;
    brand_name: string;
    manufacturer?: string;
    medicine_type?: string;
  }>;
}

interface MedicineFilters {
  dosage_form?: string;
  medicine_type?: string;
}

export default function PatientFindMedicinePage() {
  const router = useRouter();
  const [results, setResults] = useState<MedicineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [medicineToAdd, setMedicineToAdd] = useState<MedicineResult | null>(null);

  // Search medicines from backend
  const handleSearch = useCallback(async (query: string, filters: MedicineFilters) => {
    setSearchQuery(query);
    
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const params = new URLSearchParams({ q: query });
      
      if (filters.dosage_form) {
        params.append("dosage_form", filters.dosage_form);
      }
      if (filters.medicine_type) {
        params.append("medicine_type", filters.medicine_type);
      }

      const response = await fetch(`${backendUrl}/medicine/search?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.results || []);
      } else {
        console.error("Search failed:", response.status);
        setResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch medicine details
  const handleMedicineClick = async (medicine: MedicineResult) => {
    setDetailLoading(true);
    setDrawerOpen(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/medicine/${medicine.drug_id}`);
      
      if (response.ok) {
        const data = await response.json();
        setSelectedMedicine(data);
      } else {
        console.error("Failed to fetch medicine details:", response.status);
        setSelectedMedicine(null);
      }
    } catch (error) {
      console.error("Detail fetch error:", error);
      setSelectedMedicine(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Open add dialog with medicine
  const handleAddToMedications = async (medicine: MedicineDetail) => {
    // Convert MedicineDetail to MedicineResult format
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

  // Save medication to backend
  const handleSaveMedication = async (medication: Medication) => {
    try {
      // Get existing medications first
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const token = document.cookie.split('session_token=')[1]?.split(';')[0];
      
      const response = await fetch(`${backendUrl}/profile/patient/onboarding`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      let existingMeds = [];
      if (response.ok) {
        const data = await response.json();
        existingMeds = data.medications || [];
      }
      
      // Convert to backend format (only required fields)
      const newMed: any = {
        name: medication.display_name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        duration: medication.duration,
        generic_name: medication.generic_name || null,
      };
      if (medication.prescribing_doctor && medication.prescribing_doctor.trim()) {
        newMed.prescribing_doctor = medication.prescribing_doctor
      }
      
      const payload = {
        medications: [...existingMeds, newMed]
      };
      
      await updatePatientOnboarding(payload);
      
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
      
      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2">
          <Alert className="bg-success/10 border-success shadow-lg min-w-[300px]">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <AlertDescription className="text-success font-medium">
              Redirecting to Medical History...
            </AlertDescription>
          </Alert>
        </div>
      )}
      
      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-[50px] animate-page-enter">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-2">
            Find Medicine
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Search medicines by brand or generic name
          </p>
        </div>

        {/* Disclaimer */}
        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-sm">
            This information is for general awareness only. Always consult your doctor before taking any medication.
          </AlertDescription>
        </Alert>

        {/* Search */}
        <MedicineSearch
          onSearch={handleSearch}
          loading={loading}
          resultCount={searchQuery.length >= 2 ? results.length : undefined}
        />

        {/* Results */}
        <div className="mt-6 space-y-3">
          {loading ? (
            // Loading skeleton
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
            // No results
            <div className="text-center py-12 bg-white rounded-2xl border border-border">
              <Search className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">No medicines found</p>
              <p className="text-sm text-muted-foreground">
                Try searching with a different name or spelling
              </p>
            </div>
          ) : searchQuery.length < 2 ? (
            // Initial state
            <div className="text-center py-12 bg-white rounded-2xl border border-border">
              <Pill className="h-12 w-12 text-primary/30 mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">
                Search for medicines
              </p>
              <p className="text-sm text-muted-foreground">
                Enter at least 2 characters to start searching
              </p>
            </div>
          ) : (
            // Results list
            results.map((medicine) => (
              <MedicineCard
                key={`${medicine.drug_id}-${medicine.brand_id || 'generic'}`}
                medicine={medicine}
                onClick={() => handleMedicineClick(medicine)}
              />
            ))
          )}
        </div>
      </main>

      {/* Medicine Detail Drawer */}
      <MedicineDetailDrawer
        medicine={selectedMedicine}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAddToMedications={handleAddToMedications}
      />

      {/* Add Medication Dialog */}
      <AddMedicationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleSaveMedication}
        prefilledMedicine={medicineToAdd}
      />

      {/* Loading overlay for detail */}
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