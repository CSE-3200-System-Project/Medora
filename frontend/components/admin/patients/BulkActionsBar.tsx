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
  if (selectedCount === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {labels.selected}: <span className="font-semibold text-foreground">{selectedCount}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onActivate} disabled={disabled}>
          {labels.activate}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onBan} disabled={disabled}>
          {labels.ban}
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete} disabled={disabled}>
          {labels.delete}
        </Button>
      </div>
    </section>
  );
}
