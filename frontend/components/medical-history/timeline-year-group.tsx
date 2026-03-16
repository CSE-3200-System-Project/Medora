/**
 * Timeline Year Group Component
 * Groups and displays all events within a specific year with collapsible section
 */

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TimelineNode } from "./timeline-node";
import { TimelineEventCard } from "./timeline-event-card";
import { type TimelineEvent } from "./timeline-utils";
import { ChevronDown, Calendar } from "lucide-react";

interface TimelineYearGroupProps {
  year: string;
  events: TimelineEvent[];
}

export const TimelineYearGroup = React.memo(function TimelineYearGroup({
  year,
  events,
}: TimelineYearGroupProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="space-y-6">
      {/* Year header with collapse */}
      <div className="flex items-center gap-3 px-4">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-3 flex-1 text-left hover:opacity-70 transition-opacity"
        >
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <h4 className="text-lg font-semibold text-foreground">{year}</h4>
          <Badge variant="outline" className="ml-auto">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </Badge>
          <ChevronDown
            className="h-4 w-4 text-muted-foreground transition-transform duration-200"
            style={{
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
            }}
          />
        </button>
      </div>

      {/* Events timeline */}
      {!isCollapsed && (
        <div className="relative px-2 sm:px-4">
          {/* Vertical center line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 z-0 w-px -translate-x-1/2 bg-linear-to-b from-primary/30 via-primary/20 to-primary/10"
            style={{
              height: "100%",
            }}
          />

          {/* Events */}
          <div className="relative z-10 space-y-8 lg:space-y-10">
            {events.map((event, index) => {
              const isAlternate = index % 2 === 1;

              return (
                <div key={event.id} className="relative min-h-60 lg:min-h-65">
                  {/* Timeline node */}
                  <TimelineNode event={event} isAlternate={isAlternate} />

                  {/* Event card row */}
                  <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-2 lg:gap-16">
                    <div className={isAlternate ? "hidden lg:block" : "block"}>
                      {!isAlternate && <TimelineEventCard event={event} isAlternate={false} />}
                    </div>
                    <div className={!isAlternate ? "hidden lg:block" : "block"}>
                      {isAlternate && <TimelineEventCard event={event} isAlternate />}
                    </div>

                    {/* Mobile fallback always full width */}
                    <div className="lg:hidden">
                      <TimelineEventCard event={event} isAlternate={false} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

TimelineYearGroup.displayName = "TimelineYearGroup";
