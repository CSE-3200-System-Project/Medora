"use client";

import * as React from "react";
import { NextIntlClientProvider, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import {
  getNamespacesForPath,
  PHASE_ONE_NAMESPACES,
  type AppLocale,
  type I18nNamespace,
} from "@/i18n/config";
import { loadNamespacedMessages } from "@/i18n/message-loader";
import {
  persistLocaleOnClient,
  readLocaleFromLocalStorage,
  resolveBackendLocalePlaceholder,
  type LocaleResolutionSource,
} from "@/i18n/locale-client";

type AppI18nProviderProps = {
  children: React.ReactNode;
  initialLocale: AppLocale;
  initialLocaleSource: Extract<LocaleResolutionSource, "cookie" | "default">;
  initialMessages: Record<I18nNamespace, Record<string, unknown>>;
  initialNamespaces: readonly I18nNamespace[];
};

type SetLocaleOptions = {
  requiredNamespaces?: readonly I18nNamespace[];
};

type AppI18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale, options?: SetLocaleOptions) => Promise<void>;
  isLocaleSwitching: boolean;
  ensureNamespaces: (namespaces: readonly I18nNamespace[]) => Promise<void>;
  loadedNamespaces: readonly I18nNamespace[];
};

const AppI18nContext = React.createContext<AppI18nContextValue | null>(null);

function uniqueNamespaces(namespaces: readonly I18nNamespace[]): I18nNamespace[] {
  return Array.from(new Set(namespaces)) as I18nNamespace[];
}

export function AppI18nProvider({
  children,
  initialLocale,
  initialLocaleSource,
  initialMessages,
  initialNamespaces,
}: AppI18nProviderProps) {
  const pathname = usePathname();
  const [locale, setLocaleState] = React.useState<AppLocale>(initialLocale);
  const [messages, setMessages] = React.useState<Record<I18nNamespace, Record<string, unknown>>>(initialMessages);
  const [loadedNamespaces, setLoadedNamespaces] = React.useState<I18nNamespace[]>(
    uniqueNamespaces(initialNamespaces)
  );
  const [isLocaleSwitching, setIsLocaleSwitching] = React.useState(false);

  const loadedNamespacesRef = React.useRef<I18nNamespace[]>(loadedNamespaces);
  React.useEffect(() => {
    loadedNamespacesRef.current = loadedNamespaces;
  }, [loadedNamespaces]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = locale;
  }, [locale]);

  const ensureNamespaces = React.useCallback(
    async (namespaces: readonly I18nNamespace[]) => {
      const nextNamespaces = uniqueNamespaces([...loadedNamespacesRef.current, ...namespaces]);
      const hasChanges = nextNamespaces.length !== loadedNamespacesRef.current.length;
      if (!hasChanges) {
        return;
      }

      const nextMessages = await loadNamespacedMessages(locale, nextNamespaces);
      setMessages(nextMessages);
      setLoadedNamespaces(nextNamespaces);
    },
    [locale]
  );

  React.useEffect(() => {
    void ensureNamespaces(getNamespacesForPath(pathname));
  }, [ensureNamespaces, pathname]);

  const setLocale = React.useCallback(
    async (nextLocale: AppLocale, options?: SetLocaleOptions) => {
      const routeNamespaces = getNamespacesForPath(pathname);
      const requiredNamespaces = options?.requiredNamespaces ?? routeNamespaces;
      const namespacesToLoad = uniqueNamespaces([...loadedNamespacesRef.current, ...requiredNamespaces]);

      const localeChanged = nextLocale !== locale;
      const namespaceChanged = namespacesToLoad.length !== loadedNamespacesRef.current.length;

      if (!localeChanged && !namespaceChanged) {
        persistLocaleOnClient(nextLocale);
        return;
      }

      setIsLocaleSwitching(true);
      try {
        const nextMessages = await loadNamespacedMessages(nextLocale, namespacesToLoad);
        setMessages(nextMessages);
        setLoadedNamespaces(namespacesToLoad);
        setLocaleState(nextLocale);
        persistLocaleOnClient(nextLocale);
      } finally {
        setIsLocaleSwitching(false);
      }
    },
    [locale, pathname]
  );

  React.useEffect(() => {
    let canceled = false;

    async function reconcileLocale() {
      if (initialLocaleSource === "cookie") {
        return;
      }

      const localStorageLocale = readLocaleFromLocalStorage();
      if (localStorageLocale) {
        if (!canceled) {
          await setLocale(localStorageLocale, {
            requiredNamespaces: PHASE_ONE_NAMESPACES,
          });
        }
        return;
      }

      const backendLocale = await resolveBackendLocalePlaceholder();
      if (backendLocale && !canceled) {
        await setLocale(backendLocale, {
          requiredNamespaces: PHASE_ONE_NAMESPACES,
        });
      }
    }

    void reconcileLocale();

    return () => {
      canceled = true;
    };
  }, [initialLocaleSource, setLocale]);

  const contextValue = React.useMemo<AppI18nContextValue>(
    () => ({
      locale,
      setLocale,
      isLocaleSwitching,
      ensureNamespaces,
      loadedNamespaces,
    }),
    [ensureNamespaces, isLocaleSwitching, loadedNamespaces, locale, setLocale]
  );

  return (
    <AppI18nContext.Provider value={contextValue}>
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={(error) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[i18n] Message error:", error.message);
          }
        }}
        getMessageFallback={({ namespace, key }) => {
          if (namespace) {
            return `${namespace}.${key}`;
          }
          return key;
        }}
      >
        {children}
      </NextIntlClientProvider>
    </AppI18nContext.Provider>
  );
}

export function useAppI18n() {
  const context = React.useContext(AppI18nContext);
  if (!context) {
    throw new Error("useAppI18n must be used within AppI18nProvider");
  }
  return context;
}

export function useT(namespace: I18nNamespace) {
  const t = useTranslations(namespace);
  return React.useCallback(
    (key: string, values?: Record<string, string | number | Date>) => t(key, values),
    [t]
  );
}
