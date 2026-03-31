import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/ui/smooth-scroll-provider";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ToastProvider } from "@/components/ui/toast-provider";
import { PWARegistration } from "@/components/pwa-registration";
import { MobileViewportFix } from "@/components/ui/mobile-viewport-fix";

const APP_NAME = "Medora";
const APP_DESCRIPTION = "AI-assisted healthcare platform for Bangladesh";

const sfProDisplay = localFont({
  src: [
    { path: "./fonts/SFPRODISPLAYREGULAR.otf", weight: "400", style: "normal" },
    { path: "./fonts/SFPRODISPLAYBOLD.otf", weight: "700", style: "normal" },
  ],
  variable: "--sf-pro-display",
  display: "swap",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sfProDisplay.variable} suppressHydrationWarning>
      <body className="antialiased min-h-dvh w-full overflow-x-hidden safe-area-inset safe-area-bottom">
        <MobileViewportFix />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider locale="en" messages={{}}>
            <SmoothScrollProvider>
              <div className="min-h-dvh min-h-app w-full keyboard-safe-bottom">
                {children}
              </div>
            </SmoothScrollProvider>
          </NextIntlClientProvider>
          <ToastProvider />
        </ThemeProvider>
        <PWARegistration />
      </body>
    </html>
  );
}
