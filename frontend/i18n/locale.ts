import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  type AppLocale,
  isAppLocale,
} from "@/i18n/config";

export type LocaleResolutionSource = "cookie" | "localStorage" | "backend" | "default";

export type ServerLocaleResolution = {
  locale: AppLocale;
  source: Extract<LocaleResolutionSource, "cookie" | "default">;
};

export function parseLocale(value: unknown): AppLocale | null {
  if (!isAppLocale(value)) {
    return null;
  }
  return value;
}

export async function resolveServerLocale(): Promise<ServerLocaleResolution> {
  const cookieStore = await cookies();
  const cookieLocale = parseLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);

  if (cookieLocale) {
    return {
      locale: cookieLocale,
      source: "cookie",
    };
  }

  return {
    locale: DEFAULT_LOCALE,
    source: "default",
  };
}
