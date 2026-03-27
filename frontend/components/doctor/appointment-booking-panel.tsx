"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAvailableSlots } from "@/lib/auth-actions";
import { createAppointment, getDoctorBookedSlots } from "@/lib/appointment-actions";
import { useRouter, usePathname } from "next/navigation";
import { MapPin, XCircle, Navigation, ExternalLink } from "lucide-react";
import { cn, localDateKey } from "@/lib/utils";
import { Map, MapMarker, MarkerContent, MapControls } from "@/components/ui/map-lazy";
import type { BackendDoctorLocation, BackendDoctorProfile, SlotGroup } from "@/components/doctor/doctor-profile/types";

interface AppointmentBookingPanelProps {
  doctor: BackendDoctorProfile & { telemedicine_available?: boolean };
}

interface BookingState {
  locationId: string | null;
  consultationType: 'face-to-face' | 'online' | null;
  appointmentType: 'new' | 'follow-up' | 'report' | null;
  selectedDate: string | null;
  selectedSlot: string | null;
}

type AppointmentType = Exclude<BookingState["appointmentType"], null>;

interface SlotResponse {
  date: string;
  location: string;
  slots: SlotGroup[];
}

interface BookedSlot {
  time: string;
  is_booked: boolean;
  is_past: boolean;
  patient_name?: string | null;
}

