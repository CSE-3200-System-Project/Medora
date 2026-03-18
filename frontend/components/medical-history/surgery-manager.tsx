import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Syringe, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface Surgery {
  name: string;
  year: string;
  hospital?: string;
  notes?: string;
}

interface SurgeryManagerProps {
  surgeries: Surgery[];
  onUpdate: (surgeries: Surgery[]) => void;
  title?: string;
  description?: string;
}

/**
 * Surgery Manager Component
 * Allows adding and managing surgical history
 */
export function SurgeryManager({
  surgeries,
  onUpdate,
  title = "Surgical History",
  description = "Track your past surgeries and procedures",
}: SurgeryManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [surgeryToDelete, setSurgeryToDelete] = useState<number | null>(null);

  const [formData, setFormData] = useState<Surgery>({
    name: "",
    year: "",
    hospital: "",
    notes: "",
  });

  const handleAdd = () => {
    if (editingIndex !== null) {
      // Update existing
      const updated = [...surgeries];
      updated[editingIndex] = { ...formData };
      onUpdate(updated);
    } else {
      // Add new
      onUpdate([...surgeries, { ...formData }]);
    }
    resetForm();
    setDialogOpen(false);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormData({ ...surgeries[index] });
    setDialogOpen(true);
  };

  const handleRemove = (index: number) => {
    setSurgeryToDelete(index);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (surgeryToDelete !== null) {
      const updated = surgeries.filter((_, i) => i !== surgeryToDelete);
      onUpdate(updated);
    }
    setDeleteDialogOpen(false);
    setSurgeryToDelete(null);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      year: "",
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

  const isFormValid = formData.name.trim() && formData.year.trim();

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="h-11 w-full shrink-0 sm:h-10 sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Surgery
        </Button>
      </div>

      {/* Surgery List */}
      {surgeries.length > 0 ? (
        <div className="space-y-3">
          {surgeries.map((surgery, index) => (
            <Card key={index} className="bg-surface/30">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Syringe className="h-4 w-4 text-primary" />
                      <h4 className="font-semibold text-foreground break-words">{surgery.name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {surgery.year}
                      </Badge>
                    </div>
                    {surgery.hospital && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <MapPin className="h-3 w-3" />
                        <span>{surgery.hospital}</span>
                      </div>
                    )}
                    {surgery.notes && (
                      <p className="text-sm text-muted-foreground">{surgery.notes}</p>
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
          <Syringe className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No surgical history recorded</p>
          <p className="text-sm mt-2">Add your first surgery to get started</p>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingIndex !== null ? "Edit Surgery" : "Add Surgery"}
            </DialogTitle>
            <DialogDescription>
              {editingIndex !== null
                ? "Update the surgery details below"
                : "Add details about your surgical procedure"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="surgery-name">Procedure Name *</Label>
              <Input
                id="surgery-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Appendectomy, Knee Replacement"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="surgery-year">Year *</Label>
              <Input
                id="surgery-year"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                placeholder="e.g., 2023"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="surgery-hospital">Hospital/Clinic</Label>
              <Input
                id="surgery-hospital"
                value={formData.hospital || ""}
                onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                placeholder="e.g., Dhaka Medical College Hospital"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="surgery-notes">Additional Notes</Label>
              <Textarea
                id="surgery-notes"
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any additional details about the surgery..."
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
              {editingIndex !== null ? "Update" : "Add"} Surgery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Surgery</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this surgery record? This action cannot be undone.
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