"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function VerificationSuccessClient() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const redirectTimer = setTimeout(() => {
      router.push("/login?verified=true");
    }, 5000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(redirectTimer);
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-6 h-20 w-20 bg-success/10 rounded-full flex items-center justify-center animate-in fade-in zoom-in duration-500">
            <CheckCircle2 className="h-12 w-12 text-success" strokeWidth={2.5} />
          </div>
          <CardTitle className="text-2xl md:text-3xl font-bold text-foreground">Email Verified Successfully!</CardTitle>
          <CardDescription className="text-base md:text-lg mt-2">Your email has been confirmed</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-sm md:text-base text-muted-foreground">
              Your email verification is complete. Please login to access your account and continue with your healthcare journey.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting you to login in <span className="font-semibold text-primary">{countdown}</span>{" "}
              {countdown === 1 ? "second" : "seconds"}...
            </p>
          </div>

          <div className="pt-4 space-y-3">
            <Link href="/login?verified=true" className="block">
              <Button className="w-full" variant="medical" size="lg">
                Continue to Login
              </Button>
            </Link>

            <p className="text-xs text-muted-foreground">You&apos;ll need to login to access your account</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
