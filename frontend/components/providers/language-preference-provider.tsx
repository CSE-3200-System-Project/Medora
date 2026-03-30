"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AppLocale } from "@/i18n/routing";
import { replaceLocaleInPathname, supportedLocales } from "@/lib/locale-path";

type LanguagePreferenceContextValue = {
  locale: AppLocale;
  setLocale: (nextLocale: AppLocale) => void;
};

const LanguagePreferenceContext = React.createContext<LanguagePreferenceContextValue | null>(null);

const LANGUAGE_STORAGE_KEY = "medora.locale";

function isSupportedLocale(locale: string): locale is AppLocale {
  return supportedLocales.includes(locale as AppLocale);
}

export function LanguagePreferenceProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [locale, setLocaleState] = React.useState<AppLocale>(initialLocale);

  React.useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  const setLocale = React.useCallback(
    (nextLocale: AppLocale) => {
      if (!pathname || nextLocale === locale) {
        return;
      }

      const nextPathname = replaceLocaleInPathname(pathname, nextLocale);
      const query = searchParams.toString();

      setLocaleState(nextLocale);
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale);

      router.replace(query ? `${nextPathname}?${query}` : nextPathname);
    },
    [locale, pathname, router, searchParams],
  );

  React.useEffect(() => {
    const storedLocale = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (!storedLocale || !isSupportedLocale(storedLocale) || storedLocale === locale || !pathname) {
      return;
    }

    const nextPathname = replaceLocaleInPathname(pathname, storedLocale);
    const query = searchParams.toString();
    router.replace(query ? `${nextPathname}?${query}` : nextPathname);
  }, [locale, pathname, router, searchParams]);

  const contextValue = React.useMemo(
    () => ({
      locale,
      setLocale,
    }),
    [locale, setLocale],
  );

  return (
    <LanguagePreferenceContext.Provider value={contextValue}>
      {children}
    </LanguagePreferenceContext.Provider>
  );
}

export function useLanguagePreference() {
  const context = React.useContext(LanguagePreferenceContext);

  if (!context) {
    throw new Error("useLanguagePreference must be used within LanguagePreferenceProvider");
  }

  return context;
}
