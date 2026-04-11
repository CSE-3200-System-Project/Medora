export const APP_LOCALES = ["en", "bn"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_COOKIE_KEY = "medora_ui_locale";
export const LOCALE_STORAGE_KEY = "medora.ui.locale";
export const SETTINGS_STORAGE_KEY = "medora.settings.v1";

export const I18N_NAMESPACES = [
  "common",
  "nav",
  "auth",
  "settings",
  "notifications",
  "errors",
  "chorui",
  "voice",
  "consultation",
  "prescription",
] as const;
export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export const PHASE_ONE_NAMESPACES = ["common", "nav", "auth", "settings"] as const;
export const CORE_I18N_NAMESPACES = ["common", "nav", "auth", "settings", "notifications", "errors", "chorui"] as const;

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && APP_LOCALES.includes(value as AppLocale);
}

export function getNamespacesForPath(pathname: string | null | undefined): I18nNamespace[] {
  const normalized = (pathname || "").toLowerCase();

  if (!normalized || normalized === "/") {
    return ["common", "nav"];
  }

  if (
    normalized.startsWith("/login") ||
    normalized.startsWith("/selection") ||
    normalized.startsWith("/patient/register") ||
    normalized.startsWith("/doctor/register") ||
    normalized.startsWith("/forgot-password") ||
    normalized.startsWith("/auth")
  ) {
    return ["common", "auth"];
  }

  if (normalized.startsWith("/settings")) {
    return ["common", "nav", "settings", "notifications", "errors"];
  }

  if (normalized.includes("/consultation")) {
    return ["common", "nav", "notifications", "errors", "consultation", "prescription"];
  }

  if (normalized.includes("/prescription/preview")) {
    return ["common", "nav", "notifications", "errors", "prescription"];
  }

  if (normalized.includes("/chorui-ai")) {
    return ["common", "nav", "notifications", "errors", "chorui"];
  }

  if (normalized.startsWith("/patient") || normalized.startsWith("/doctor") || normalized.startsWith("/notifications")) {
    return ["common", "nav", "notifications", "errors"];
  }

  return ["common"];
}
