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
  languageNotice?: string;
  onTextChange: (text: string) => void;
  onConfirm: () => void;
  onRetry: () => void;
  onCancel: () => void;
  className?: string;
}

const REVIEW_COPY = {
  detectedFromVoice: "Detected from voice",
  languageBangla: "Bangla",
  languageEnglish: "English",
  languageHindi: "Hindi",
  languageMixed: "Mixed",
  goodQuality: "Good quality",
  reviewNeeded: "Review needed",
  reviewMessage: "Please review and adjust this text before search.",
  lowConfidence: "Low confidence",
  lowConfidenceMessage: "Audio clarity was low. Edit the text or record again.",
  transcriptionPlaceholder: "Transcribed text",
  editableHint: "You can edit this text before searching.",
  useThisText: "Use This Text",
  tryAgain: "Try Again",
  cancel: "Cancel",
} as const;

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
  languageNotice,
  onTextChange,
  onConfirm,
  onRetry,
  onCancel,
  className
}: VoiceTranscriptionReviewProps) {
  // Map language codes to display names
  const getLanguageName = (code: string): string => {
    const languages: Record<string, string> = {
      bn: REVIEW_COPY.languageBangla,
      en: REVIEW_COPY.languageEnglish,
      hi: REVIEW_COPY.languageHindi,
      mixed: REVIEW_COPY.languageMixed,
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
          label: REVIEW_COPY.goodQuality,
          message: null
        };
      case "medium":
        return {
          icon: AlertTriangle,
          color: "text-amber-700 dark:text-amber-300",
          bgColor: "bg-amber-50/90 dark:bg-amber-500/10",
          borderColor: "border-amber-200 dark:border-amber-500/40",
          label: REVIEW_COPY.reviewNeeded,
          message: REVIEW_COPY.reviewMessage
        };
      case "low":
        return {
          icon: AlertCircle,
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
          label: REVIEW_COPY.lowConfidence,
          message: REVIEW_COPY.lowConfidenceMessage
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
      {languageNotice ? (
        <p className="text-[11px] text-muted-foreground">{languageNotice}</p>
      ) : null}

      {/* Header with badges */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{REVIEW_COPY.detectedFromVoice}</span>
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
          confidenceLevel === "low"
            ? "bg-destructive/10"
            : "bg-amber-100/80 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
        )}>
          <AlertCircle className={cn("w-4 h-4 shrink-0 mt-0.5", config.color)} />
          <span className={config.color}>{config.message}</span>
        </div>
      )}

      {/* Editable text area */}
      <Textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={REVIEW_COPY.transcriptionPlaceholder}
        className={cn(
          "min-h-[80px] text-base bg-background resize-none",
          "focus:ring-2 focus:ring-primary/20"
        )}
      />
      <p className="text-xs text-muted-foreground">
        {REVIEW_COPY.editableHint}
      </p>

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={onConfirm}
          disabled={!text.trim()}
          className="flex-1 min-w-[120px]"
        >
          <Check className="w-4 h-4 mr-2" />
          {REVIEW_COPY.useThisText}
        </Button>
        <Button
          variant="outline"
          onClick={onRetry}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {REVIEW_COPY.tryAgain}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          title={REVIEW_COPY.cancel}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
