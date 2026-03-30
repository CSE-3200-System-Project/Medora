"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CheckCircle2, Clock, Home, User } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { AppBackground } from "@/components/ui/app-background";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";
import logo from "@/assets/images/logo.png";

type AppointmentData = {
  doctorName: string;
  date: string;
  time: string;
  location: string;
};

type AppointmentSuccessClientProps = {
  initialAppointmentData: AppointmentData | null;
};

export function AppointmentSuccessClient({ initialAppointmentData }: AppointmentSuccessClientProps) {
  const t = useTranslations("appointmentSuccessPage");
  const tCommon = useTranslations("common");
  const locale = useLocale() as AppLocale;
  const localeHref = (path: string) => withLocale(path, locale);
  const dateLocale = locale === "bn" ? "bn-BD" : "en-US";

  if (!initialAppointmentData) {
    return (
      <AppBackground>
        <div className="flex items-center justify-center h-screen px-4">
          <div className="text-center">
            <p className="text-muted-foreground">{t("loading")}</p>
          </div>
        </div>
      </AppBackground>
    );
  }

  return (
    <AppBackground className="animate-page-enter">
      <div className="flex items-center justify-center min-h-screen px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <div className="flex items-center justify-center gap-3 mb-8">
            <Image src={logo} alt={t("logoAlt")} width={64} height={64} className="w-10 h-10 sm:w-12 sm:h-12" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{tCommon("appName")}</h1>
          </div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.2 }}
            className="flex justify-center mb-6"
          >
            <div className="relative">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
                className="absolute inset-0 bg-success/20 rounded-full blur-xl"
              />
              <CheckCircle2 className="w-20 h-20 sm:w-24 sm:h-24 text-success relative z-10" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="text-center mb-8"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3">
              {t("titlePrefix")} <span className="text-success">{t("titleHighlight")}</span> {t("titleSuffix")}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground">{t("subtitle")}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.4 }}>
            <Card className="rounded-2xl shadow-lg border-border/50 overflow-hidden mb-6">
              <div className="bg-primary/5 border-b border-border px-4 sm:px-6 py-3">
                <h3 className="text-base sm:text-lg font-semibold text-foreground">{t("detailsTitle")}</h3>
              </div>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                  <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm text-muted-foreground">{t("doctor")}</p>
                    <p className="text-sm sm:text-base font-semibold text-foreground truncate">{initialAppointmentData.doctorName}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                    <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">{t("date")}</p>
                      <p className="text-sm sm:text-base font-semibold text-foreground">
                        {new Date(initialAppointmentData.date).toLocaleDateString(dateLocale, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                    <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm text-muted-foreground">{t("time")}</p>
                      <p className="text-sm sm:text-base font-semibold text-foreground">{initialAppointmentData.time}</p>
                    </div>
                  </div>
                </div>

                {initialAppointmentData.location !== t("locationNotSpecified") && (
                  <div className="pt-2">
                    <Badge variant="secondary" className="text-xs sm:text-sm">
                      {t("location")}: {initialAppointmentData.location}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4"
          >
            <Link href={localeHref("/patient/appointments")} className="flex-1">
              <Button variant="medical" size="lg" className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold">
                {t("viewAppointments")}
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
              </Button>
            </Link>
            <Link href={localeHref("/patient/home")} className="flex-1">
              <Button variant="outline" size="lg" className="w-full h-12 sm:h-14 text-sm sm:text-base font-semibold">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                {t("backToHome")}
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </AppBackground>
  );
}
