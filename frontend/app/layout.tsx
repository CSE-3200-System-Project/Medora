import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import { PWARegistration } from "@/components/pwa-registration";
import { MobileViewportFix } from "@/components/ui/mobile-viewport-fix";
import { AppI18nProvider } from "@/components/providers/app-i18n-provider";
import { loadNamespacedMessages } from "@/i18n/message-loader";
import { resolveServerLocale } from "@/i18n/locale";
import { CORE_I18N_NAMESPACES } from "@/i18n/config";

const APP_NAME = "Medora";
const APP_DESCRIPTION = "AI-assisted healthcare platform for Bangladesh";

const sfProDisplay = localFont({
  src: [
    { path: "./fonts/SFPRODISPLAYREGULAR.woff2", weight: "400", style: "normal" },
    { path: "./fonts/SFPRODISPLAYBOLD.woff2", weight: "700", style: "normal" },
  ],
  variable: "--sf-pro-display",
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  themeColor: "#0360D9",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: `${APP_NAME} - Healthcare Platform`,
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_NAME,
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-192x192.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const localeResolution = await resolveServerLocale();
  const initialMessages = await loadNamespacedMessages(localeResolution.locale, CORE_I18N_NAMESPACES);

  return (
    <html lang={localeResolution.locale} className={sfProDisplay.variable} suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body suppressHydrationWarning className="antialiased min-h-dvh w-full overflow-x-hidden safe-area-inset safe-area-bottom">
        <AppI18nProvider
          initialLocale={localeResolution.locale}
          initialLocaleSource={localeResolution.source}
          initialMessages={initialMessages}
          initialNamespaces={CORE_I18N_NAMESPACES}
        >
          <MobileViewportFix />
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <div className="min-h-dvh min-h-app w-full keyboard-safe-bottom">
              {children}
            </div>
            <ToastProvider />
          </ThemeProvider>
          <PWARegistration />
        </AppI18nProvider>
      </body>
    </html>
  );
}
