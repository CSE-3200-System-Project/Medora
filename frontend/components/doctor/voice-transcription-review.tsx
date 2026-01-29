"use client";

import React from "react";
import { AlertCircle, CheckCircle2, AlertTriangle, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VoiceTranscriptionReviewProps {
  text: string;
  confidence: number;
  confidenceLevel: "high" | "medium" | "low";
  languageDetected: string;
  onTextChange: (text: string) => void;
  onConfirm: () => void;
  onRetry: () => void;
  onCancel: () => void;
  className?: string;
}

/**
 * Transcription review component that allows users to:
 * - View and edit the transcribed text
 * - See confidence level with appropriate warnings
 * - Confirm to use the text for search
 * - Retry recording if not satisfied
 */
export function VoiceTranscriptionReview({
  text,
  confidence,
  confidenceLevel,
  languageDetected,
  onTextChange,
  onConfirm,
  onRetry,
  onCancel,
  className
}: VoiceTranscriptionReviewProps) {
  // Map language codes to display names
  const getLanguageName = (code: string): string => {
    const languages: Record<string, string> = {
      'bn': 'Bangla',
      'en': 'English',
      'hi': 'Hindi',
      'mixed': 'Mixed'
    };
    return languages[code] || code;
  };

  // Get confidence display config
  const getConfidenceConfig = () => {
    switch (confidenceLevel) {
      case "high":
        return {
          icon: CheckCircle2,
          color: "text-success",
          bgColor: "bg-success/10",
          borderColor: "border-success/30",
          label: "Good quality",
          message: null
        };
      case "medium":
        return {
          icon: AlertTriangle,
          color: "text-yellow-600",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          label: "Review needed",
          message: "We may not have understood clearly. Please review the text before searching."
        };
      case "low":
        return {
          icon: AlertCircle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
          label: "Low confidence",
          message: "The transcription quality is low. Please retry or edit the text carefully."
        };
    }
  };

  const config = getConfidenceConfig();
  const ConfidenceIcon = config.icon;

  return (
    <div className={cn(
      "p-4 rounded-xl border-2 space-y-3 transition-all",
      config.bgColor,
      config.borderColor,
      className
    )}>
      {/* Header with badges */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Detected from voice</span>
          <Badge variant="outline" className="text-xs">
            {getLanguageName(languageDetected)}
          </Badge>
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-medium", config.color)}>
          <ConfidenceIcon className="w-3.5 h-3.5" />
          <span>{config.label}</span>
          <span className="text-muted-foreground ml-1">
            ({Math.round(confidence * 100)}%)
          </span>
        </div>
      </div>

      {/* Warning message for medium/low confidence */}
      {config.message && (
        <div className={cn(
          "flex items-start gap-2 p-2 rounded-lg text-xs",
          confidenceLevel === "low" ? "bg-destructive/10" : "bg-yellow-100"
        )}>
          <AlertCircle className={cn("w-4 h-4 shrink-0 mt-0.5", config.color)} />
          <span className={config.color}>{config.message}</span>
        </div>
      )}

      {/* Editable text area */}
      <Textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="Transcribed text will appear here..."
        className={cn(
          "min-h-[80px] text-base bg-background resize-none",
          "focus:ring-2 focus:ring-primary/20"
        )}
      />
      <p className="text-xs text-muted-foreground">
        You can edit the text above before searching.
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={onConfirm}
          disabled={!text.trim()}
          className="flex-1 min-w-[120px]"
        >
          <Check className="w-4 h-4 mr-2" />
          Use This Text
        </Button>
        <Button
          variant="outline"
          onClick={onRetry}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
