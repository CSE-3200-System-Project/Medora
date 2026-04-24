"use client";

import React, { memo, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Hospital, MapPin, Navigation, Pencil, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import type { BackendDoctorLocation } from "@/components/doctor/doctor-profile/types";
import { LocationScheduleDialog } from "@/components/doctor/doctor-profile/LocationScheduleDialog";
import { useT } from "@/i18n/client";

// Lazy-load the map so the profile page doesn't pay the maplibre cost until
// the patient actually clicks "Show on map".
const MapView = dynamic(
  () => import("@/components/doctor/map-view").then((m) => m.MapView),
  { ssr: false, loading: () => <CardSkeleton className="h-90 w-full rounded-2xl" /> },
);

interface DoctorPracticeLocationsProps {
  locations: BackendDoctorLocation[];
  /** First name / last name used to label the synthetic map doctor. */
  doctorName?: { firstName?: string; lastName?: string; title?: string };
  /** Show per-location "Edit schedule" buttons. Pass true only when the
   * viewer is the doctor themselves. */
  editable?: boolean;
  /** Called after a successful per-location schedule save so the caller can
   * refetch or merge locally. */
  onLocationUpdated?: (location: BackendDoctorLocation) => void;
}

function getTimeBlock(
  availability: string | null | undefined,
  tCommon: (key: string) => string,
) {
  if (!availability) {
    return {
      days: tCommon("doctorProfile.locations.defaultDays"),
      time: tCommon("doctorProfile.locations.defaultTime"),
    };
  }

  const parts = availability.split("|").map((item) => item.trim());
  if (parts.length >= 2) {
    return { days: parts[0], time: parts[1] };
  }

  const parsed = availability.split(/(?=\d{1,2}:\d{2}\s?[AP]M)/i);
  if (parsed.length >= 2) {
    return { days: parsed[0].trim(), time: parsed.slice(1).join(" ").trim() };
  }

  return { days: tCommon("doctorProfile.locations.schedule"), time: availability };
}

export const DoctorPracticeLocations = memo(function DoctorPracticeLocations({
  locations,
  doctorName,
  editable = false,
  onLocationUpdated,
}: DoctorPracticeLocationsProps) {
  const tCommon = useT("common");
  const [mapOpen, setMapOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<BackendDoctorLocation | null>(null);

  // MapView expects doctors with hospital_* and chamber_* coords; synthesize
  // one "doctor" so it can render markers for every location of this doctor.
  const syntheticDoctors = useMemo(() => {
    const withCoords = locations.filter(
      (loc) => typeof loc.latitude === "number" && typeof loc.longitude === "number",
    );
    if (withCoords.length === 0) return [];

    // Split into a primary (hospital) and secondary (chamber) so MapView's
    // hospital/chamber marker logic picks up both.
    const [primary, secondary] = [withCoords[0], withCoords[1]];
    return [
      {
        profile_id: "profile-location-map",
        first_name: doctorName?.firstName || "",
        last_name: doctorName?.lastName || "",
        title: doctorName?.title,
        specialization: "",
        hospital_name: primary?.name,
        hospital_address: primary?.address,
        hospital_city: primary?.city,
        hospital_latitude: primary?.latitude ?? undefined,
        hospital_longitude: primary?.longitude ?? undefined,
        chamber_name: secondary?.name,
        chamber_address: secondary?.address,
        chamber_city: secondary?.city,
        chamber_latitude: secondary?.latitude ?? undefined,
        chamber_longitude: secondary?.longitude ?? undefined,
      },
    ];
  }, [locations, doctorName]);

  const hasMappableLocation = syntheticDoctors.length > 0;

  return (
    <section className="animate-fade-in-up">
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-2xl font-bold text-foreground">
            {tCommon("doctorProfile.locations.title")}
          </CardTitle>
          {hasMappableLocation && (
            <Button
              size="sm"
              variant={mapOpen ? "outline" : "default"}
              onClick={() => setMapOpen((v) => !v)}
              className="shrink-0 rounded-xl"
            >
              {mapOpen ? (
                <>
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Hide map
                </>
              ) : (
                <>
                  <Navigation className="mr-1.5 h-3.5 w-3.5" />
                  Show on map
                </>
              )}
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-3">
          {mapOpen && hasMappableLocation && (
            <div className="h-90 overflow-hidden rounded-2xl border border-border">
              <MapView doctors={syntheticDoctors} />
            </div>
          )}

          {locations.map((location) => {
            const timeBlock = getTimeBlock(location.availability, tCommon);
            return (
              <article
                key={`${location.name}-${location.address}`}
                className="rounded-2xl border border-border p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-more-light text-primary">
                      <Hospital className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-base font-semibold text-foreground">{location.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {[location.address, location.city, location.country].filter(Boolean).join(", ")}
                      </p>
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary/85">{timeBlock.days}</p>
                      <p className="text-xs font-semibold text-foreground/75">{timeBlock.time}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {typeof location.latitude === "number" && typeof location.longitude === "number" ? (
                      <button
                        type="button"
                        onClick={() => setMapOpen(true)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                      >
                        {tCommon("doctorProfile.locations.map")}
                        <MapPin className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {editable && location.id ? (
                      <button
                        type="button"
                        onClick={() => setEditingLocation(location)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit schedule
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </CardContent>
      </Card>

      {editable && editingLocation?.id ? (
        <LocationScheduleDialog
          open={Boolean(editingLocation)}
          onOpenChange={(open) => {
            if (!open) setEditingLocation(null);
          }}
          locationId={editingLocation.id}
          locationName={editingLocation.name}
          initialAvailableDays={editingLocation.available_days ?? null}
          initialDayTimeSlots={editingLocation.day_time_slots ?? null}
          initialAppointmentDuration={editingLocation.appointment_duration ?? null}
          onSaved={(result) => {
            onLocationUpdated?.({
              ...editingLocation,
              available_days: result.available_days,
              day_time_slots: result.day_time_slots,
              appointment_duration: result.appointment_duration ?? editingLocation.appointment_duration ?? null,
            });
            setEditingLocation(null);
          }}
        />
      ) : null}
    </section>
  );
});
