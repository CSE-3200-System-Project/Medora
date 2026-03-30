import {NextIntlClientProvider} from "next-intl";
import {hasLocale} from "next-intl";
import {getMessages, setRequestLocale} from "next-intl/server";
import {notFound} from "next/navigation";

import {routing} from "@/i18n/routing";
import { ToastProvider } from "@/components/ui/toast-provider";
import { LanguagePreferenceProvider } from "@/components/providers/language-preference-provider";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages({locale});

  if (process.env.NODE_ENV !== "production") {
    console.log("[i18n] Active locale:", locale);
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguagePreferenceProvider initialLocale={locale}>
        {children}
        <ToastProvider />
      </LanguagePreferenceProvider>
    </NextIntlClientProvider>
  );
}
