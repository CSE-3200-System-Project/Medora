import {
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
  type AppLocale,
  isAppLocale,
} from "@/i18n/config";

export type LocaleResolutionSource = "cookie" | "localStorage" | "backend" | "default";

function parseLocale(value: unknown): AppLocale | null {
  if (!isAppLocale(value)) {
    return null;
  }
  return value;
}

function tryReadStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function readLocaleFromLocalStorage(): AppLocale | null {
  const direct = parseLocale(tryReadStorage(LOCALE_STORAGE_KEY));
  if (direct) {
    return direct;
  }

  const rawSettings = tryReadStorage(SETTINGS_STORAGE_KEY);
  if (!rawSettings) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawSettings) as {
      healthcare?: {
        preferredLanguage?: string;
      };
    };
    return parseLocale(parsed?.healthcare?.preferredLanguage);
  } catch {
    return null;
  }
}

export function persistLocaleOnClient(locale: AppLocale): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Best effort only.
  }

  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings) as {
        healthcare?: {
          preferredLanguage?: string;
        };
      };
      const next = {
        ...parsed,
        healthcare: {
          ...(parsed?.healthcare || {}),
          preferredLanguage: locale,
        },
      };
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // Best effort only.
  }

  const oneYearInSeconds = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=${oneYearInSeconds}; samesite=lax`;
}

export async function resolveBackendLocalePlaceholder(): Promise<AppLocale | null> {
  // Phase 1 placeholder. Hook point for backend preferred language in later phases.
  return null;
}
