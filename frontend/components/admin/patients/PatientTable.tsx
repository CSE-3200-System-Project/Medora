import { Button } from "@/components/ui/button";
import type { PatientRecord } from "@/components/admin/patients/types";

type PatientTableProps = {
  patients: PatientRecord[];
  selectedIds: string[];
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (patientId: string, checked: boolean) => void;
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

function onboardingText(patient: PatientRecord, labels: PatientTableProps["labels"]): string {
  if (patient.account_status === "banned") {
    return labels.banned;
  }

  return patient.onboarding_completed ? labels.active : labels.incomplete;
}

function formatDate(date?: string): string {
  if (!date) {
    return "-";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return parsed.toLocaleDateString();
}

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
  const allSelected = patients.length > 0 && selectedIds.length === patients.length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="overflow-x-auto touch-pan-x">
          <table className="w-full min-w-[780px] lg:min-w-[960px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="p-3">
                  <input
                    type="checkbox"
                    aria-label={labels.selectAllPatients}
                    checked={allSelected}
                    onChange={(event) => onToggleAll(event.target.checked)}
                  />
                </th>
                <th className="p-3">{columns.patient}</th>
                <th className="p-3">{columns.contact}</th>
                <th className="p-3">{columns.status}</th>
                <th className="p-3">{columns.onboarding}</th>
                <th className="p-3">{columns.joinedDate}</th>
                <th className="p-3">{columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    {labels.empty}
                  </td>
                </tr>
              ) : (
                patients.map((patient) => {
                  const selected = selectedIds.includes(patient.id);
                  const statusText = patient.account_status === "banned" ? labels.banned : labels.active;
                  const activeActionText = patient.account_status === "active" ? labels.deactivate : labels.activate;
                  const banActionText = patient.account_status === "banned" ? labels.unban : labels.ban;
                  return (
                    <tr key={patient.id} className="border-b border-border/40 align-top last:border-0">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          aria-label={`${labels.selectPatient} ${patient.name}`}
                          checked={selected}
                          onChange={(event) => onToggleOne(patient.id, event.target.checked)}
                        />
                      </td>
                      <td className="p-3">
                        <p className="font-medium text-foreground">{patient.name || "-"}</p>
                        <p className="text-xs text-muted-foreground">{patient.id}</p>
                      </td>
                      <td className="p-3">
                        <p>{patient.email || "-"}</p>
                        <p className="text-xs text-muted-foreground">{patient.phone || "-"}</p>
                      </td>
                      <td className="p-3">{statusText}</td>
                      <td className="p-3">{onboardingText(patient, labels)}</td>
                      <td className="p-3">{formatDate(patient.created_at)}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => onViewProfile(patient)}>
                            {labels.viewProfile}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onEditPatient(patient)}>
                            {labels.editPatient}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onToggleActive(patient)}>
                            {activeActionText}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onToggleBan(patient)}>
                            {banActionText}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => onDeletePatient(patient)}>
                            {labels.deletePatient}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onViewReports(patient)}>
                            {labels.viewReports}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          {labels.previous}
        </Button>
        <span className="text-xs text-muted-foreground">
          {labels.page} {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          {labels.next}
        </Button>
      </div>
    </div>
  );
}
