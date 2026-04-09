export type AppLocale = "en" | "bn";

export function withLocale(path: string, locale: AppLocale): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath.startsWith("/en/") || normalizedPath === "/en") {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("/bn/") || normalizedPath === "/bn") {
    return normalizedPath;
  }

  return `/${locale}${normalizedPath}`;
}
