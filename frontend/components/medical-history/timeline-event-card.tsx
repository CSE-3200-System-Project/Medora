/**
 * Timeline Event Card Component
 * Displays event details in a card format with event-type specific styling
 */

import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimelineDate, type TimelineEvent } from "./timeline-utils";
import { getTimelineAccentByEventType } from "./module-tab-accents";

interface TimelineEventCardProps {
  event: TimelineEvent;
  isAlternate?: boolean; // true = right side, false = left side
}

export const TimelineEventCard = React.memo(function TimelineEventCard({
  event,
  isAlternate = false,
}: TimelineEventCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'consultation': 'Consultation',
      'prescription': 'Medication',
      'lab-test': 'Lab Test',
      'imaging': 'Imaging',
      'follow-up': 'Follow-up',
      'surgery': 'Surgery',
      'hospitalization': 'Hospitalization',
      'vaccination': 'Vaccination',
      'appointment': 'Appointment'
    };
    return labels[type] || type;
  };

  const doctorName = event.doctorName?.trim();
  const itemLine = event.items && event.items.length === 1 ? event.items[0].trim() : undefined;
  const showDetails = Boolean(event.items && event.items.length > 0);
  const accent = getTimelineAccentByEventType(event.type);
  const desktopAlignment = isAlternate ? "lg:ml-auto" : "";

  return (
    <Card className={`w-full max-w-none rounded-xl border border-border bg-card p-4 shadow-sm lg:max-w-sm ${desktopAlignment}`}>
      <CardContent className="p-0">
        <div className={`rounded-lg p-3 ${accent.timelineStripeBg}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <h4 className="text-left text-lg font-semibold leading-snug whitespace-normal text-foreground sm:text-xl">
              {event.title}
            </h4>
            <Badge
              variant="outline"
              className={`rounded-full border px-2 py-1 text-[11px] font-semibold sm:text-xs ${accent.timelineBadge}`}
            >
              {getEventTypeLabel(event.type)}
            </Badge>
          </div>

          {doctorName ? (
            <p className="text-sm font-semibold text-foreground">{doctorName}</p>
          ) : itemLine ? (
            <p className="text-sm font-semibold text-foreground">{itemLine}</p>
          ) : null}

          <p className="text-sm text-muted-foreground">{formatTimelineDate(event.date)}</p>
        </div>

        {showDetails ? (
          <div className="mt-2">
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className={`text-xs cursor-pointer mt-2 font-semibold ${accent.timelineToggle}`}
            >
              {isExpanded ? 'Hide details' : 'Show details'}
            </div>

            {isExpanded && (
              <div className="mt-2 space-y-1 text-sm text-foreground">
                {event.items?.map((item, idx) => (
                  <p key={idx}>{item}</p>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});


TimelineEventCard.displayName = "TimelineEventCard";

