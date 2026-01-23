import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Shield, Calendar, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface Vaccination {
  name: string;
  date: string;
  next_due?: string;
  provider?: string;
  notes?: string;
}

interface VaccinationManagerProps {
  vaccinations: Vaccination[];
  onUpdate: (vaccinations: Vaccination[]) => void;
  title?: string;
  description?: string;
}

/**
 * Vaccination Manager Component
 * Allows adding and managing vaccination records
 */
export function VaccinationManager({
  vaccinations,
  onUpdate,
  title = "Vaccination Records",
  description = "Keep track of your immunizations",
}: VaccinationManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vaccinationToDelete, setVaccinationToDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Vaccination>({
    name: "",
    date: "",
    next_due: "",
    provider: "",
    notes: "",
  });

  const handleAdd = () => {
    if (editingIndex !== null) {
      // Update existing
      const updated = [...vaccinations];
      updated[editingIndex] = { ...formData };
      onUpdate(updated);
    } else {
      // Add new
      onUpdate([...vaccinations, { ...formData }]);
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...vaccinations[index] });
    setDialogOpen(true);
  };

  const handleRemove = (index: number) => {
    setVaccinationToDelete(index);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (vaccinationToDelete !== null) {
      const updated = vaccinations.filter((_, i) => i !== vaccinationToDelete);
      onUpdate(updated);
    }
    setDeleteDialogOpen(false);
    setVaccinationToDelete(null);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      date: "",
      next_due: "",
      provider: "",
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

  const isFormValid = formData.name.trim() && formData.date.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Add Vaccination
        </Button>
      </div>

      {/* Vaccination List */}
      {vaccinations.length > 0 ? (
        <div className="space-y-3">
          {vaccinations.map((vac, index) => (
            <Card key={index} className="bg-surface/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-blue-600" />
                      <h4 className="font-semibold text-foreground">{vac.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {new Date(vac.date).toLocaleDateString()}
                      </Badge>
                    </div>
                    {vac.next_due && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Clock className="h-3 w-3" />
                        <span>Next due: {new Date(vac.next_due).toLocaleDateString()}</span>
                      </div>
                    )}
                    {vac.provider && (
                      <div className="text-sm text-muted-foreground mb-2">
                        <strong>Provider:</strong> {vac.provider}
                      </div>
                    )}
                    {vac.notes && (
                      <p className="text-sm text-muted-foreground">{vac.notes}</p>
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
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No vaccination records</p>
          <p className="text-sm mt-2">Add your first vaccination to get started</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Vaccination" : "Add Vaccination"}
            </DialogTitle>
            <DialogDescription>
              {editingIndex !== null
                ? "Update the vaccination details below"
                : "Add details about your vaccination"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="vac-name">Vaccine Name *</Label>
              <Input
                id="vac-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., COVID-19, Hepatitis B"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="vac-date">Date Received *</Label>
              <Input
                id="vac-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="vac-next-due">Next Due Date</Label>
              <Input
                id="vac-next-due"
                type="date"
                value={formData.next_due || ""}
                onChange={(e) => setFormData({ ...formData, next_due: e.target.value })}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="vac-provider">Provider/Clinic</Label>
              <Input
                id="vac-provider"
                value={formData.provider || ""}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                placeholder="e.g., Dhaka Medical College Hospital"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="vac-notes">Additional Notes</Label>
              <Textarea
                id="vac-notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details about the vaccination..."
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
              {editingIndex !== null ? "Update" : "Add"} Vaccination
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vaccination</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this vaccination record? This action cannot be undone.
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