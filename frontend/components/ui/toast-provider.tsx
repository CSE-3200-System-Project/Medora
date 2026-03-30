"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MEDORA_TOAST_EVENT, type NotifyPayload, toast } from "@/lib/notify";

type ToastItem = NotifyPayload & {
  id: string;
};

function inferAlertVariant(message: string): "info" | "success" | "error" {
  const content = message.toLowerCase();
  if (/(fail|error|invalid|unable|denied|required|missing)/.test(content)) {
    return "error";
  }
  if (/(success|saved|updated|completed|uploaded|verified|applied)/.test(content)) {
    return "success";
  }
  return "info";
}

export function ToastProvider() {
  const tNotifications = useTranslations("common.notifications");
  const [items, setItems] = React.useState<ToastItem[]>([]);

  React.useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<NotifyPayload>;
      const payload = customEvent.detail;

      if (!payload?.message?.trim()) {
        return;
      }

      const id = crypto.randomUUID();
      const duration = payload.durationMs ?? 4200;

      setItems((current) => [...current, { ...payload, id }]);

      window.setTimeout(() => {
        setItems((current) => current.filter((item) => item.id !== id));
      }, duration);
    };

    window.addEventListener(MEDORA_TOAST_EVENT, handleToast as EventListener);
    return () => {
      window.removeEventListener(MEDORA_TOAST_EVENT, handleToast as EventListener);
    };
  }, []);

  React.useEffect(() => {
    const nativeAlert = window.alert.bind(window);

    window.alert = (message?: unknown) => {
      const text = typeof message === "string" ? message : String(message ?? "");
      if (!text.trim()) {
        return;
      }
      const variant = inferAlertVariant(text);
      if (variant === "error") {
        toast.error(text);
        return;
      }
      if (variant === "success") {
        toast.success(text);
        return;
      }
      toast.info(text);
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-90 flex justify-end p-4 sm:p-6"
      style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <ToastCard
            key={item.id}
            item={item}
            dismissLabel={tNotifications("dismiss")}
            onDismiss={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
          />
        ))}
      </div>
    </div>
  );
}

function ToastCard({
  item,
  dismissLabel,
  onDismiss,
}: {
  item: ToastItem;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  const variant = item.variant ?? "info";
  const Icon = variant === "error" ? TriangleAlert : variant === "success" ? CheckCircle2 : Info;

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-xl border bg-card/95 p-3 shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-top-2",
        variant === "error" && "border-destructive/45",
        variant === "success" && "border-success/45",
        variant === "info" && "border-primary/30",
      )}
      role={variant === "error" ? "alert" : "status"}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 rounded-full p-1.5",
            variant === "error" && "bg-destructive/10 text-destructive",
            variant === "success" && "bg-success/15 text-success-muted",
            variant === "info" && "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          {item.title ? <p className="text-sm font-semibold text-foreground">{item.title}</p> : null}
          <p className="text-sm text-foreground/90">{item.message}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={dismissLabel}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

