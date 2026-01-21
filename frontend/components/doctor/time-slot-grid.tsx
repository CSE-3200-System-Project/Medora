"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeSlot {
  time: string;
  appointmentId: string | null;
  patientName: string | null;
  reason: string | null;
  status: string | null;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  bloodGroup?: string;
  chronicConditions?: string[];
  appointmentDate?: string;
}

interface TimeSlotGridProps {
  selectedDate: string;
  slots: TimeSlot[];
  onSlotClick: (appointmentId: string) => void;
  onBack: () => void;
}

export function TimeSlotGrid({ 
  selectedDate, 
  slots, 
  onSlotClick,
  onBack 
}: TimeSlotGridProps) {
  const [hoveredSlot, setHoveredSlot] = React.useState<string | null>(null);
  const [popupPosition, setPopupPosition] = React.useState({ x: 0, y: 0 });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const handleSlotHover = (
    slot: TimeSlot, 
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    if (slot.appointmentId) {
      setHoveredSlot(slot.time);
      const rect = event.currentTarget.getBoundingClientRect();
      setPopupPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
    }
  };

  const handleSlotLeave = () => {
    setHoveredSlot(null);
  };

  // Group slots by time period
  const groupSlotsByPeriod = (slots: TimeSlot[]) => {
    const morning: TimeSlot[] = [];
    const afternoon: TimeSlot[] = [];
    const evening: TimeSlot[] = [];

    slots.forEach(slot => {
      const hour = parseInt(slot.time.split(':')[0]);
      const isPM = slot.time.toLowerCase().includes('pm');
      const adjustedHour = isPM && hour !== 12 ? hour + 12 : hour;

      if (adjustedHour < 12) {
        morning.push(slot);
      } else if (adjustedHour < 17) {
        afternoon.push(slot);
      } else {
        evening.push(slot);
      }
    });

    const groups = [];
    if (morning.length > 0) groups.push({ period: 'Morning', slots: morning });
    if (afternoon.length > 0) groups.push({ period: 'Afternoon', slots: afternoon });
    if (evening.length > 0) groups.push({ period: 'Evening', slots: evening });

    return groups;
  };

  const groupedSlots = groupSlotsByPeriod(slots);

  const getStatusColor = (status: string | null) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 border-yellow-400 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-blue-100 border-blue-400 text-blue-800';
      case 'COMPLETED':
        return 'bg-success/20 border-success text-success-muted';
      case 'CANCELLED':
        return 'bg-red-100 border-red-400 text-red-800';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  const hoveredSlotData = slots.find(s => s.time === hoveredSlot);

  return (
    <Card className="rounded-2xl shadow-lg bg-white border-blue-200">
      <CardHeader className="border-b border-blue-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Time Slots
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {formatDate(selectedDate)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 bg-white">
        <div className="space-y-6">
          {groupedSlots.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h4 className="text-sm font-semibold text-blue-900 mb-3">
                {group.period}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {group.slots.map((slot, slotIndex) => (
                  <button
                    key={slotIndex}
                    onClick={() => slot.appointmentId && onSlotClick(slot.appointmentId)}
                    onMouseEnter={(e) => handleSlotHover(slot, e)}
                    onMouseLeave={handleSlotLeave}
                    className={cn(
                      "py-3 px-2 rounded-lg border-2 text-xs font-medium transition-all",
                      slot.appointmentId && "hover:scale-105 hover:shadow-md cursor-pointer",
                      slot.appointmentId
                        ? getStatusColor(slot.status)
                        : "bg-blue-50 border-blue-200 text-blue-600 cursor-default" // Available but empty slots in blue
                    )}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {slots.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <p className="text-blue-600">No time slots available for this date</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-blue-200">
          <p className="text-xs font-semibold text-blue-700 mb-2">Status Legend:</p>
          <div className="flex flex-wrap gap-3 text-xs text-blue-900">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-400" />
              <span>Pending</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-400" />
              <span>Confirmed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-success/20 border-2 border-success" />
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-blue-50 border-2 border-blue-200" />
              <span>Available</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Hover Popup */}
      {hoveredSlot && hoveredSlotData && (
        <div
          className="fixed z-50 bg-white border-2 border-blue-300 rounded-lg shadow-xl p-3 max-w-xs pointer-events-none transform -translate-x-1/2 -translate-y-full"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
          }}
        >
          <div className="space-y-1">
            <p className="font-semibold text-sm text-blue-900">
              {hoveredSlotData.patientName}
            </p>
            <p className="text-xs text-blue-700">
              <span className="font-medium">Time:</span> {hoveredSlotData.time}
            </p>
            <p className="text-xs text-blue-700">
              <span className="font-medium">Reason:</span> {hoveredSlotData.reason}
            </p>
            <div className="flex items-center gap-1 mt-2">
              <div className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                getStatusColor(hoveredSlotData.status)
              )}>
                {hoveredSlotData.status}
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-blue-300" />
        </div>
      )}
    </Card>
  );
}
