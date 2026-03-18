"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'danger',
  isLoading = false,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const variantConfig = {
    danger: {
      icon: AlertTriangle,
      iconBg: "bg-destructive/15",
      iconColor: "text-destructive",
      buttonClass: "bg-destructive hover:bg-destructive/85 text-destructive-foreground",
    },
    warning: {
      icon: AlertCircle,
      iconBg: "bg-warning/15",
      iconColor: "text-warning",
      buttonClass: "bg-warning hover:bg-warning/85 text-warning-foreground",
    },
    info: {
      icon: Info,
      iconBg: "bg-primary/15",
      iconColor: "text-primary",
      buttonClass: "bg-primary hover:bg-primary/90 text-primary-foreground",
    },
    success: {
      icon: CheckCircle2,
      iconBg: "bg-success/15",
      iconColor: "text-success",
      buttonClass: "bg-success hover:bg-success/85 text-primary-foreground",
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-card text-card-foreground border border-border rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4", config.iconBg)}>
          <Icon className={cn("w-6 h-6", config.iconColor)} />
        </div>

        {/* Content */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className={cn("flex-1", config.buttonClass)}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook for easier usage
export function useConfirmation() {
  const [state, setState] = React.useState<{
    isOpen: boolean;
    resolve: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    resolve: null,
  });

  const confirm = React.useCallback(() => {
    return new Promise<boolean>((resolve) => {
      setState({ isOpen: true, resolve });
    });
  }, []);

  const handleConfirm = React.useCallback(() => {
    state.resolve?.(true);
    setState({ isOpen: false, resolve: null });
  }, [state]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState({ isOpen: false, resolve: null });
  }, [state]);

  return {
    isOpen: state.isOpen,
    confirm,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };
}
