"use client";

import React, { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Clock, CheckCircle, XCircle, Mail, Phone, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { signout } from "@/lib/auth-actions";
import medoraDarkLogo from "@/assets/images/Medora-Logo-Dark.png";
import medoraLightLogo from "@/assets/images/Medora-Logo-Light.png";

export function VerifyPendingClient() {
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<"pending" | "verified" | "rejected">("pending");

  const checkVerificationStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/check-verification");
      if (response.ok) {
        const data = await response.json();
        setVerificationStatus(data.verification_status);

        if (data.verification_status === "verified") {
          setTimeout(() => {
            router.push("/doctor/home");
          }, 2000);
        }
      }
    } catch (error) {
      console.error("Failed to check verification status:", error);
    }
  }, [router]);

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
    <div className="min-h-dvh min-h-app bg-linear-to-br from-background via-surface to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-card/50 border-border/50 backdrop-blur">
        <CardHeader className="text-center pb-6">
          <div className="flex justify-center mb-6">
            <div className="relative h-20 w-20">
              <Image src={medoraDarkLogo} alt="Medora" fill className="object-contain dark:hidden" />
              <Image src={medoraLightLogo} alt="Medora" fill className="hidden object-contain dark:block" />
            </div>
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">
            {verificationStatus === "pending" && "Account Verification Pending"}
            {verificationStatus === "verified" && "Account Verified!"}
            {verificationStatus === "rejected" && "Verification Rejected"}
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
                <h3 className="text-xl font-semibold text-foreground">Thank you for registering!</h3>
                <p className="text-muted-foreground">Your account is currently under review by our admin team.</p>
                <p className="text-muted-foreground text-sm">
                  We are verifying your BMDC registration and credentials. This process typically takes
                  <span className="font-semibold text-primary"> 24-48 hours</span>.
                </p>
              </div>

              <div className="bg-card/50 rounded-lg p-6 space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  What happens next?
                </h4>
                <ul className="space-y-3 text-muted-foreground text-sm">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>Our admin team will verify your BMDC registration number</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>We&apos;ll review your uploaded credentials and documents</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>You&apos;ll receive an email notification once verified</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
                    <span>After verification, you can access your doctor portal</span>
                  </li>
                </ul>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-blue-400 mb-1">Check your email</p>
                    <p>We&apos;ll send you updates about your verification status. Make sure to check your spam folder.</p>
                  </div>
                </div>
              </div>

              <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-orange-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold text-orange-400 mb-1">Need help?</p>
                    <p>If you haven&apos;t heard from us within 48 hours, please contact our support team.</p>
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
                <h3 className="text-xl font-semibold text-foreground">Congratulations!</h3>
                <p className="text-muted-foreground">Your account has been verified successfully.</p>
                <p className="text-muted-foreground text-sm">Redirecting you to your doctor portal...</p>
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
                <h3 className="text-xl font-semibold text-foreground">Verification Rejected</h3>
                <p className="text-muted-foreground">Unfortunately, we were unable to verify your credentials.</p>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    Please contact our support team for more information or to resubmit your application.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleLogout} className="flex-1 border-border text-muted-foreground hover:bg-card/60">
              Logout
            </Button>
            {verificationStatus === "pending" && (
              <Button onClick={checkVerificationStatus} className="flex-1 bg-primary hover:bg-primary-muted">
                Refresh Status
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


