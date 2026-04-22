"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheck2, CheckCircle2, CircleDot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/ui/medora-loader";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { localDateKey, toUtcIsoFromDateAndSlot } from "@/lib/utils";
import { createAppointment } from "@/lib/appointment-actions";
import { getAvailableSlots } from "@/lib/auth-actions";
import { useRealtimeSlots } from "@/lib/use-realtime-slots";
import { toast } from "@/lib/notify";
import type { BackendDoctorLocation, BackendDoctorProfile, DateOption, SlotGroup } from "@/components/doctor/doctor-profile/types";
import { AppointmentDateSelector } from "@/components/doctor/doctor-profile/AppointmentDateSelector";
import { AppointmentSlotSelector } from "@/components/doctor/doctor-profile/AppointmentSlotSelector";
import { useAppI18n, useT } from "@/i18n/client";

interface AppointmentBookingCardProps {
  doctor: BackendDoctorProfile;
}

const FULL_DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseDaysFromAvailability(availability?: string[] | null) {
  if (!availability?.length) {
    return new Set<string>();
  }
  return new Set(
    availability.map((day) => day.trim().slice(0, 3).toUpperCase()).filter(Boolean)
  );
}

function getLocationKey(location: BackendDoctorLocation, index: number) {
  return location.id || `legacy-${index}`;
}

function buildDateOptions(
  doctor: BackendDoctorProfile,
  labels: {
    monthLabels: string[];
    dayLabels: string[];
    todayLabel: string;
  },
  location?: BackendDoctorLocation,
): DateOption[] {
  const locationDays = parseDaysFromAvailability(location?.available_days ?? null);
  const doctorDays = parseDaysFromAvailability(doctor.available_days ?? null);
  const hasPerDaySchedule = Boolean(location?.day_time_slots && Object.keys(location.day_time_slots).length > 0);
  const hasGlobalPerDaySchedule = Boolean(doctor.day_time_slots && Object.keys(doctor.day_time_slots).length > 0);

  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);

    const dayIndex = date.getDay();
    const fullDay = FULL_DAY_LABELS[dayIndex];
    const shortDay = fullDay.slice(0, 3).toUpperCase();
    const displayDayLabel = labels.dayLabels[dayIndex] || shortDay;

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
      dayLabel: displayDayLabel,
      dayNumber: String(date.getDate()),
      monthLabel: labels.monthLabels[date.getMonth()] || String(date.getMonth() + 1),
      helperLabel: index === 0 ? labels.todayLabel : displayDayLabel,
      disabled: !isEnabled,
    };
  });
}

