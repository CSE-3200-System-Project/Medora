"use client";

import * as React from "react";
import {Languages} from "lucide-react";
import {useLocale, useTranslations} from "next-intl";
import {usePathname, useRouter, useSearchParams} from "next/navigation";

import {Button} from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SUPPORTED_LOCALES = ["en", "bn"] as const;

type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

function replaceLocale(pathname: string, locale: SupportedLocale) {
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return `/${locale}`;
  }

  const [first, ...rest] = segments;
  if (SUPPORTED_LOCALES.includes(first as SupportedLocale)) {
    return `/${[locale, ...rest].join("/")}`;
  }

  return `/${[locale, ...segments].join("/")}`;
}

export function LanguageSwitcher({className}: {className?: string}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const switchLocale = React.useCallback(
    (nextLocale: SupportedLocale) => {
      if (!pathname || nextLocale === locale) {
        return;
      }

      const nextPathname = replaceLocale(pathname, nextLocale);
      const query = searchParams.toString();

      // Persist preference immediately so server-rendered shells (e.g. html lang) stay in sync.
      document.cookie = `NEXT_LOCALE=${nextLocale}; path=/; max-age=31536000`;

      router.replace(query ? `${nextPathname}?${query}` : nextPathname);
      router.refresh();
    },
    [locale, pathname, router, searchParams],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={className}
          aria-label={t("language")}
        >
          <Languages className="h-4 w-4" />
          <span className="text-sm font-semibold uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32">
        <DropdownMenuItem onSelect={() => switchLocale("en")}>{t("english")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => switchLocale("bn")}>{t("bangla")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
