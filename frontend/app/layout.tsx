import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/ui/smooth-scroll-provider";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { PWARegistration } from "@/components/pwa-registration";

const APP_NAME = "Medora";
const APP_DESCRIPTION = "AI-assisted healthcare platform for Bangladesh";

const sfProDisplay = localFont({
  src: [
    { path: './fonts/SFPRODISPLAYULTRALIGHTITALIC.otf', weight: '200', style: 'italic' },
    { path: './fonts/SFPRODISPLAYTHINITALIC.otf', weight: '300', style: 'italic' },
    { path: './fonts/SFPRODISPLAYLIGHTITALIC.otf', weight: '400', style: 'italic' },
    { path: './fonts/SFPRODISPLAYREGULAR.otf', weight: '500', style: 'normal' },
    { path: './fonts/SFPRODISPLAYMEDIUM.otf', weight: '600', style: 'normal' },
    { path: './fonts/SFPRODISPLAYSEMIBOLDITALIC.otf', weight: '700', style: 'italic' },
    { path: './fonts/SFPRODISPLAYBOLD.otf', weight: '800', style: 'normal' },
    { path: './fonts/SFPRODISPLAYHEAVYITALIC.otf', weight: '900', style: 'italic' },
    { path: './fonts/SFPRODISPLAYBLACKITALIC.otf', weight: '900', style: 'italic' },
  ],
  variable: '--sf-pro-display'
});

export const viewport: Viewport = {
  themeColor: "#0360D9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <SmoothScrollProvider>
            {children}
          </SmoothScrollProvider>
        </ThemeProvider>
        <PWARegistration />
      </body>
    </html>
  );
}
