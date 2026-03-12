"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { fetchWithAuth } from "@/lib/auth-utils";

export function AuthRedirectGate() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuthAndRedirect() {
      try {
        const response = await fetchWithAuth("/api/auth/me");
        if (!response?.ok) {
          return;
        }

        const user = await response.json();
        const role = user?.role?.toLowerCase();

        if (role === "admin") {
          router.push("/admin");
        } else if (role === "doctor") {
          router.push("/doctor/home");
        } else if (role === "patient") {
          router.push("/patient/home");
        }
      } catch {
        // Unauthenticated users stay on landing page.
      }
    }

    checkAuthAndRedirect();
  }, [router]);

  return null;
}
