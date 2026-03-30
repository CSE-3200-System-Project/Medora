"use client";

import { Ban, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type BulkActionsBarProps = {
  selectedCount: number;
  labels: {
    selected: string;
    activate: string;
    ban: string;
    delete: string;
  };
  onActivate: () => void;
  onBan: () => void;
  onDelete: () => void;
  disabled?: boolean;
};

export function BulkActionsBar({
  selectedCount,
  labels,
  onActivate,
  onBan,
  onDelete,
  disabled = false,
}: BulkActionsBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <section className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 shadow-sm">
      <p className="text-sm font-semibold text-primary">
        {selectedCount} {labels.selected}
      </p>

      <Button type="button" variant="outline" size="sm" onClick={onActivate} disabled={disabled}>
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {labels.activate}
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={onBan} disabled={disabled}>
        <Ban className="mr-2 h-4 w-4" />
        {labels.ban}
      </Button>

      <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={disabled}>
        <Trash2 className="mr-2 h-4 w-4" />
        {labels.delete}
      </Button>
    </section>
  );
}
