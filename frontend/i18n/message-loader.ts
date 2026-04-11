import type { AppLocale, I18nNamespace } from "@/i18n/config";
import { DEFAULT_LOCALE } from "@/i18n/config";

type NamespaceMessages = Record<string, unknown>;
type NamespacedMessages = Record<I18nNamespace, NamespaceMessages>;

type NamespaceLoader = () => Promise<NamespaceMessages>;

const MESSAGE_LOADERS: Record<AppLocale, Record<I18nNamespace, NamespaceLoader>> = {
  en: {
    common: async () => (await import("@/i18n/messages/en/common.json")).default as NamespaceMessages,
    nav: async () => (await import("@/i18n/messages/en/nav.json")).default as NamespaceMessages,
    auth: async () => (await import("@/i18n/messages/en/auth.json")).default as NamespaceMessages,
    settings: async () => (await import("@/i18n/messages/en/settings.json")).default as NamespaceMessages,
    notifications: async () => (await import("@/i18n/messages/en/notifications.json")).default as NamespaceMessages,
    errors: async () => (await import("@/i18n/messages/en/errors.json")).default as NamespaceMessages,
    chorui: async () => (await import("@/i18n/messages/en/chorui.json")).default as NamespaceMessages,
    voice: async () => (await import("@/i18n/messages/en/voice.json")).default as NamespaceMessages,
    consultation: async () => (await import("@/i18n/messages/en/consultation.json")).default as NamespaceMessages,
    prescription: async () => (await import("@/i18n/messages/en/prescription.json")).default as NamespaceMessages,
  },
  bn: {
    common: async () => (await import("@/i18n/messages/bn/common.json")).default as NamespaceMessages,
    nav: async () => (await import("@/i18n/messages/bn/nav.json")).default as NamespaceMessages,
    auth: async () => (await import("@/i18n/messages/bn/auth.json")).default as NamespaceMessages,
    settings: async () => (await import("@/i18n/messages/bn/settings.json")).default as NamespaceMessages,
    notifications: async () => (await import("@/i18n/messages/bn/notifications.json")).default as NamespaceMessages,
    errors: async () => (await import("@/i18n/messages/bn/errors.json")).default as NamespaceMessages,
    chorui: async () => (await import("@/i18n/messages/bn/chorui.json")).default as NamespaceMessages,
    voice: async () => (await import("@/i18n/messages/bn/voice.json")).default as NamespaceMessages,
    consultation: async () => (await import("@/i18n/messages/bn/consultation.json")).default as NamespaceMessages,
    prescription: async () => (await import("@/i18n/messages/bn/prescription.json")).default as NamespaceMessages,
  },
};

const namespaceCache = new Map<string, Promise<NamespaceMessages>>();

async function loadNamespace(locale: AppLocale, namespace: I18nNamespace): Promise<NamespaceMessages> {
  const cacheKey = `${locale}:${namespace}`;
  const cached = namespaceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const loader = MESSAGE_LOADERS[locale][namespace];
  const request = loader();
  namespaceCache.set(cacheKey, request);
  return request;
}

function mergeDeep(base: NamespaceMessages, override: NamespaceMessages): NamespaceMessages {
  const output: NamespaceMessages = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (
      value
      && typeof value === "object"
      && !Array.isArray(value)
      && base[key]
      && typeof base[key] === "object"
      && !Array.isArray(base[key])
    ) {
      output[key] = mergeDeep(base[key] as NamespaceMessages, value as NamespaceMessages);
      continue;
    }

    output[key] = value;
  }

  return output;
}

export async function loadNamespacedMessages(
  locale: AppLocale,
  namespaces: readonly I18nNamespace[]
): Promise<NamespacedMessages> {
  const uniqueNamespaces = Array.from(new Set(namespaces)) as I18nNamespace[];
  const messages = {} as NamespacedMessages;

  for (const namespace of uniqueNamespaces) {
    const english = await loadNamespace(DEFAULT_LOCALE, namespace);
    if (locale === DEFAULT_LOCALE) {
      messages[namespace] = english;
      continue;
    }

    const localized = await loadNamespace(locale, namespace);
    messages[namespace] = mergeDeep(english, localized);
  }

  return messages;
}
