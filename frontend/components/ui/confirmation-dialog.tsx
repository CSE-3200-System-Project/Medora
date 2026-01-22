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
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      buttonClass: "bg-red-600 hover:bg-red-700 text-white",
    },
    warning: {
      icon: AlertCircle,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      buttonClass: "bg-yellow-600 hover:bg-yellow-700 text-white",
    },
    info: {
      icon: Info,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
    },
    success: {
      icon: CheckCircle2,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      buttonClass: "bg-green-600 hover:bg-green-700 text-white",
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
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
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
  }, [state.resolve]);

  const handleCancel = React.useCallback(() => {
    state.resolve?.(false);
    setState({ isOpen: false, resolve: null });
  }, [state.resolve]);

  return {
    isOpen: state.isOpen,
    confirm,
    onConfirm: handleConfirm,
    onCancel: handleCancel,
  };
}
