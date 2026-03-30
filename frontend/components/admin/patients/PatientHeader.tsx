"use client";

import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select-native";
import type { PatientStatusFilter } from "./types";

type PatientHeaderProps = {
  title: string;
  subtitle: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterLabel: string;
  statusFilter: PatientStatusFilter;
  onStatusFilterChange: (value: PatientStatusFilter) => void;
  statusLabels: Record<PatientStatusFilter, string>;
  addPatientLabel: string;
  onAddPatient: () => void;
};

export function PatientHeader({
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  filterLabel,
  statusFilter,
  onStatusFilterChange,
  statusLabels,
  addPatientLabel,
  onAddPatient,
}: PatientHeaderProps) {
  return (
    <section className="mb-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_200px_auto] md:items-center">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as PatientStatusFilter)}
          aria-label={filterLabel}
        >
          <option value="all">{statusLabels.all}</option>
          <option value="active">{statusLabels.active}</option>
          <option value="incomplete">{statusLabels.incomplete}</option>
          <option value="banned">{statusLabels.banned}</option>
        </Select>

        <Button type="button" onClick={onAddPatient} className="touch-target">
          <UserPlus className="mr-2 h-4 w-4" />
          {addPatientLabel}
        </Button>
      </div>
    </section>
  );
}
