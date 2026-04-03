"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";

import { AppBackground } from "@/components/ui/app-background";
import { Button } from "@/components/ui/button";

type AppError = Error & { digest?: string };

export default function HomeSegmentError({
  error,
  reset,
}: {
  error: AppError;
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Unhandled home segment error", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <AppBackground className="container-padding">
      <main className="mx-auto flex min-h-dvh max-w-3xl items-center justify-center py-10">
        <section className="w-full rounded-2xl border border-destructive/30 bg-card/95 p-6 shadow-surface sm:p-8">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="space-y-3">
              <h1 className="text-xl font-semibold text-foreground">Couldn&apos;t load this screen</h1>
              <p className="text-sm text-muted-foreground">
                This page encountered an unexpected issue. Please try again.
              </p>
              {error.digest ? (
                <p className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-xs font-mono text-muted-foreground">
                  Reference ID: {error.digest}
                </p>
              ) : null}
              {process.env.NODE_ENV !== "production" && error.message ? (
                <p className="rounded-md border border-border/70 bg-background/70 px-3 py-2 text-xs text-foreground">
                  {error.message}
                </p>
              ) : null}
              <div className="pt-1">
                <Button onClick={() => reset()}>Retry screen</Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </AppBackground>
  );
}
