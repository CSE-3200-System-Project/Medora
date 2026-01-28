"use client";

import React from "react";
import { Mic, MicOff, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { VoiceRecorderState } from "@/lib/use-voice-recorder";

interface VoiceInputButtonProps {
  state: VoiceRecorderState;
  duration: number;
  isSupported: boolean;
  error: string | null;
  onStartRecording: () => void;
  onStopRecording: () => void;
  className?: string;
}

/**
 * Voice input button with recording animation and state management.
 * Shows microphone icon, recording indicator, and duration counter.
 */
export function VoiceInputButton({
  state,
  duration,
  isSupported,
  error,
  onStartRecording,
  onStopRecording,
  className
}: VoiceInputButtonProps) {
  // Format duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Recording state - show stop button with pulse animation
  if (state === "recording") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="destructive"
          size="icon"
          onClick={onStopRecording}
          className="relative h-11 w-11"
          aria-label="Stop recording"
        >
          <Square className="w-4 h-4 fill-current" />
          {/* Pulse animation */}
          <span className="absolute inset-0 rounded-md animate-ping bg-destructive/50" />
        </Button>
        <div className="flex flex-col text-sm">
          <span className="text-destructive font-medium flex items-center gap-1">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            Recording...
          </span>
          <span className="text-muted-foreground text-xs">
            {formatDuration(duration)} / 1:00
          </span>
        </div>
      </div>
    );
  }

  // Processing state - show loader
  if (state === "processing") {
    return (
      <Button
        variant="secondary"
        size="icon"
        disabled
        className={cn("h-11 w-11", className)}
        aria-label="Processing"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    );
  }

  // Error state - show disabled mic
  if (state === "error" || !isSupported) {
    return (
      <Button
        variant="outline"
        size="icon"
        disabled
        className={cn("h-11 w-11 opacity-50", className)}
        title={error || "Voice input not supported"}
        aria-label="Voice input unavailable"
      >
        <MicOff className="w-5 h-5 text-muted-foreground" />
      </Button>
    );
  }

  // Idle state - show mic button ready to record
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onStartRecording}
      className={cn(
        "h-11 w-11 hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors",
        className
      )}
      title="Click to speak your symptoms"
      aria-label="Start voice input"
    >
      <Mic className="w-5 h-5" />
    </Button>
  );
}
