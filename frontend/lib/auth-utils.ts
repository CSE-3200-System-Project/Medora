"use client";

/**
 * Client-side authentication utilities
 * Used for handling logout and redirects in client components
 */

/**
 * Clears authentication cookies and redirects to login page
 * Use this when receiving 401 responses or when session is invalid
 */
export function handleUnauthorized() {
  // Clear auth cookies
  document.cookie = "session_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
  document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
  document.cookie = "onboarding_completed=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
  document.cookie = "verification_status=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
  document.cookie = "onboarding_skipped=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
  document.cookie = "admin_access=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";
  document.cookie = "remember_me=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT";

  // Notify app that we've logged out (components can listen and update UI)
  try {
    window.dispatchEvent(new Event("medora:logged_out"));
  } catch (e) {
    // ignore in non-browser environments
  }

  // Only redirect if we haven't already redirected and we're not already on the target page
  if (typeof window !== "undefined") {
    const alreadyRedirected = sessionStorage.getItem("medora:logged_out_redirected");
    const pathname = window.location.pathname;

    // Avoid redirect loops: don't redirect if we're already at '/' or '/login'
    if (!alreadyRedirected && pathname !== "/" && pathname !== "/login") {
      sessionStorage.setItem("medora:logged_out_redirected", "1");
      window.location.href = "/";
    }
  }
}

function isAbortLikeError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("aborted") || message.includes("aborterror");
  }

  return false;
}

/**
 * Makes an authenticated fetch request and automatically handles 401 errors
 * @param url - The URL to fetch
 * @param options - Fetch options (headers, method, body, etc.)
 * @returns Response or null if unauthorized
 */
export async function fetchWithAuth(url: string, options?: RequestInit): Promise<Response | null> {
  try {
    const response = await fetch(url, options);
    
    if (response.status === 401) {
      // Avoid repeatedly invoking the logout redirect when we've already redirected
      const alreadyRedirected = typeof window !== "undefined" && sessionStorage.getItem("medora:logged_out_redirected");
      if (!alreadyRedirected) {
        handleUnauthorized();
      }
      return null;
    }
    
    return response;
  } catch (error) {
    if (isAbortLikeError(error, options?.signal)) {
      return null;
    }

    console.error("Fetch error:", error);
    throw error;
  }
}
