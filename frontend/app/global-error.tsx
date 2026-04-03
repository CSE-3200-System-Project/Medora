"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

type AppError = Error & { digest?: string };

export default function GlobalError({
  error,
  reset,
}: {
  error: AppError;
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("Unhandled global app error", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-background text-foreground">
        <main className="mx-auto flex min-h-dvh max-w-3xl items-center justify-center px-4 py-10">
          <section className="w-full rounded-2xl border border-destructive/30 bg-card/95 p-6 shadow-surface sm:p-8">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-destructive/10 p-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="space-y-3">
                <h1 className="text-xl font-semibold">Application error</h1>
                <p className="text-sm text-muted-foreground">
                  A critical error occurred while rendering the app. Please retry or return to home.
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
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-muted"
                  >
                    Try again
                  </button>
                  <Link
                    href="/"
                    className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Go to home
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
