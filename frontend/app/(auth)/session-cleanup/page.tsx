"use client";

import { useEffect } from "react";

import { clearSensitiveBrowserData } from "@/lib/clear-sensitive-browser-data";

export default function SessionCleanupPage() {
  useEffect(() => {
    void clearSensitiveBrowserData().finally(() => window.location.replace("/login"));
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        Clearing private session data…
      </p>
    </main>
  );
}