export function AppointmentBookingCard({ doctor }: AppointmentBookingCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useAppI18n();
  const tCommon = useT("common");

  const [selectedLocationId, setSelectedLocationId] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = React.useState<string | null>(null);
  const [slotGroups, setSlotGroups] = React.useState<SlotGroup[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [visitReason, setVisitReason] = React.useState("");

  const selectedLocation = React.useMemo(() => {
    if (!doctor.locations?.length) return undefined;
    if (!selectedLocationId) return doctor.locations[0];
    const index = doctor.locations.findIndex(
      (location, idx) => getLocationKey(location, idx) === selectedLocationId
    );
    return index >= 0 ? doctor.locations[index] : doctor.locations[0];
  }, [doctor.locations, selectedLocationId]);

  React.useEffect(() => {
    if (!doctor.locations?.length) {
      setSelectedLocationId(null);
      return;
    }

    const hasSelection = doctor.locations.some(
      (location, idx) => getLocationKey(location, idx) === selectedLocationId
    );

    if (!selectedLocationId || !hasSelection) {
      setSelectedLocationId(getLocationKey(doctor.locations[0], 0));
    }
  }, [doctor.locations, selectedLocationId]);

  const monthLabels = React.useMemo(
    () => [
      tCommon("doctorProfile.booking.months.jan"),
      tCommon("doctorProfile.booking.months.feb"),
      tCommon("doctorProfile.booking.months.mar"),
      tCommon("doctorProfile.booking.months.apr"),
      tCommon("doctorProfile.booking.months.may"),
      tCommon("doctorProfile.booking.months.jun"),
      tCommon("doctorProfile.booking.months.jul"),
      tCommon("doctorProfile.booking.months.aug"),
      tCommon("doctorProfile.booking.months.sep"),
      tCommon("doctorProfile.booking.months.oct"),
      tCommon("doctorProfile.booking.months.nov"),
      tCommon("doctorProfile.booking.months.dec"),
    ],
    [tCommon],
  );

  const dayLabels = React.useMemo(
    () => [
      tCommon("doctorProfile.booking.daysShort.sun"),
      tCommon("doctorProfile.booking.daysShort.mon"),
      tCommon("doctorProfile.booking.daysShort.tue"),
      tCommon("doctorProfile.booking.daysShort.wed"),
      tCommon("doctorProfile.booking.daysShort.thu"),
      tCommon("doctorProfile.booking.daysShort.fri"),
      tCommon("doctorProfile.booking.daysShort.sat"),
    ],
    [tCommon],
  );

  const dateOptions = React.useMemo(
    () => buildDateOptions(doctor, {
      monthLabels,
      dayLabels,
      todayLabel: tCommon("doctorProfile.booking.today"),
    }, selectedLocation),
    [dayLabels, doctor, monthLabels, selectedLocation, tCommon]
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

    setLoadingSlots(true);
    try {
      const response = await getAvailableSlots(
        doctor.profile_id,
        selectedDate,
        selectedLocation?.id
      );
      setSlotGroups(response?.slots || []);
    } catch (error) {
      console.error("Failed to load available slots", error);
      setSlotGroups([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [doctor.profile_id, selectedDate, selectedLocation?.id]);

  React.useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Realtime: auto-refresh slots when another user books/cancels
  useRealtimeSlots(doctor.profile_id, selectedDate, loadSlots);

  const consultationFee = selectedLocation?.appointment_duration
    ? doctor.consultation_fee ?? 20
    : selectedLocation?.name
      ? doctor.consultation_fee ?? 20
      : doctor.consultation_fee ?? 20;

  const duration = selectedLocation?.appointment_duration || doctor.appointment_duration || 20;
  const durationLabel = tCommon("doctorProfile.booking.durationRange", {
    start: duration,
    end: duration + 10,
  });

  const canConfirm = Boolean(selectedDate && selectedSlot && selectedLocation);

  async function handleConfirm() {
    if (!canConfirm || !selectedDate || !selectedSlot) {
      return;
    }

    setSubmitting(true);
    try {
      await createAppointment({
        doctor_id: doctor.profile_id,
        doctor_location_id: selectedLocation?.id,
        location_name: selectedLocation?.name,
        appointment_date: toUtcIsoFromDateAndSlot(selectedDate, selectedSlot),
        reason: visitReason.trim() || tCommon("doctorProfile.booking.reasonFallback"),
        notes: tCommon("doctorProfile.booking.notesTemplate", {
          slot: selectedSlot,
          location: selectedLocation?.name || tCommon("doctorProfile.booking.locationNotSpecified"),
        }),
      });

      const params = new URLSearchParams({
        doctorName: `${doctor.title ? `${doctor.title} ` : ""}${doctor.first_name} ${doctor.last_name}`.trim(),
        date: selectedDate,
        time: selectedSlot,
        location: selectedLocation?.name || "",
      });
      router.push(`/patient/appointment-success?${params.toString()}`);
    } catch (error: unknown) {
      const rawErrorMessage = error instanceof Error ? error.message : "";
      if (rawErrorMessage.includes("Not authenticated")) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
        return;
      }
      console.error("Appointment booking failed", error);
      const fallbackMessage = tCommon("doctorProfile.booking.genericError");
      toast.error(locale === "bn" ? fallbackMessage : (rawErrorMessage || fallbackMessage));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="animate-fade-in-up">
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-xl shadow-primary/10">
          <div className="bg-primary px-5 py-4 text-primary-foreground sm:px-6">
            <h2 className="text-2xl font-bold leading-none">{tCommon("doctorProfile.booking.title")}</h2>
            <p className="mt-1 text-sm text-primary-foreground/85">{tCommon("doctorProfile.booking.subtitle")}</p>
          </div>

          <CardContent className="space-y-6 p-4 sm:p-5">
            <section className="space-y-2.5">
              <h3 className="text-sm font-semibold text-foreground">{tCommon("doctorProfile.booking.stepPracticeLocation")}</h3>
              <div className="space-y-2">
                {(doctor.locations || []).map((location, index) => {
                  const locationKey = getLocationKey(location, index);
                  const isSelected = selectedLocationId === locationKey;
                  return (
                    <button
                      type="button"
                      key={locationKey}
                      onClick={() => {
                        setSelectedLocationId(locationKey);
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
                            {index === 0 ? tCommon("doctorProfile.booking.morningShift") : tCommon("doctorProfile.booking.eveningShift")}
                            {" "}• ${Number(consultationFee).toFixed(0)} {tCommon("doctorProfile.booking.feeSuffix")}
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
              <h3 className="text-sm font-semibold text-foreground">{tCommon("doctorProfile.booking.stepDate")}</h3>
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
              <h3 className="text-sm font-semibold text-foreground">{tCommon("doctorProfile.booking.stepSlots")}</h3>
              {loadingSlots ? (
                <div className="space-y-2 rounded-xl border border-border bg-background p-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ButtonLoader className="h-4 w-4" />
                    {tCommon("doctorProfile.booking.loadingSlots")}
                  </div>
                  <CardSkeleton className="h-8" />
                  <CardSkeleton className="h-8" />
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
              <h3 className="text-sm font-semibold text-foreground">{tCommon("doctorProfile.booking.stepReason")}</h3>
              <input
                type="text"
                value={visitReason}
                onChange={(e) => setVisitReason(e.target.value)}
                placeholder={tCommon("doctorProfile.booking.visitReasonPlaceholder")}
                className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </section>

            <div className="grid grid-cols-2 border-t border-border pt-3.5">
              <div>
                <p className="text-xs text-muted-foreground">{tCommon("doctorProfile.booking.totalConsultationFee")}</p>
                <p className="text-2xl font-bold text-foreground">${Number(consultationFee).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{tCommon("doctorProfile.booking.estimatedDuration")}</p>
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
                  <ButtonLoader className="mr-2 h-4 w-4" />
                  {tCommon("doctorProfile.booking.confirming")}
                </>
              ) : (
                <>
                  <CalendarCheck2 className="mr-2 h-4 w-4" />
                  {tCommon("doctorProfile.booking.confirmAppointment")}
                </>
              )}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              {tCommon("doctorProfile.booking.cancellationPolicy")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl border border-primary/10 bg-primary/5">
        <CardContent className="p-3.5">
          <p className="text-sm font-semibold text-foreground">{tCommon("doctorProfile.booking.supportTitle")}</p>
          <p className="text-xs text-muted-foreground">
            {tCommon("doctorProfile.booking.supportDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
