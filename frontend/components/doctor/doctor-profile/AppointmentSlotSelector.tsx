"use client";

import { cn } from "@/lib/utils";
import type { SlotGroup } from "@/components/doctor/doctor-profile/types";
import { useT } from "@/i18n/client";

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
  const tCommon = useT("common");

  if (!slotGroups.length) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        {tCommon("doctorProfile.booking.noSlots")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {slotGroups.map((group) => {
        const availableCount = group.slots.filter((slot) => slot.available).length;
        const normalizedPeriod = group.period.trim().toLowerCase();
        const knownPeriod = ["morning", "afternoon", "evening", "night"].includes(normalizedPeriod)
          ? normalizedPeriod
          : null;
        const periodLabel = knownPeriod
          ? tCommon(`doctorProfile.booking.periods.${knownPeriod}`)
          : group.period;
        const slotCountLabel = availableCount === 1
          ? tCommon("doctorProfile.booking.slotSingular", { count: availableCount })
          : tCommon("doctorProfile.booking.slotPlural", { count: availableCount });

        return (
          <div key={group.period} className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {periodLabel} ({slotCountLabel})
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