export function AppointmentBookingPanel({ doctor }: AppointmentBookingPanelProps) {
  const [bookingState, setBookingState] = React.useState<BookingState>({
    locationId: null,
    consultationType: null,
    appointmentType: null,
    selectedDate: null,
    selectedSlot: null,
  });

  const [slots, setSlots] = React.useState<SlotResponse | null>(null);
  const [bookedSlots, setBookedSlots] = React.useState<BookedSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  const getLocationKey = (location: BackendDoctorLocation, index: number) => location.id || index.toString();

  const resolveSelectedLocation = React.useCallback((): BackendDoctorLocation | null => {
    if (!bookingState.locationId || !doctor.locations) return null;
    const index = doctor.locations.findIndex(
      (location, idx) => getLocationKey(location, idx) === bookingState.locationId
    );
    return index >= 0 ? doctor.locations[index] : null;
  }, [bookingState.locationId, doctor.locations]);

  // Generate next 7 days for date selection
  const getUpcomingDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const fullDayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      dates.push({
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${date.getDate()} ${monthNames[date.getMonth()]}`,
        sublabel: i === 0 ? `${date.getDate()} ${monthNames[date.getMonth()]}` : dayNames[date.getDay()],
        date: localDateKey(date),
        dayName: dayNames[date.getDay()],
        dayFullName: fullDayNames[date.getDay()],
      });
    }
    
    return dates;
  };

  const upcomingDates = getUpcomingDates();

  // Fetch slots when date and location are selected
  const fetchSlots = React.useCallback(async () => {
    if (!bookingState.selectedDate) return;
    
    setLoadingSlots(true);
    try {
      const location = resolveSelectedLocation();
      
      // Fetch both available slots and booked slots in parallel
      const [slotsData, bookedData] = await Promise.all([
        getAvailableSlots(doctor.profile_id, bookingState.selectedDate, location?.id),
        getDoctorBookedSlots(doctor.profile_id, bookingState.selectedDate)
      ]);
      
      setSlots((slotsData ?? null) as SlotResponse | null);
      setBookedSlots((bookedData?.slots ?? []) as BookedSlot[]);
    } catch (error) {
      console.error("Failed to fetch slots:", error);
    } finally {
      setLoadingSlots(false);
    }
  }, [bookingState.selectedDate, doctor.profile_id, resolveSelectedLocation]);

  React.useEffect(() => {
    if (bookingState.selectedDate && bookingState.locationId) {
      fetchSlots();
    }
  }, [bookingState.selectedDate, bookingState.locationId, fetchSlots]);

  const updateBookingState = <K extends keyof BookingState>(key: K, value: BookingState[K]) => {
    setBookingState(prev => ({ ...prev, [key]: value }));
  };

  const isConfirmEnabled = () => {
    return (
      bookingState.locationId &&
      bookingState.consultationType &&
      bookingState.appointmentType &&
      bookingState.selectedDate &&
      bookingState.selectedSlot
    );
  };

  // Check if a slot is booked or past
  const getSlotStatus = (slotTime: string) => {
    const bookedSlot = bookedSlots.find(s => s.time === slotTime);
    if (bookedSlot) {
      return {
        isBooked: bookedSlot.is_booked,
        isPast: bookedSlot.is_past,
        patientName: bookedSlot.patient_name
      };
    }
    return { isBooked: false, isPast: false, patientName: null };
  };

  const router = useRouter();
  const pathname = usePathname();
  const [, setIsSubmitting] = React.useState(false);

  const hasValidCoords = (location: BackendDoctorLocation | null) => {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude);
  };

  const handleConfirm = async () => {
    if (!isConfirmEnabled()) return;

    setIsSubmitting(true);
    try {
      await createAppointment({
        doctor_id: doctor.profile_id,
        doctor_location_id: resolveSelectedLocation()?.id,
        appointment_date: new Date(bookingState.selectedDate!).toISOString(),
        reason: `${bookingState.consultationType} - ${bookingState.appointmentType}`,
        location_name: resolveSelectedLocation()?.name,
        notes: `Slot: ${bookingState.selectedSlot} | Location: ${resolveSelectedLocation()?.name}`
      });
      
      // Get appointment details for success page
      const location = resolveSelectedLocation();
      const doctorName = `Dr. ${doctor.first_name} ${doctor.last_name}`;
      const appointmentDate = bookingState.selectedDate!;
      const appointmentTime = bookingState.selectedSlot!;
      const locationName = location?.name || "Not specified";
      
      // Navigate to success page with appointment details
      const params = new URLSearchParams({
        doctorName,
        date: appointmentDate,
        time: appointmentTime,
        location: locationName,
      });
      
      router.push(`/patient/appointment-success?${params.toString()}`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Booking failed";
      if (errorMessage === "Not authenticated" || errorMessage.includes("Not authenticated")) {
        router.push(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      } else {
        alert("Booking failed: " + errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="rounded-2xl shadow-lg">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-lg">
          Select Location, Time Slot & Consultation Method
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Step 1: Location Selection */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Select a Location</h3>
          <div className="space-y-2">
            {doctor.locations?.map((location, index: number) => {
              const locationKey = getLocationKey(location, index);
              return (
              <label 
                key={locationKey}
                className={cn(
                  "flex items-start gap-3 p-4 border border-border rounded-lg cursor-pointer transition-colors",
                  bookingState.locationId === locationKey ? "bg-primary/10 border-primary/50" : "hover:bg-accent/50"
                )}
              >
                <input
                  type="radio"
                  name="location"
                  value={locationKey}
                  checked={bookingState.locationId === locationKey}
                  onChange={(e) => updateBookingState('locationId', e.target.value)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-foreground">{location.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {location.address}, {location.city}, {location.country}
                  </div>
                  {location.availability && (
                    <div className="text-xs text-foreground mt-2">
                      {location.availability}
                    </div>
                  )}
                </div>
              </label>
              )
            })}
          </div>
        </div>

        {/* Location Map - Shows when a location is selected */}
        {bookingState.locationId && (() => {
          const selectedLocation = resolveSelectedLocation();
          if (!selectedLocation || !hasValidCoords(selectedLocation)) {
            return null;
          }

          const lat = Number(selectedLocation?.latitude);
          const lng = Number(selectedLocation?.longitude);
          return (
            <div className="rounded-xl overflow-hidden border border-border">
              <div className="h-48 md:h-56 relative w-full">
                <Map
                  center={[lng, lat]}
                  zoom={15}
                >
                  <MapControls position="top-right" showZoom showCompass={false} />
                  <MapMarker longitude={lng} latitude={lat}>
                    <MarkerContent>
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                        <MapPin className="w-5 h-5 text-white" />
                      </div>
                    </MarkerContent>
                  </MapMarker>
                </Map>
              </div>
              <div className="p-3 bg-accent/30 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span className="font-medium">{selectedLocation.name}</span>
                </div>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Navigation className="w-3 h-3" />
                  Open Map
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })()}

        {/* Step 2: Consultation Type */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Select Consultation Type</h3>
          <div className="flex gap-2">
            <button
              onClick={() => updateBookingState('consultationType', 'face-to-face')}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg border font-medium transition-colors",
                bookingState.consultationType === 'face-to-face'
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-accent"
              )}
            >
              Face to Face
            </button>
            {doctor.telemedicine_available && (
              <button
                onClick={() => updateBookingState('consultationType', 'online')}
                className={cn(
                  "flex-1 py-2 px-4 rounded-lg border font-medium transition-colors",
                  bookingState.consultationType === 'online'
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                )}
              >
                Online
              </button>
            )}
          </div>
        </div>

        {/* Step 3: Appointment Type */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Appointment Type</h3>
          <div className="grid grid-cols-3 gap-2">
            {(['new', 'follow-up', 'report'] as AppointmentType[]).map((type) => (
              <button
                key={type}
                onClick={() => updateBookingState('appointmentType', type)}
                className={cn(
                  "py-2 px-3 rounded-lg border text-sm font-medium transition-colors",
                  bookingState.appointmentType === type
                    ? "bg-accent text-accent-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                )}
              >
                {type === 'new' ? 'New Patient' : type === 'follow-up' ? 'Follow Up' : 'Report Show'}
              </button>
            ))}
          </div>
        </div>

        {/* Step 4: Date Selection */}
        <div>
          <h3 className="font-semibold text-foreground mb-3">Select an Available Time</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-hidden">
            {upcomingDates.map((dateObj) => {
              const selectedLocation = resolveSelectedLocation();

              // If per-day schedules exist on the doctor or location, use them as authoritative
              const locationDaySlots = selectedLocation?.day_time_slots;
              const doctorDaySlots = doctor?.day_time_slots;

              let isDateAvailable = false;

              if (locationDaySlots && Object.keys(locationDaySlots).length > 0) {
                const slotsForDay = locationDaySlots[dateObj.dayFullName];
                isDateAvailable = Array.isArray(slotsForDay) && slotsForDay.length > 0;
              } else if (doctorDaySlots && Object.keys(doctorDaySlots).length > 0) {
                const slotsForDay = doctorDaySlots[dateObj.dayFullName];
                isDateAvailable = Array.isArray(slotsForDay) && slotsForDay.length > 0;
              } else {
                const availableDays: string[] = selectedLocation?.available_days ?? doctor.available_days ?? [];
                isDateAvailable = !availableDays || availableDays.length === 0
                  ? true
                  : availableDays.some(day => day.trim().slice(0,3).toUpperCase() === dateObj.dayName.toUpperCase());
              }

              return (
                <button
                  key={dateObj.date}
                  onClick={() => isDateAvailable && updateBookingState('selectedDate', dateObj.date)}
                  disabled={!isDateAvailable}
                  className={cn(
                    "shrink-0 flex flex-col items-center py-2 px-4 rounded-lg border min-w-20 transition-colors",
                    bookingState.selectedDate === dateObj.date
                      ? "bg-primary text-primary-foreground border-primary"
                      : isDateAvailable
                        ? "bg-background text-foreground border-border hover:bg-accent"
                        : "bg-muted/60 text-muted-foreground border-border cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="font-semibold text-sm">{dateObj.label}</div>
                  <div className="text-xs mt-1">{dateObj.sublabel}</div>
                  {!isDateAvailable && (
                    <div className="text-xxs mt-2 text-muted-foreground">Not available</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 5: Time Slot Selection */}
        {bookingState.selectedDate && (
          <div>
            {loadingSlots ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Loading slots...</p>
              </div>
            ) : slots ? (
              <div className="space-y-4">
                {slots.slots?.map((group, groupIndex: number) => (
                  <div key={groupIndex}>
                    <h4 className="text-sm font-semibold text-foreground mb-2">{group.period}</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {group.slots?.map((slot, slotIndex: number) => {
                        const { isBooked, isPast } = getSlotStatus(slot.time);
                        const isUnavailable = !slot.available || isBooked || isPast;
                        const isSelected = bookingState.selectedSlot === slot.time;
                        
                        return (
                          <button
                            key={slotIndex}
                            onClick={() => !isUnavailable && updateBookingState('selectedSlot', slot.time)}
                            disabled={isUnavailable}
                            title={isPast ? "Past slot" : isBooked ? "Already booked" : !slot.available ? "Not available" : ""}
                            className={cn(
                              "py-2 px-2 rounded border text-xs font-medium transition-colors relative",
                              isUnavailable && "opacity-50 cursor-not-allowed",
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : !isUnavailable
                                ? "bg-background text-foreground border-border hover:bg-accent"
                                : isBooked
                                ? "bg-destructive/10 text-destructive-muted border-destructive/20"
                                : isPast
                                ? "bg-muted/70 text-muted-foreground border-border"
                                : "bg-muted text-muted-foreground border-muted"
                            )}
                          >
                            <span className={cn(isPast && "line-through")}>{slot.time}</span>
                            {isBooked && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center">
                                <XCircle className="w-2 h-2 text-white" />
                              </span>
                            )}
                            {isPast && !isBooked && (
                              <span className="absolute -top-1 -right-1 w-3 h-3 bg-muted-foreground rounded-full" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-background border border-border"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-red-50 border border-red-200"></div>
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-muted/50 border border-border"></div>
                    <span>Past</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No slots available for this date
              </p>
            )}
          </div>
        )}

        {/* Step 6: Confirm Button */}
        <Button
          onClick={handleConfirm}
          disabled={!isConfirmEnabled()}
          className="w-full h-12 text-base font-semibold"
          variant="medical"
        >
          Confirm Appointment
        </Button>
      </CardContent>
    </Card>
  );
}

