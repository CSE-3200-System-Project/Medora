export type NotifyVariant = "info" | "success" | "error";

export type NotifyPayload = {
  title?: string;
  message: string;
  variant?: NotifyVariant;
  durationMs?: number;
};

export const MEDORA_TOAST_EVENT = "medora:toast";

function dispatchToast(payload: NotifyPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<NotifyPayload>(MEDORA_TOAST_EVENT, {
      detail: payload,
    }),
  );
}

export const toast = {
  info(message: string, options?: Omit<NotifyPayload, "message" | "variant">) {
    dispatchToast({ message, variant: "info", ...options });
  },
  success(message: string, options?: Omit<NotifyPayload, "message" | "variant">) {
    dispatchToast({ message, variant: "success", ...options });
  },
  error(message: string, options?: Omit<NotifyPayload, "message" | "variant">) {
    dispatchToast({ message, variant: "error", ...options });
  },
};

