import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, AlertCircle, Pill, Calendar, User, Bell } from "lucide-react";
import { AddMedicationDialog, type Medication } from "./add-medication-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReminderDialog } from "@/components/ui/reminder-dialog";
import { cn } from "@/lib/utils";

interface MedicationManagerProps {
  medications: Medication[];
  onUpdate: (medications: Medication[]) => void;
  showStatus?: boolean;
  title?: string;
  description?: string;
}

/**
 * Medication Manager Component
 * Allows adding medicines from the database with dosage details using a beautiful dialog.
 */
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

  const handleAdd = (medication: Medication) => {
    if (editingMedication) {
      // Update existing
      const index = medications.findIndex(
        (m) => m.drug_id === editingMedication.drug_id && m.started_date === editingMedication.started_date
      );
      if (index !== -1) {
        const updated = [...medications];
        updated[index] = medication;
        onUpdate(updated);
      }
    } else {
      // Add new
      onUpdate([...medications, medication]);
    }
    setEditingMedication(null);
  };

  const handleEdit = (medication: Medication) => {
    setEditingMedication(medication);
    setDialogOpen(true);
  };

  const handleRemove = (medication: Medication) => {
    setMedicationToDelete(medication);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (medicationToDelete) {
      onUpdate(
        medications.filter(
          (m) => m.id !== medicationToDelete.id
        )
      );
    }
    setDeleteDialogOpen(false);
    setMedicationToDelete(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingMedication(null);
    }
  };

  const currentMeds = medications.filter((m) => m.status === "current");
  const pastMeds = medications.filter((m) => m.status === "past");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      {/* Current Medications */}
      {showStatus && currentMeds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <h4 className="text-sm font-medium text-muted-foreground">
              Currently Taking ({currentMeds.length})
            </h4>
          </div>
          <div className="space-y-2">
            {currentMeds.map((med, index) => (
              <MedicationCard
                key={index}
                medication={med}
                onEdit={() => handleEdit(med)}
                onRemove={() => handleRemove(med)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Past Medications */}
      {showStatus && pastMeds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            <h4 className="text-sm font-medium text-muted-foreground">
              Past Medications ({pastMeds.length})
            </h4>
          </div>
          <div className="space-y-2">
            {pastMeds.map((med, index) => (
              <MedicationCard
                key={index}
                medication={med}
                onEdit={() => handleEdit(med)}
                onRemove={() => handleRemove(med)}
              />
            ))}
          </div>
        </div>
      )}

      {/* All medications without status grouping */}
      {!showStatus && medications.length > 0 && (
        <div className="space-y-2">
          {medications.map((med, index) => (
            <MedicationCard
              key={index}
              medication={med}
              onEdit={() => handleEdit(med)}
              onRemove={() => handleRemove(med)}
            />
          ))}
        </div>
      )}

      {medications.length === 0 && (
        <Card className="border-dashed border-2 border-border/50">
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No medications added yet</p>
            <Button onClick={() => setDialogOpen(true)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add your first medication
            </Button>
          </div>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <AddMedicationDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        onAdd={handleAdd}
        editingMedication={editingMedication}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Medication</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{medicationToDelete?.display_name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Medication Card Component
 * Displays a single medication with edit/remove actions and reminder option.
 */
function MedicationCard({
  medication,
  onEdit,
  onRemove,
}: {
  medication: Medication;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [reminderOpen, setReminderOpen] = useState(false);

  return (
    <>
      <Card className="border-border/50 hover:border-primary/30 transition-colors">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={cn(
                "rounded-lg p-2 shrink-0",
                medication.status === "current" ? "bg-success/10" : "bg-muted"
              )}>
                <Pill className={cn(
                  "w-5 h-5",
                  medication.status === "current" ? "text-success" : "text-muted-foreground"
                )} />
              </div>
              
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <p className="font-semibold text-foreground truncate">
                    {medication.display_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {medication.generic_name}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {medication.strength}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {medication.dosage_form}
                  </Badge>
                  {medication.status === "current" && (
                    <Badge className="text-xs bg-success/10 text-success border-success/20">
                      Current
                    </Badge>
                  )}
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Pill className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {medication.dosage} · {medication.frequency}
                    {medication.duration && ` · ${medication.duration}`}
                  </span>
                </div>
                
                {medication.started_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      Started: {new Date(medication.started_date).toLocaleDateString()}
                      {medication.stopped_date && ` · Stopped: ${new Date(medication.stopped_date).toLocaleDateString()}`}
                    </span>
                  </div>
                )}
                
                {medication.prescribing_doctor && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Dr. {medication.prescribing_doctor}</span>
                  </div>
                )}
              </div>

              {medication.notes && (
                <p className="text-sm text-muted-foreground italic line-clamp-2">
                  &quot;{medication.notes}&quot;
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReminderOpen(true)}
              className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
              title="Set reminder"
            >
              <Bell className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              className="h-8 w-8 p-0"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Card>

    {/* Reminder Dialog */}
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
