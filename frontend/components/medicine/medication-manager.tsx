import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, AlertCircle, Pill, Calendar, User, Bell, RefreshCw } from "lucide-react";
import { AddMedicationDialog, type Medication } from "./add-medication-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReminderDialog } from "@/components/ui/reminder-dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  computeExpiryDate,
  formatDoseScheduleSummary,
  humanizeMealInstruction,
  isMedicationExpired,
} from "@/lib/patient-medication";

interface MedicationManagerProps {
  medications: Medication[];
  onUpdate: (medications: Medication[]) => void;
  showStatus?: boolean;
  title?: string;
  description?: string;
}

type MedicationFilter = "active" | "expired" | "all";

export function MedicationManager({
  medications,
  onUpdate,
  showStatus = true,
  title = "Medications",
  description = "Add and manage your medications",
}: MedicationManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMedication, setEditingMedication] = useState<Medication | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [medicationToDelete, setMedicationToDelete] = useState<Medication | null>(null);
  const [filter, setFilter] = useState<MedicationFilter>("active");
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewMedication, setRenewMedication] = useState<Medication | null>(null);
  const [renewDurationDays, setRenewDurationDays] = useState("7");

  const enriched = useMemo(
    () =>
      medications
        .map((medication) => {
          const expired = isMedicationExpired(medication);
          const expiryDate = computeExpiryDate(medication.started_date, medication.duration);
          return { medication, expired, expiryDate };
        })
        .sort((a, b) => {
          const aDate = new Date(a.medication.started_date || a.medication.stopped_date || 0).getTime();
          const bDate = new Date(b.medication.started_date || b.medication.stopped_date || 0).getTime();
          return bDate - aDate;
        }),
    [medications],
  );

  const activeCount = enriched.filter((entry) => !entry.expired).length;
  const visible = enriched.filter((entry) => {
    if (filter === "active") return !entry.expired;
    if (filter === "expired") return entry.expired;
    return true;
  });

  const handleAdd = (medication: Medication) => {
    if (editingMedication) {
      const index = medications.findIndex((m) => m.id === editingMedication.id);
      if (index !== -1) {
        const updated = [...medications];
        updated[index] = medication;
        onUpdate(updated);
      }
    } else {
      onUpdate([...medications, medication]);
    }
    setEditingMedication(null);
  };

  const handleRenew = (medication: Medication) => {
    setRenewMedication(medication);
    setRenewDurationDays("7");
    setRenewDialogOpen(true);
  };

  const handleConfirmRenew = () => {
    if (!renewMedication) return;
    const days = Number(renewDurationDays);
    if (!Number.isFinite(days) || days <= 0) return;
    const renewed: Medication = {
      ...renewMedication,
      id: crypto.randomUUID(),
      duration: `${Math.round(days)} days`,
      started_date: new Date().toISOString().slice(0, 10),
      stopped_date: "",
      status: "current",
    };
    onUpdate([renewed, ...medications]);
    setRenewDialogOpen(false);
    setRenewMedication(null);
    setRenewDurationDays("7");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as MedicationFilter)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="all">All</option>
          </select>
          <Button onClick={() => setDialogOpen(true)} size="sm" className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {showStatus && (
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success" />
          <h4 className="text-sm font-medium text-muted-foreground">Currently Taking ({activeCount})</h4>
        </div>
      )}

      {visible.length > 0 ? (
        <div className="space-y-2">
          {visible.map(({ medication, expired }) => (
            <MedicationCard
              key={medication.id}
              medication={medication}
              expired={expired}
              onEdit={() => {
                setEditingMedication(medication);
                setDialogOpen(true);
              }}
              onRemove={() => {
                setMedicationToDelete(medication);
                setDeleteDialogOpen(true);
              }}
              onRenew={() => handleRenew(medication)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-border/50">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No medications found for this filter</p>
          </div>
        </Card>
      )}

      <AddMedicationDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingMedication(null);
        }}
        onAdd={handleAdd}
        editingMedication={editingMedication}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Medication</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{medicationToDelete?.display_name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (medicationToDelete) onUpdate(medications.filter((m) => m.id !== medicationToDelete.id));
                setDeleteDialogOpen(false);
                setMedicationToDelete(null);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renewDialogOpen}
        onOpenChange={(open) => {
          setRenewDialogOpen(open);
          if (!open) {
            setRenewMedication(null);
            setRenewDurationDays("7");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew Medication</DialogTitle>
            <DialogDescription>Enter new duration</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              placeholder="e.g. 7 days"
              inputMode="numeric"
              pattern="[0-9]*"
              value={renewDurationDays}
              onChange={(event) => setRenewDurationDays(event.target.value.replace(/[^\d]/g, ""))}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRenew} disabled={!renewDurationDays || Number(renewDurationDays) <= 0}>
              Renew
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MedicationCard({
  medication,
  expired,
  onEdit,
  onRemove,
  onRenew,
}: {
  medication: Medication;
  expired: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onRenew: () => void;
}) {
  const [reminderOpen, setReminderOpen] = useState(false);
  const scheduleSummary = formatDoseScheduleSummary(medication);
  const frequencyLabel = scheduleSummary !== "As directed" ? scheduleSummary : (medication.frequency || "As directed");
  const mealInstructionLabel = medication.meal_instruction ? humanizeMealInstruction(medication.meal_instruction) : null;
  const expiryIso = computeExpiryDate(medication.started_date, medication.duration);
  const expiryText = expiryIso ? new Date(expiryIso).toLocaleDateString() : null;

  return (
    <>
      <Card className="border-border/50 hover:border-primary/30 transition-colors">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn("rounded-lg p-2 shrink-0", expired ? "bg-muted" : "bg-success/10")}>
                <Pill className={cn("w-5 h-5", expired ? "text-muted-foreground" : "text-success")} />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="font-semibold text-foreground truncate">{medication.display_name}</p>
                  <p className="text-sm text-muted-foreground">{medication.generic_name}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs">{medication.strength}</Badge>
                  <Badge variant="secondary" className="text-xs">{medication.dosage_form}</Badge>
                  <Badge className={cn("text-xs", expired ? "bg-muted text-muted-foreground" : "bg-success/10 text-success border-success/20")}>
                    {expired ? "Expired" : "Current"}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Pill className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {medication.dosage} · {frequencyLabel}
                      {medication.duration && ` · ${medication.duration}`}
                      {mealInstructionLabel && ` · ${mealInstructionLabel}`}
                    </span>
                  </div>
                  {expiryText && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>{expired ? `Expired on: ${expiryText}` : `Expires on: ${expiryText}`}</span>
                    </div>
                  )}
                  {medication.prescribing_doctor && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Dr. {medication.prescribing_doctor}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1 shrink-0">
              {!expired ? (
                <Button variant="ghost" size="sm" onClick={() => setReminderOpen(true)} className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10">
                  <Bell className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={onRenew} className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onRemove} className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <ReminderDialog
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        itemName={medication.display_name}
        itemId={medication.drug_id}
        type="medication"
      />
    </>
  );
}

export type { Medication, MedicationManagerProps };
