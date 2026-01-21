"use client";

import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Building2,
  Pill,
  Package,
  Info,
  X,
  Plus,
} from "lucide-react";
import { getDosageFormIcon, getMedicineTypeStyle } from "./medicine-card";

// Types
interface BrandInfo {
  id: string;
  brand_name: string;
  manufacturer?: string;
  medicine_type?: string;
}

interface MedicineDetail {
  drug_id: string;
  generic_name: string;
  strength: string;
  dosage_form: string;
  common_uses?: string;
  common_uses_disclaimer?: string;
  brands: BrandInfo[];
}

interface MedicineDetailDrawerProps {
  medicine: MedicineDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToMedications?: (medicine: MedicineDetail) => void;
}

/**
 * Medicine Detail Drawer Component
 * Shows comprehensive medicine information with disclaimer.
 */
export function MedicineDetailDrawer({
  medicine,
  open,
  onOpenChange,
  onAddToMedications,
}: MedicineDetailDrawerProps) {
  if (!medicine) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1">
          {/* Dosage Form Icon */}
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {getDosageFormIcon(medicine.dosage_form)}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-lg leading-tight">
                {medicine.generic_name}
              </SheetTitle>
              <SheetDescription className="text-sm mt-1">
                {medicine.strength} • {medicine.dosage_form}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 py-4 space-y-6">
          {/* Identity Section */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              Medicine Identity
            </h3>
            <div className="bg-surface rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Generic Name</span>
                <span className="text-sm font-medium text-foreground text-right max-w-[60%]">
                  {medicine.generic_name}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Strength</span>
                <span className="text-sm font-medium text-foreground">
                  {medicine.strength}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Dosage Form</span>
                <span className="text-sm font-medium text-foreground">
                  {medicine.dosage_form}
                </span>
              </div>
            </div>
          </section>

          {/* Common Uses Section */}
          {medicine.common_uses && (
            <section className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Common Uses
              </h3>
              <div className="bg-surface rounded-xl p-4">
                <p className="text-sm text-foreground leading-relaxed">
                  {medicine.common_uses}
                </p>
              </div>
            </section>
          )}

          {/* Disclaimer */}
          <Alert className="bg-amber-50 border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-xs">
              {medicine.common_uses_disclaimer || 
                "This information is for general awareness only and does not replace professional medical advice. Always consult your doctor before taking any medication."}
            </AlertDescription>
          </Alert>

          {/* Available Brands Section */}
          {medicine.brands && medicine.brands.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Available Brands ({medicine.brands.length})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {medicine.brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="bg-surface rounded-xl p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm text-foreground">
                        {brand.brand_name}
                      </span>
                      {brand.medicine_type && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs shrink-0 ${getMedicineTypeStyle(brand.medicine_type)}`}
                        >
                          {brand.medicine_type}
                        </Badge>
                      )}
                    </div>
                    {brand.manufacturer && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {brand.manufacturer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <SheetFooter className="border-t border-border pt-4 flex-row gap-2">
          {onAddToMedications && (
            <Button
              variant="medical"
              className="flex-1"
              onClick={() => {
                onAddToMedications(medicine);
                onOpenChange(false);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to My Medications
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
