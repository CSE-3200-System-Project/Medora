"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock, CheckCircle, XCircle, Mail, Phone, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signout } from "@/lib/auth-actions";
import { withLocale } from "@/lib/locale-path";
import type { AppLocale } from "@/i18n/routing";
import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";

export function VerifyPendingClient() {
  const router = useRouter();
  const locale = useLocale() as AppLocale;
  const tCommon = useTranslations("common");
  const t = useTranslations("admin.verifyPending");
  const localeHref = React.useCallback((path: string) => withLocale(path, locale), [locale]);
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "verified" | "rejected">("pending");

  const checkVerificationStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/check-verification");
      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data.verification_status);

        if (data.verification_status === "verified") {
          setTimeout(() => {
            router.push(localeHref("/doctor/home"));
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Failed to check verification status:", error);
    }
  }, [localeHref, router]);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void checkVerificationStatus();
    }, 0);
    const interval = setInterval(() => {
      void checkVerificationStatus();
    }, 30000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkVerificationStatus]);

  const handleLogout = async () => {
    await signout();
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-background via-surface to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card/50 border-border/50 backdrop-blur">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="relative h-20 w-20">
              <Image src={medoraDarkLogo} alt={tCommon("appName")} fill className="object-contain dark:hidden" />
              <Image src={medoraLightLogo} alt={tCommon("appName")} fill className="hidden object-contain dark:block" />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
            {verificationStatus === "pending" && t("titles.pending")}
            {verificationStatus === "verified" && t("titles.verified")}
            {verificationStatus === "rejected" && t("titles.rejected")}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {verificationStatus === "pending" && (
            <>
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-yellow-500/20 flex items-center justify-center animate-pulse">
                  <Clock className="h-12 w-12 text-yellow-400" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-foreground">{t("pending.thankYou")}</h3>
                <p className="text-muted-foreground">{t("pending.underReview")}</p>
                <p className="text-muted-foreground text-sm">
                  {t("pending.verificationDescription")}
                  <span className="font-semibold text-primary"> {t("pending.timeRange")}</span>.
                </p>
              </div>

              <div className="bg-card/50 rounded-lg p-6 space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  {t("pending.nextTitle")}
                </h4>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>{t("pending.steps.verifyBmdc")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>{t("pending.steps.reviewDocs")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>{t("pending.steps.emailNotification")}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>{t("pending.steps.portalAccess")}</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-blue-400 mb-1">{t("pending.emailTitle")}</p>
                    <p>{t("pending.emailDescription")}</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-orange-400 mb-1">{t("pending.helpTitle")}</p>
                    <p>{t("pending.helpDescription")}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {verificationStatus === "verified" && (
            <>
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-green-400" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-foreground">{t("verified.congratulations")}</h3>
                <p className="text-muted-foreground">{t("verified.successMessage")}</p>
                <p className="text-muted-foreground text-sm">{t("verified.redirecting")}</p>
              </div>
            </>
          )}

          {verificationStatus === "rejected" && (
            <>
              <div className="flex justify-center">
                <div className="h-24 w-24 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="h-12 w-12 text-red-400" />
                </div>
              </div>

              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-foreground">{t("rejected.title")}</h3>
                <p className="text-muted-foreground">{t("rejected.message")}</p>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    {t("rejected.description")}
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleLogout} className="flex-1 border-border text-muted-foreground hover:bg-card/60">
              {t("actions.logout")}
            </Button>
            {verificationStatus === "pending" && (
              <Button onClick={checkVerificationStatus} className="flex-1 bg-primary hover:bg-primary-muted">
                {t("actions.refresh")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


