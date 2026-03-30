"use client";

import React from "react";
import { createPortal } from "react-dom";
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
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    if (!isOpen || !isMounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMounted]);

  if (!isOpen || !isMounted) return null;

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

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label={title}
      />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl animate-in fade-in zoom-in-95 duration-200">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={cancelText}
        >
          <X className="h-5 w-5" />
        </button>

        <div className={cn("mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full", config.iconBg)}>
          <Icon className={cn("h-6 w-6", config.iconColor)} />
        </div>

        <div className="mb-6 text-center">
          <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={isLoading}>
            {cancelText}
          </Button>
          <Button onClick={onConfirm} className={cn("flex-1", config.buttonClass)} disabled={isLoading}>
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
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
