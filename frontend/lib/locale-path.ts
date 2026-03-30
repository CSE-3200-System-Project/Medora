import type { AppLocale } from "@/i18n/routing";

export type { AppLocale } from "@/i18n/routing";

export const supportedLocales: AppLocale[] = ["en", "bn"];

export function stripLocaleFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (first && supportedLocales.includes(first as AppLocale)) {
    const rest = segments.slice(1);
    return rest.length ? `/${rest.join("/")}` : "/";
  }

  return pathname;
}

export function withLocale(pathname: string, locale: AppLocale) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return normalized === "/" ? `/${locale}` : `/${locale}${normalized}`;
}

export function replaceLocaleInPathname(pathname: string, locale: AppLocale) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `/${locale}`;
  }

  const [first, ...rest] = segments;
  if (first && supportedLocales.includes(first as AppLocale)) {
    return `/${[locale, ...rest].join("/")}`;
  }

  return `/${[locale, ...segments].join("/")}`;
}
