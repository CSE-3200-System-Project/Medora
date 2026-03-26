"use client";

import { cn } from "@/lib/utils";
import type { SlotGroup } from "@/components/doctor/doctor-profile/types";

interface AppointmentSlotSelectorProps {
  slotGroups: SlotGroup[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
}

export function AppointmentSlotSelector({
  slotGroups,
  selectedSlot,
  onSelectSlot,
}: AppointmentSlotSelectorProps) {
  if (!slotGroups.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        No slots are available for this date.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {slotGroups.map((group) => {
        const availableCount = group.slots.filter((slot) => slot.available).length;

        return (
          <div key={group.period} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.period} ({availableCount} slots)
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {group.slots.map((slot) => {
                const isSelected = selectedSlot === slot.time;
                return (
                  <button
                    type="button"
                    key={`${group.period}-${slot.time}`}
                    onClick={() => slot.available && onSelectSlot(slot.time)}
                    disabled={!slot.available}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-center text-xs font-semibold transition-colors",
                      slot.available ? "cursor-pointer" : "cursor-not-allowed opacity-45",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/40"
                    )}
                  >
                    {slot.time}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
