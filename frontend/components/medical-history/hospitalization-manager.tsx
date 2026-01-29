import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Hospital, Calendar, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  title = "Hospitalization History",
  description = "Record of hospital admissions",
}: HospitalizationManagerProps) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Hospitalization
        </Button>
      </div>

      {/* Hospitalization List */}
      {hospitalizations.length > 0 ? (
        <div className="space-y-3">
          {hospitalizations.map((hosp, index) => (
            <Card key={index} className="bg-surface/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Hospital className="h-4 w-4 text-amber-600" />
                      <h4 className="font-semibold text-foreground">{hosp.reason}</h4>
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
                        <strong>Hospital:</strong> {hosp.hospital}
                      </div>
                    )}
                    {hosp.notes && (
                      <p className="text-sm text-muted-foreground">{hosp.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
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
          <p>No hospitalization history recorded</p>
          <p className="text-sm mt-2">Add your first hospitalization to get started</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Hospitalization" : "Add Hospitalization"}
            </DialogTitle>
            <DialogDescription>
              {editingIndex !== null
                ? "Update the hospitalization details below"
                : "Add details about your hospital admission"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="hosp-reason">Reason for Admission *</Label>
              <Input
                id="hosp-reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Pneumonia, Heart Attack"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-year">Year *</Label>
              <Input
                id="hosp-year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="e.g., 2023"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-duration">Duration</Label>
              <Input
                id="hosp-duration"
                value={formData.duration || ""}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="e.g., 5 days, 2 weeks"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-hospital">Hospital</Label>
              <Input
                id="hosp-hospital"
                value={formData.hospital || ""}
                onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                placeholder="e.g., Dhaka Medical College Hospital"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="hosp-notes">Additional Notes</Label>
              <Textarea
                id="hosp-notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details about the hospitalization..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!isFormValid}>
              {editingIndex !== null ? "Update" : "Add"} Hospitalization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Hospitalization</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this hospitalization record? This action cannot be undone.
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