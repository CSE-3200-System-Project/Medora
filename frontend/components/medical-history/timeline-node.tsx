/**
 * Timeline Node Component
 * Displays the visual node for a timeline event (colored circle with icon)
 */

import React, { useMemo } from "react";
import * as LucideIcons from "lucide-react";
import { EVENT_COLOR_MAP, type TimelineEvent } from "./timeline-utils";

interface TimelineNodeProps {
  event: TimelineEvent;
  isAlternate?: boolean;
}

export const TimelineNode = React.memo(function TimelineNode({
  event,
  isAlternate = false,
}: TimelineNodeProps) {
  // Get the icon component dynamically
  const IconComponent = useMemo(() => {
    const iconName = event.icon;
    return (LucideIcons as any)[iconName] || LucideIcons.Clock;
  }, [event.icon]);

  const colors = EVENT_COLOR_MAP[event.type];

  return (
    <div
      className="absolute left-1/2 z-20 -translate-x-1/2"
      style={{
        top: "2rem",
      }}
    >
      {/* Outer ring */}
      <div className={`h-10 w-10 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center`}>
        {/* Inner circle with icon */}
        <div className={`h-6 w-6 rounded-full bg-white dark:bg-card flex items-center justify-center`}>
          <IconComponent className={`h-4 w-4 ${colors.text}`} strokeWidth={2.5} />
        </div>
      </div>

      {/* Connection lines to card */}
      {isAlternate !== undefined && (
        <>
          <div
            className={`absolute top-5 h-px ${colors.bg}`}
            style={{
              width: "4rem",
              [isAlternate ? "right" : "left"]: "100%",
            }}
          />
        </>
      )}
    </div>
  );
});

TimelineNode.displayName = "TimelineNode";
