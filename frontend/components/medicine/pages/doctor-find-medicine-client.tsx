"use client";

import React, { useState, useCallback } from "react";
import { Navbar } from "@/components/ui/navbar";
import { MedicineCard, MedicineSearch, MedicineDetailDrawer } from "@/components/medicine";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Pill, Search, Info } from "lucide-react";
import { AppBackground } from "@/components/ui/app-background";
import {
  getMedicineDetails,
  searchMedicines,
  type MedicineDetail,
  type MedicineResult,
  type MedicineSearchFilters,
} from "@/lib/medicine-actions";

export function DoctorFindMedicineClient() {
  const [results, setResults] = useState<MedicineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

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

  return (
    <AppBackground className="min-h-screen font-sans text-foreground animate-page-enter">
      <Navbar />

      <main className="max-w-6xl mx-auto container-padding py-8 pt-16 md:pt-12.5">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
            Medicine Reference
          </h1>
          <p className="text-muted-foreground">
            Search medicines by brand or generic name for prescription reference
          </p>
        </div>

        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 text-sm">
            Use this tool to reference medicines and their available brands. Always verify prescriptions according to medical guidelines.
          </AlertDescription>
        </Alert>

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
        medicine={detailLoading ? null : selectedMedicine}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
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
