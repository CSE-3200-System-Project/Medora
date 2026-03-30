"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableScrollContainer } from "@/components/ui/table";
import { PatientRow } from "./PatientRow";
import type { PatientRecord } from "./types";

type PatientTableProps = {
  patients: PatientRecord[];
  selectedIds: string[];
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (patientId: string, selected: boolean) => void;
  columns: {
    patient: string;
    contact: string;
    status: string;
    onboarding: string;
    joinedDate: string;
    actions: string;
  };
  labels: {
    active: string;
    incomplete: string;
    banned: string;
    onboarding: string;
    selectAllPatients: string;
    selectPatient: string;
    viewProfile: string;
    editPatient: string;
    toggleActive: string;
    activate: string;
    deactivate: string;
    toggleBan: string;
    ban: string;
    unban: string;
    deletePatient: string;
    viewReports: string;
    empty: string;
    previous: string;
    next: string;
    page: string;
  };
  page: number;
  totalPages: number;
  onPageChange: (nextPage: number) => void;
  onViewProfile: (patient: PatientRecord) => void;
  onEditPatient: (patient: PatientRecord) => void;
  onToggleActive: (patient: PatientRecord) => void;
  onToggleBan: (patient: PatientRecord) => void;
  onDeletePatient: (patient: PatientRecord) => void;
  onViewReports: (patient: PatientRecord) => void;
};

export function PatientTable({
  patients,
  selectedIds,
  onToggleAll,
  onToggleOne,
  columns,
  labels,
  page,
  totalPages,
  onPageChange,
  onViewProfile,
  onEditPatient,
  onToggleActive,
  onToggleBan,
  onDeletePatient,
  onViewReports,
}: PatientTableProps) {
  const allSelected = patients.length > 0 && patients.every((patient) => selectedIds.includes(patient.id));

  return (
    <section className="rounded-2xl border border-border/60 bg-card shadow-sm">
      <TableScrollContainer className="border-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleAll(event.target.checked)}
                  aria-label={labels.selectAllPatients}
                  className="h-4 w-4 rounded border-border"
                />
              </TableHead>
              <TableHead>{columns.patient}</TableHead>
              <TableHead>{columns.contact}</TableHead>
              <TableHead>{columns.status}</TableHead>
              <TableHead>{columns.onboarding}</TableHead>
              <TableHead>{columns.joinedDate}</TableHead>
              <TableHead className="text-right">{columns.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  {labels.empty}
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <PatientRow
                  key={patient.id}
                  patient={patient}
                  selected={selectedIds.includes(patient.id)}
                  onSelect={onToggleOne}
                  labels={{
                    active: labels.active,
                    incomplete: labels.incomplete,
                    banned: labels.banned,
                    onboarding: labels.onboarding,
                    selectPatient: labels.selectPatient,
                    viewProfile: labels.viewProfile,
                    editPatient: labels.editPatient,
                    toggleActive: labels.toggleActive,
                    activate: labels.activate,
                    deactivate: labels.deactivate,
                    toggleBan: labels.toggleBan,
                    ban: labels.ban,
                    unban: labels.unban,
                    deletePatient: labels.deletePatient,
                    viewReports: labels.viewReports,
                  }}
                  onViewProfile={onViewProfile}
                  onEditPatient={onEditPatient}
                  onToggleActive={onToggleActive}
                  onToggleBan={onToggleBan}
                  onDeletePatient={onDeletePatient}
                  onViewReports={onViewReports}
                />
              ))
            )}
          </TableBody>
        </Table>
      </TableScrollContainer>

      <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          {labels.previous}
        </Button>

        <p className="text-sm text-muted-foreground">
          {labels.page} {page} / {Math.max(1, totalPages)}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {labels.next}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
