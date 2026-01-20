"use client";

import React, { useState, useEffect } from "react";
import { Search, X, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MedicineFilters {
  dosage_form?: string;
  medicine_type?: string;
}

interface MedicineSearchProps {
  onSearch: (query: string, filters: MedicineFilters) => void;
  loading?: boolean;
  resultCount?: number;
}

// Common dosage forms for quick filter
const COMMON_DOSAGE_FORMS = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Drops",
  "Cream",
  "Ointment",
  "Inhaler",
  "Suspension",
];

// Medicine types
const MEDICINE_TYPES = [
  "Allopathic",
  "Ayurvedic",
  "Homeopathic",
  "Unani",
  "Herbal",
];

/**
 * Debounce hook for delayed search
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Medicine Search Input Component
 * Provides search input with debouncing and filters.
 */
export function MedicineSearch({ onSearch, loading, resultCount }: MedicineSearchProps) {
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<MedicineFilters>({});
  
  // Debounce the search query
  const debouncedQuery = useDebounce(query, 300);
  
  // Active filter count
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  // Trigger search when debounced query or filters change
  useEffect(() => {
    if (debouncedQuery.length >= 2 || debouncedQuery.length === 0) {
      onSearch(debouncedQuery, filters);
    }
  }, [debouncedQuery, filters, onSearch]);

  const handleClearFilters = () => {
    setFilters({});
  };

  const handleFilterChange = (key: keyof MedicineFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === "all" ? undefined : value,
    }));
  };

  const removeFilter = (key: keyof MedicineFilters) => {
    setFilters(prev => {
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search medicine by name or brand..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-12 pr-24 h-12 text-base rounded-xl border-border bg-background focus:border-primary"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          {query && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setQuery("")}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant={showFilters ? "secondary" : "ghost"}
            size="icon-sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 w-8 relative"
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-white flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="p-4 bg-surface rounded-xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filters</h4>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear all
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dosage Form Filter */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Dosage Form</label>
              <Select
                value={filters.dosage_form || "all"}
                onValueChange={(value) => handleFilterChange("dosage_form", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All forms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All forms</SelectItem>
                  {COMMON_DOSAGE_FORMS.map((form) => (
                    <SelectItem key={form} value={form}>
                      {form}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Medicine Type Filter */}
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Medicine Type</label>
              <Select
                value={filters.medicine_type || "all"}
                onValueChange={(value) => handleFilterChange("medicine_type", value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {MEDICINE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && !showFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.dosage_form && (
            <Badge variant="secondary" className="gap-1">
              {filters.dosage_form}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => removeFilter("dosage_form")}
              />
            </Badge>
          )}
          {filters.medicine_type && (
            <Badge variant="secondary" className="gap-1">
              {filters.medicine_type}
              <X 
                className="h-3 w-3 cursor-pointer hover:text-destructive" 
                onClick={() => removeFilter("medicine_type")}
              />
            </Badge>
          )}
        </div>
      )}

      {/* Result Count */}
      {query.length >= 2 && resultCount !== undefined && (
        <p className="text-sm text-muted-foreground">
          {resultCount === 0 
            ? "No medicines found" 
            : `Found ${resultCount} medicine${resultCount !== 1 ? 's' : ''}`
          }
        </p>
      )}
    </div>
  );
}
