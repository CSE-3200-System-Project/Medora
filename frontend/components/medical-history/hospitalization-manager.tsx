import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Hospital, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useT } from "@/i18n/client";

export interface Hospitalization {
  reason: string;
  year: string;
  duration?: string;
  hospital?: string;
  notes?: string;
}

interface HospitalizationManagerProps {
  hospitalizations: Hospitalization[];
  onUpdate: (hospitalizations: Hospitalization[]) => void;
  title?: string;
  description?: string;
}

/**
 * Hospitalization Manager Component
 * Allows adding and managing hospitalization history
 */
export function HospitalizationManager({
  hospitalizations,
  onUpdate,
  title,
  description,
}: HospitalizationManagerProps) {
  const tCommon = useT("common");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hospitalizationToDelete, setHospitalizationToDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Hospitalization>({
    reason: "",
    year: "",
    duration: "",
    hospital: "",
    notes: "",
  });

  const handleAdd = () => {
    if (editingIndex !== null) {
      // Update existing
      const updated = [...hospitalizations];
      updated[editingIndex] = { ...formData };
      onUpdate(updated);
    } else {
      // Add new
      onUpdate([...hospitalizations, { ...formData }]);
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...hospitalizations[index] });
    setDialogOpen(true);
  };

  const handleRemove = (index: number) => {
    setHospitalizationToDelete(index);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (hospitalizationToDelete !== null) {
      const updated = hospitalizations.filter((_, i) => i !== hospitalizationToDelete);
      onUpdate(updated);
    }
    setDeleteDialogOpen(false);
    setHospitalizationToDelete(null);
  };

  const resetForm = () => {
    setFormData({
      reason: "",
      year: "",
      duration: "",
      hospital: "",
      notes: "",
    });
    setEditingIndex(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      resetForm();
    }
  };

  const isFormValid = formData.reason.trim() && formData.year.trim();

  const resolvedTitle = title || tCommon("medicalHistory.hospitalization.title");
  const resolvedDescription = description || tCommon("medicalHistory.hospitalization.subtitle");

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{resolvedTitle}</h3>
          <p className="text-sm text-muted-foreground">{resolvedDescription}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="h-11 w-full shrink-0 sm:h-10 sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          {tCommon("medicalHistory.hospitalization.actions.add")}
        </Button>
      </div>

      {/* Hospitalization List */}
      {hospitalizations.length > 0 ? (
        <div className="space-y-3">
          {hospitalizations.map((hosp, index) => (
            <Card key={index} className="bg-surface/30">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Hospital className="h-4 w-4 text-amber-600" />
                      <h4 className="font-semibold text-foreground break-words">{hosp.reason}</h4>
                      <Badge variant="outline" className="text-xs">
                        {hosp.year}
                      </Badge>
                    </div>
                    {hosp.duration && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        <span>{hosp.duration}</span>
                      </div>
                    )}
                    {hosp.hospital && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>{tCommon("medicalHistory.hospitalization.fields.hospitalLabel")}</strong> {hosp.hospital}
                      </div>
                    )}
                    {hosp.notes && (
                      <p className="text-sm text-muted-foreground">{hosp.notes}</p>
                    )}
                  </div>
                  <div className="ml-0 flex items-center gap-2 self-start sm:ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(index)}
                      className="h-11 w-11 p-0 sm:h-8 sm:w-8"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      className="h-11 w-11 p-0 text-destructive hover:text-destructive sm:h-8 sm:w-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Hospital className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>{tCommon("medicalHistory.hospitalization.empty.title")}</p>
          <p className="text-sm mt-2">{tCommon("medicalHistory.hospitalization.empty.subtitle")}</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null
                ? tCommon("medicalHistory.hospitalization.dialog.editTitle")
                : tCommon("medicalHistory.hospitalization.dialog.addTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingIndex !== null
                ? tCommon("medicalHistory.hospitalization.dialog.editDescription")
                : tCommon("medicalHistory.hospitalization.dialog.addDescription")
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="hosp-reason">{tCommon("medicalHistory.hospitalization.fields.reason")} *</Label>
              <Input
                id="hosp-reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder={tCommon("medicalHistory.hospitalization.placeholders.reason")}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-year">{tCommon("medicalHistory.hospitalization.fields.year")} *</Label>
              <Input
                id="hosp-year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder={tCommon("medicalHistory.hospitalization.placeholders.year")}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-duration">{tCommon("medicalHistory.hospitalization.fields.duration")}</Label>
              <Input
                id="hosp-duration"
                value={formData.duration || ""}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder={tCommon("medicalHistory.hospitalization.placeholders.duration")}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-hospital">{tCommon("medicalHistory.hospitalization.fields.hospital")}</Label>
              <Input
                id="hosp-hospital"
                value={formData.hospital || ""}
                onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                placeholder={tCommon("medicalHistory.hospitalization.placeholders.hospital")}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-notes">{tCommon("medicalHistory.hospitalization.fields.notes")}</Label>
              <Textarea
                id="hosp-notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder={tCommon("medicalHistory.hospitalization.placeholders.notes")}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAdd} disabled={!isFormValid}>
              {editingIndex !== null
                ? tCommon("medicalHistory.hospitalization.actions.update")
                : tCommon("medicalHistory.hospitalization.actions.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommon("medicalHistory.hospitalization.delete.title")}</DialogTitle>
            <DialogDescription>
              {tCommon("medicalHistory.hospitalization.delete.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {tCommon("medicalHistory.hospitalization.actions.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
