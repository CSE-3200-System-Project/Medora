import {hasLocale} from "next-intl";
import {getRequestConfig} from "next-intl/server";

import {routing} from "@/i18n/routing";
import {mergeMessages, type MessageSchema} from "@/lib/i18n-utils";
import bnMessages from "@/messages/bn.json";
import enMessages from "@/messages/en.json";

const localeMessages: Record<string, MessageSchema> = {
  en: enMessages,
  bn: bnMessages,
};

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages:
      locale === "en"
        ? enMessages
        : mergeMessages(enMessages, localeMessages[locale] ?? {}),
  };
});
