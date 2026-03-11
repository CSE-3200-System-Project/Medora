"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ClearAdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Clear all cookies
    document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "onboarding_completed=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    
    // Redirect to home after clearing
    setTimeout(() => {
      router.replace("/");
    }, 500);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Clearing session...</h1>
        <p className="text-muted-foreground">Redirecting to home page...</p>
      </div>
    </div>
  );
}
