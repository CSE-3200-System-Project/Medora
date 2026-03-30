"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { PatientActionsDropdown } from "./PatientActionsDropdown";
import type { PatientRecord } from "./types";

type PatientRowProps = {
  patient: PatientRecord;
  selected: boolean;
  onSelect: (patientId: string, selected: boolean) => void;
  labels: {
    active: string;
    incomplete: string;
    banned: string;
    onboarding: string;
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
  };
  onViewProfile: (patient: PatientRecord) => void;
  onEditPatient: (patient: PatientRecord) => void;
  onToggleActive: (patient: PatientRecord) => void;
  onToggleBan: (patient: PatientRecord) => void;
  onDeletePatient: (patient: PatientRecord) => void;
  onViewReports: (patient: PatientRecord) => void;
};

export function PatientRow({
  patient,
  selected,
  onSelect,
  labels,
  onViewProfile,
  onEditPatient,
  onToggleActive,
  onToggleBan,
  onDeletePatient,
  onViewReports,
}: PatientRowProps) {
  const initials = (patient.name || "User")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const isBanned = patient.account_status === "banned";
  const isActive = patient.account_status === "active";

  const statusLabel = isBanned
    ? labels.banned
    : patient.onboarding_completed
    ? labels.active
    : labels.incomplete;

  const statusClass = isBanned
    ? "bg-red-500/15 text-red-600 border-red-500/30"
    : patient.onboarding_completed
    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
    : "bg-amber-500/15 text-amber-600 border-amber-500/30";

  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell>
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelect(patient.id, event.target.checked)}
          aria-label={labels.selectPatient.replace("{name}", patient.name)}
          className="h-4 w-4 rounded border-border"
        />
      </TableCell>

      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-10 w-10 border border-border/70">
            <AvatarImage src={patient.avatar_url} alt={patient.name} />
            <AvatarFallback>{initials || "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{patient.name}</p>
            <p className="truncate text-xs text-muted-foreground">{patient.email}</p>
          </div>
        </div>
      </TableCell>

      <TableCell>
        <div className="text-sm text-foreground">
          <p>{patient.phone || "-"}</p>
          <p className="text-xs text-muted-foreground">{patient.city || "-"}</p>
        </div>
      </TableCell>

      <TableCell>
        <Badge className={statusClass}>{statusLabel}</Badge>
      </TableCell>

      <TableCell>
        <div className="w-28">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{labels.onboarding}</span>
            <span className="font-semibold text-foreground">{patient.onboarding_progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, Math.max(0, patient.onboarding_progress))}%` }}
            />
          </div>
        </div>
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : "-"}
      </TableCell>

      <TableCell className="text-right">
        <PatientActionsDropdown
          isBanned={isBanned}
          isActive={isActive}
          labels={{
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
          onViewProfile={() => onViewProfile(patient)}
          onEditPatient={() => onEditPatient(patient)}
          onToggleActive={() => onToggleActive(patient)}
          onToggleBan={() => onToggleBan(patient)}
          onDeletePatient={() => onDeletePatient(patient)}
          onViewReports={() => onViewReports(patient)}
        />
      </TableCell>
    </TableRow>
  );
}
