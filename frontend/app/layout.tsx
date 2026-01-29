import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/ui/smooth-scroll-provider";

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

export const metadata: Metadata = {
  title: "Medora - Healthcare Platform",
  description: "AI-assisted healthcare platform for Bangladesh",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sfProDisplay.variable}>
      <body className="antialiased">
        <SmoothScrollProvider>
          {children}
        </SmoothScrollProvider>
      </body>
    </html>
  );
}
