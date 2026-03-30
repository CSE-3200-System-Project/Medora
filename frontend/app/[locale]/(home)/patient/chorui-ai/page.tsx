import { Inter, Manrope } from "next/font/google";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ChoruiChat } from "@/components/ai/ChoruiChat";
import { AppBackground } from "@/components/ui/app-background";
import { Navbar } from "@/components/ui/navbar";
import { getCurrentUser } from "@/lib/auth-actions";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export default async function ChoruiAIPage() {
  const locale = (await getLocale()) as AppLocale;
  const t = await getTranslations("chorui");
  const localeHref = (path: string) => withLocale(path, locale);
  const user = await getCurrentUser();
  if (!user) {
    redirect(localeHref("/login"));
  }

  const roleValue = typeof user?.role === "string" ? user.role : user?.role?.value ?? "";
  if (roleValue.toLowerCase() !== "patient") {
    if (roleValue.toLowerCase() === "doctor") {
      redirect(localeHref("/doctor/home"));
    }
    if (roleValue.toLowerCase() === "admin") {
      redirect(localeHref("/admin"));
    }
    redirect(localeHref("/"));
  }

  const patientId =
    (typeof user?.id === "string" && user.id) ||
    (typeof user?.user_id === "string" && user.user_id) ||
    (typeof user?.profile_id === "string" && user.profile_id) ||
    "";

  return (
    <AppBackground className={`${manrope.variable} ${inter.variable}`}>
      <Navbar />
      <main className="mx-auto w-full max-w-7xl page-content pt-(--nav-content-offset)">
        <div className="mb-6 max-w-3xl">
          <p className="inline-flex items-center rounded-full border border-border/70 bg-card/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("patientTag")}
          </p>
        </div>
        <ChoruiChat roleContext="patient" defaultPatientId={patientId} />
      </main>
    </AppBackground>
  );
}
