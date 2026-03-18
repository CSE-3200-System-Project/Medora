"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Pill,
  Syringe,
  Droplet,
  Layers,
  Wind,
  FlaskConical,
  Package,
  PillBottle,
  CircleDot,
  Sparkles,
} from "lucide-react";

// Types
export interface MedicineResult {
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

interface MedicineCardProps {
  medicine: MedicineResult;
  onClick?: () => void;
}

/**
 * Get the appropriate icon for a dosage form.
 * Maps dosage forms to Lucide icons for visual identification.
 */
function getDosageFormIcon(dosageForm: string): React.ReactNode {
  const form = dosageForm.toLowerCase();
  
  // Tablet variants
  if (form.includes("tablet")) {
    return <Pill className="h-5 w-5" />;
  }
  
  // Capsule variants
  if (form.includes("capsule")) {
    return <PillBottle className="h-5 w-5" />;
  }
  
  // Syrup, solution, liquid, elixir
  if (
    form.includes("syrup") ||
    form.includes("solution") ||
    form.includes("liquid") ||
    form.includes("elixir") ||
    form.includes("suspension")
  ) {
    return <FlaskConical className="h-5 w-5" />;
  }
  
  // Injection variants
  if (form.includes("injection") || form.includes("infusion")) {
    return <Syringe className="h-5 w-5" />;
  }
  
  // Drops variants
  if (form.includes("drop")) {
    return <Droplet className="h-5 w-5" />;
  }
  
  // Cream, gel, ointment, lotion
  if (
    form.includes("cream") ||
    form.includes("gel") ||
    form.includes("ointment") ||
    form.includes("lotion") ||
    form.includes("emulsion")
  ) {
    return <Layers className="h-5 w-5" />;
  }
  
  // Inhaler, spray, aerosol
  if (
    form.includes("inhaler") ||
    form.includes("spray") ||
    form.includes("aerosol") ||
    form.includes("nebuli")
  ) {
    return <Wind className="h-5 w-5" />;
  }
  
  // Powder, granules, sachet
  if (
    form.includes("powder") ||
    form.includes("granule") ||
    form.includes("sachet")
  ) {
    return <Package className="h-5 w-5" />;
  }
  
  // Suppository
  if (form.includes("suppository") || form.includes("pessary")) {
    return <CircleDot className="h-5 w-5" />;
  }
  
  // Default icon
  return <Pill className="h-5 w-5" />;
}

/**
 * Get badge color based on medicine type.
 */
function getMedicineTypeStyle(type?: string): string {
  if (!type) return "bg-muted/50 text-foreground";
  
  switch (type.toLowerCase()) {
    case "allopathic":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "ayurvedic":
      return "bg-green-50 text-green-700 border-green-200";
    case "homeopathic":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "unani":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "herbal":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-muted/30 text-foreground border-border";
  }
}

/**
 * Medicine Card Component
 * Displays a medicine search result with icon, name, and metadata.
 */
export function MedicineCard({ medicine, onClick }: MedicineCardProps) {
  return (
    <Card 
      className="overflow-hidden hover:shadow-md transition-all duration-200 border-border/50 cursor-pointer hover:border-primary/30 active:scale-[0.99]"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Dosage Form Icon */}
          <div className="shrink-0">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              {getDosageFormIcon(medicine.dosage_form)}
            </div>
          </div>
          
          {/* Medicine Info */}
          <div className="flex-1 min-w-0">
            {/* Display Name (Brand or Generic) */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate">
                  {medicine.display_name}
                </h3>
                
                {/* Show generic name if this is a brand */}
                {medicine.is_brand && (
                  <p className="text-sm text-primary font-medium truncate">
                    {medicine.generic_name}
                  </p>
                )}
              </div>
              
              {/* Brand indicator */}
              {medicine.is_brand && (
                <Badge variant="secondary" className="shrink-0 text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Brand
                </Badge>
              )}
            </div>
            
            {/* Strength & Dosage Form */}
            <p className="text-sm text-muted-foreground mt-1">
              {medicine.strength} • {medicine.dosage_form}
            </p>
            
            {/* Manufacturer & Medicine Type */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {medicine.medicine_type && (
                <Badge 
                  variant="outline" 
                  className={`text-xs ${getMedicineTypeStyle(medicine.medicine_type)}`}
                >
                  {medicine.medicine_type}
                </Badge>
              )}
              
              {medicine.manufacturer && (
                <span className="text-xs text-muted-foreground truncate">
                  {medicine.manufacturer}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { getDosageFormIcon, getMedicineTypeStyle };

