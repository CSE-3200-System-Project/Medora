"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAvailableSlots } from "@/lib/auth-actions";
import { MapPin, Video, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppointmentBookingPanelProps {
  doctor: any;
}

interface BookingState {
  locationId: string | null;
  consultationType: 'face-to-face' | 'online' | null;
  appointmentType: 'new' | 'follow-up' | 'report' | null;
  selectedDate: string | null;
  selectedSlot: string | null;
}

export function AppointmentBookingPanel({ doctor }: AppointmentBookingPanelProps) {
  const [bookingState, setBookingState] = React.useState<BookingState>({
    locationId: null,
    consultationType: null,
    appointmentType: null,
    selectedDate: null,
    selectedSlot: null,
  });

  const [slots, setSlots] = React.useState<any>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  // Generate next 7 days for date selection
  const getUpcomingDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      dates.push({
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${date.getDate()} ${monthNames[date.getMonth()]}`,
        sublabel: i === 0 ? `${date.getDate()} ${monthNames[date.getMonth()]}` : dayNames[date.getDay()],
        date: date.toISOString().split('T')[0],
        dayName: dayNames[date.getDay()],
      });
    }
    
    return dates;
  };

  const upcomingDates = getUpcomingDates();

  // Fetch slots when date and location are selected
  React.useEffect(() => {
    if (bookingState.selectedDate && bookingState.locationId) {
      fetchSlots();
    }
  }, [bookingState.selectedDate, bookingState.locationId]);

  const fetchSlots = async () => {
    if (!bookingState.selectedDate) return;
    
    setLoadingSlots(true);
    try {
      const location = doctor.locations?.find((loc: any, idx: number) => idx.toString() === bookingState.locationId);
      const data = await getAvailableSlots(
        doctor.profile_id, 
        bookingState.selectedDate,
        location?.name
      );
      setSlots(data);
    } catch (error) {
      console.error("Failed to fetch slots:", error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const updateBookingState = (key: keyof BookingState, value: any) => {
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

  const handleConfirm = () => {
    if (!isConfirmEnabled()) return;
    
    // TODO: Implement actual booking API call
    alert(`Booking confirmed!\nLocation: ${bookingState.locationId}\nType: ${bookingState.consultationType}\nAppointment: ${bookingState.appointmentType}\nDate: ${bookingState.selectedDate}\nTime: ${bookingState.selectedSlot}`);
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
            {doctor.locations?.map((location: any, index: number) => (
              <label 
                key={index}
                className={cn(
                  "flex items-start gap-3 p-4 border border-border rounded-lg cursor-pointer transition-colors",
                  bookingState.locationId === index.toString() ? "bg-accent border-primary" : "hover:bg-accent/50"
                )}
              >
                <input
                  type="radio"
                  name="location"
                  value={index.toString()}
                  checked={bookingState.locationId === index.toString()}
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
            ))}
          </div>
        </div>

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
            {['new', 'follow-up', 'report'].map((type) => (
              <button
                key={type}
                onClick={() => updateBookingState('appointmentType', type as any)}
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
          <div className="flex gap-2 overflow-x-auto pb-2">
            {upcomingDates.map((dateObj) => (
              <button
                key={dateObj.date}
                onClick={() => updateBookingState('selectedDate', dateObj.date)}
                className={cn(
                  "shrink-0 flex flex-col items-center py-2 px-4 rounded-lg border min-w-20 transition-colors",
                  bookingState.selectedDate === dateObj.date
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                )}
              >
                <div className="font-semibold text-sm">{dateObj.label}</div>
                <div className="text-xs mt-1">{dateObj.sublabel}</div>
              </button>
            ))}
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
                {slots.slots?.map((group: any, groupIndex: number) => (
                  <div key={groupIndex}>
                    <h4 className="text-sm font-semibold text-foreground mb-2">{group.period}</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {group.slots?.map((slot: any, slotIndex: number) => (
                        <button
                          key={slotIndex}
                          onClick={() => slot.available && updateBookingState('selectedSlot', slot.time)}
                          disabled={!slot.available}
                          className={cn(
                            "py-2 px-2 rounded border text-xs font-medium transition-colors",
                            !slot.available && "opacity-50 cursor-not-allowed",
                            bookingState.selectedSlot === slot.time
                              ? "bg-primary text-primary-foreground border-primary"
                              : slot.available
                              ? "bg-background text-foreground border-border hover:bg-accent"
                              : "bg-muted text-muted-foreground border-muted"
                          )}
                        >
                          {slot.time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
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
