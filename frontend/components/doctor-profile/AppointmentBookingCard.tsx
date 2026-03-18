"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck2, CheckCircle2, CircleDot, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { localDateKey } from "@/lib/utils";
import { createAppointment } from "@/lib/appointment-actions";
import { getAvailableSlots } from "@/lib/auth-actions";
import { useRealtimeSlots } from "@/lib/use-realtime-slots";
import type { BackendDoctorProfile, DateOption, SlotGroup } from "@/components/doctor-profile/types";
import { AppointmentDateSelector } from "@/components/doctor-profile/AppointmentDateSelector";
import { AppointmentSlotSelector } from "@/components/doctor-profile/AppointmentSlotSelector";

interface AppointmentBookingCardProps {
  doctor: BackendDoctorProfile;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDaysFromAvailability(availability?: string[] | null) {
  if (!availability?.length) {
    return new Set<string>();
  }
  return new Set(
    availability.map((day) => day.trim().slice(0, 3).toUpperCase()).filter(Boolean)
  );
}

function buildDateOptions(doctor: BackendDoctorProfile, selectedLocationIndex: number): DateOption[] {
  const location = doctor.locations?.[selectedLocationIndex];
  const locationDays = parseDaysFromAvailability(location?.available_days ?? null);
  const doctorDays = parseDaysFromAvailability(doctor.available_days ?? null);
  const hasPerDaySchedule = Boolean(location?.day_time_slots && Object.keys(location.day_time_slots).length > 0);
  const hasGlobalPerDaySchedule = Boolean(doctor.day_time_slots && Object.keys(doctor.day_time_slots).length > 0);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    const fullDay = FULL_DAY_LABELS[date.getDay()];
    const shortDay = DAY_LABELS[date.getDay()].toUpperCase();

    let isEnabled = true;
    if (hasPerDaySchedule) {
      const slots = location?.day_time_slots?.[fullDay] || [];
      isEnabled = slots.length > 0;
    } else if (hasGlobalPerDaySchedule) {
      const slots = doctor.day_time_slots?.[fullDay] || [];
      isEnabled = slots.length > 0;
    } else if (locationDays.size) {
      isEnabled = locationDays.has(shortDay);
    } else if (doctorDays.size) {
      isEnabled = doctorDays.has(shortDay);
    }

    return {
      key: localDateKey(date),
      dayLabel: shortDay,
      dayNumber: String(date.getDate()),
      monthLabel: MONTH_LABELS[date.getMonth()],
      helperLabel: index === 0 ? "Today" : shortDay,
      disabled: !isEnabled,
    };
  });
}

