import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Noto_Sans_Bengali } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/ui/smooth-scroll-provider";
import { ThemeProvider } from "@/components/ui/theme-provider";
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

const notoSansBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bn-sans",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value === "bn" ? "bn" : "en";

  return (
    <html
      lang={locale}
      className={`${sfProDisplay.variable} ${notoSansBengali.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased min-h-dvh w-full overflow-x-hidden safe-area-inset safe-area-bottom">
        <MobileViewportFix />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SmoothScrollProvider>
            <div className="min-h-dvh min-h-app w-full keyboard-safe-bottom">
              {children}
            </div>
          </SmoothScrollProvider>
        </ThemeProvider>
        <PWARegistration />
      </body>
    </html>
  );
}