function parseDateTimeToIso(dateKey: string, slotTime: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const match = slotTime.match(/(\d{1,2})(?::(\d{2}))?\s?(AM|PM)/i);
  if (!match) {
    return date.toISOString();
  }

  let hours = Number(match[1]) % 12;
  const minutes = Number(match[2] || "0");
  const period = match[3].toUpperCase();
  if (period === "PM") {
    hours += 12;
  }

  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function AppointmentBookingCard({ doctor }: AppointmentBookingCardProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedLocationIndex, setSelectedLocationIndex] = React.useState(0);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [slotGroups, setSlotGroups] = React.useState<SlotGroup[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [visitReason, setVisitReason] = React.useState("");

  const dateOptions = React.useMemo(
    () => buildDateOptions(doctor, selectedLocationIndex),
    [doctor, selectedLocationIndex]
  );

  React.useEffect(() => {
    const firstEnabledDate = dateOptions.find((option) => !option.disabled)?.key ?? null;
    setSelectedDate(firstEnabledDate);
    setSelectedSlot(null);
  }, [dateOptions]);

  const loadSlots = React.useCallback(async () => {
    if (!selectedDate) {
      setSlotGroups([]);
      return;
    }

    const selectedLocation = doctor.locations?.[selectedLocationIndex];
    setLoadingSlots(true);
    try {
      const response = await getAvailableSlots(
        doctor.profile_id,
        selectedDate,
        selectedLocation?.name
      );
      setSlotGroups(response?.slots || []);
    } catch (error) {
      console.error("Failed to load available slots", error);
      setSlotGroups([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [doctor.profile_id, doctor.locations, selectedDate, selectedLocationIndex]);

  React.useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Realtime: auto-refresh slots when another user books/cancels
  useRealtimeSlots(doctor.profile_id, selectedDate, loadSlots);

  const selectedLocation = doctor.locations?.[selectedLocationIndex];
  const consultationFee = selectedLocation?.appointment_duration
    ? doctor.consultation_fee ?? 20
    : selectedLocation?.name
      ? doctor.consultation_fee ?? 20
      : doctor.consultation_fee ?? 20;

  const duration = selectedLocation?.appointment_duration || doctor.appointment_duration || 20;
  const durationLabel = `${duration}-${duration + 10} mins`;

  const canConfirm = Boolean(selectedDate && selectedSlot && selectedLocation);

  async function handleConfirm() {
    if (!canConfirm || !selectedDate || !selectedSlot) {
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment({
        doctor_id: doctor.profile_id,
        appointment_date: parseDateTimeToIso(selectedDate, selectedSlot),
        reason: visitReason.trim() || "New consultation",
        notes: `Slot: ${selectedSlot} | Location: ${selectedLocation?.name}`,
      });

      const params = new URLSearchParams({
        doctorName: `${doctor.title ? `${doctor.title} ` : ""}${doctor.first_name} ${doctor.last_name}`.trim(),
        date: selectedDate,
        time: selectedSlot,
        location: selectedLocation?.name || "Not specified",
      });
      router.push(`/patient/appointment-success?${params.toString()}`);
    } catch (error: any) {
      if (error?.message?.includes("Not authenticated")) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }
      console.error("Appointment booking failed", error);
      alert(error?.message || "Failed to create appointment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-xl shadow-primary/10">
          <div className="bg-primary px-5 py-4 text-primary-foreground sm:px-6">
            <h2 className="text-2xl font-bold leading-none">Book Appointment</h2>
            <p className="mt-1 text-sm text-primary-foreground/85">Secure your slot in minutes</p>
          </div>

          <CardContent className="space-y-6 p-4 sm:p-5">
            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">1. Select Practice Location</h3>
              <div className="space-y-2">
                {(doctor.locations || []).map((location, index) => {
                  const isSelected = selectedLocationIndex === index;
                  return (
                    <button
                      type="button"
                      key={`${location.name}-${index}`}
                      onClick={() => {
                        setSelectedLocationIndex(index);
                        setSelectedSlot(null);
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary-more-light/35"
                          : "border-border bg-background hover:border-primary/35"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{location.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {index === 0 ? "Morning Shift" : "Evening Shift"} • ${Number(consultationFee).toFixed(0)} Fee
                          </p>
                        </div>
                        {isSelected ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
                        ) : (
                          <CircleDot className="mt-0.5 h-4 w-4 text-muted-foreground/70" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">2. Select Date</h3>
              <AppointmentDateSelector
                dates={dateOptions}
                selectedDate={selectedDate}
                onSelectDate={(dateKey) => {
                  setSelectedDate(dateKey);
                  setSelectedSlot(null);
                }}
              />
            </section>

            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">3. Available Slots</h3>
              {loadingSlots ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching available slots...
                </div>
              ) : (
                <AppointmentSlotSelector
                  slotGroups={slotGroups}
                  selectedSlot={selectedSlot}
                  onSelectSlot={setSelectedSlot}
                />
              )}
            </section>

            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">4. Reason for Visit</h3>
              <input
                type="text"
                value={visitReason}
                onChange={(e) => setVisitReason(e.target.value)}
                placeholder="e.g., Follow-up checkup, New consultation..."
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </section>

            <div className="grid grid-cols-2 border-t border-border pt-3.5">
              <div>
                <p className="text-xs text-muted-foreground">Total Consultation Fee</p>
                <p className="text-2xl font-bold text-foreground">${Number(consultationFee).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Est. Duration</p>
                <p className="text-sm font-semibold text-foreground">{durationLabel}</p>
              </div>
            </div>

            <Button
              onClick={handleConfirm}
              disabled={!canConfirm || submitting}
              className="h-12 w-full rounded-xl bg-primary text-base font-semibold shadow-lg shadow-primary/25 hover:bg-blue-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <CalendarCheck2 className="mr-2 h-4 w-4" />
                  Confirm Appointment
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              No cancellation fee if canceled at least 12 hours before appointment time.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <Card className="rounded-2xl border border-primary/10 bg-primary/5">
        <CardContent className="p-3.5">
          <p className="text-sm font-semibold text-foreground">Instant Support</p>
          <p className="text-xs text-muted-foreground">
            Need help with booking? Call us at +1 (800) MEDORA-HELP
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
