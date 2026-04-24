"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  "http://localhost:8000";

const SHORT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const REMEMBER_ME_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSessionCookieOptions(maxAgeSeconds?: number) {
  const isProduction = process.env.NODE_ENV === "production";
  const options: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge?: number;
  } = {
    // Kept false because some client-side fetch flows still read this token.
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  };

  if (typeof maxAgeSeconds === "number") {
    options.maxAge = maxAgeSeconds;
  }

  return options;
}

function getMetadataCookieOptions(maxAgeSeconds: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

function isNextRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybeRedirect = error as { message?: string; digest?: string };
  return (
    maybeRedirect.message === "NEXT_REDIRECT" ||
    (typeof maybeRedirect.digest === "string" && maybeRedirect.digest.startsWith("NEXT_REDIRECT"))
  );
}

export async function login(formData: FormData, rememberMe: boolean = false) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const response = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      let detail: unknown;
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          detail = errorData?.detail;
        } else {
          detail = await response.text();
        }
      } catch {
        detail = null;
      }

      const detailRecord =
        detail && typeof detail === "object" ? (detail as Record<string, unknown>) : null;
      const isBanned = detailRecord?.code === "ACCOUNT_BANNED";
      if (response.status === 403 && isBanned) {
        const cookieStore = await cookies();
        const blockedCookieOptions = getMetadataCookieOptions(SHORT_SESSION_MAX_AGE_SECONDS);
        cookieStore.set(
          "account_blocked_reason",
          String(detailRecord?.reason || "No reason provided"),
          blockedCookieOptions
        );
        cookieStore.set(
          "account_blocked_message",
          String(detailRecord?.message || "Account suspended"),
          blockedCookieOptions
        );
        cookieStore.delete("session_token");
        cookieStore.delete("user_role");
        cookieStore.delete("onboarding_completed");
        cookieStore.delete("verification_status");
        redirect("/account-blocked");
      }

      const message =
        typeof detail === "string"
          ? detail
          : typeof detailRecord?.message === "string"
            ? detailRecord.message
          : typeof detailRecord?.message === "string"
            ? detailRecord.message
            : null;

      return {
        success: false,
        error: message || "Login failed",
      } as const;
    }

    const data = await response.json();

    const sessionMaxAge = rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : SHORT_SESSION_MAX_AGE_SECONDS;

    // Store the access token
    if (data.session?.access_token) {
      (await cookies()).set("session_token", data.session.access_token, getSessionCookieOptions(sessionMaxAge));
    }

    // Get profile info from login response
    const profile = data.profile;
    const role = (profile?.role || "patient").toLowerCase();
    const verificationStatus = (profile?.verification_status || "unverified").toLowerCase();
    const cookieStore = await cookies();
    
    // Set role and onboarding status cookies for middleware
    const metadataCookieOptions = getMetadataCookieOptions(sessionMaxAge);
    cookieStore.set("user_role", role, metadataCookieOptions);
    cookieStore.set("onboarding_completed", String(profile?.onboarding_completed || false), metadataCookieOptions);
    cookieStore.set("verification_status", verificationStatus, metadataCookieOptions);
    cookieStore.set("remember_me", rememberMe ? "true" : "false", metadataCookieOptions);
    cookieStore.delete("account_blocked_reason");
    cookieStore.delete("account_blocked_message");
    
    // Check email verification FIRST
    if (!data.user.email_confirmed_at) {
      redirect("/verify-email");
    }
    
    // Doctors must be admin-verified before proceeding (check for pending, rejected, unverified, etc.)
    if (role === "doctor" && verificationStatus !== "verified") {
      redirect("/verify-pending");
    }
    
    // Redirect based on role. Doctors always land on home after login.
    if (role === "doctor") {
      redirect("/doctor/home");
    } else if (role === "patient" && !profile?.onboarding_completed) {
      redirect(`/onboarding/${role}`);
    } else if (role === "patient") {
      redirect("/patient/home");
    } else if (role === "admin") {
      redirect("/admin");
    } else {
      redirect("/");
    }
    
  } catch (error: unknown) {
    if (isNextRedirectError(error)) {
        throw error;
    }
    console.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Login failed. Please try again.",
    } as const;
  }
}

export async function completeOnboarding() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;
    
    if (!token) throw new Error("No session");

    const response = await fetch(`${BACKEND_URL}/profile/complete-onboarding`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to complete onboarding");
    }
    
    const rememberMe = cookieStore.get("remember_me")?.value === "true";
    const sessionMaxAge = rememberMe ? REMEMBER_ME_MAX_AGE_SECONDS : SHORT_SESSION_MAX_AGE_SECONDS;
    cookieStore.set("onboarding_completed", "true", getMetadataCookieOptions(sessionMaxAge));
    // Remove the skip flag when onboarding is truly completed
    cookieStore.delete("onboarding_skipped");
    
    return { success: true };
  } catch (error) {
    console.error("Complete onboarding error:", error);
    throw error;
  }
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  
  if (!token) {
    throw new Error("Authentication required. Please log in again.");
  }
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
  };
}

export async function updatePatientOnboarding(data: Record<string, unknown>) {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${BACKEND_URL}/profile/patient/onboarding`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = typeof errorData.detail === 'string' 
        ? errorData.detail 
        : JSON.stringify(errorData.detail);
      throw new Error(errorMessage || "Update failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Onboarding update error:", error);
    throw error;
  }
}

export async function updateDoctorOnboarding(data: Record<string, unknown>) {
  try {
    const headers = await getAuthHeaders();

    const response = await fetch(`${BACKEND_URL}/profile/doctor/onboarding`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Doctor onboarding update failed:", errorData);
      throw new Error(errorData.detail || "Update failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Onboarding update error:", error);
    throw error;
  }
}

export async function getPatientOnboardingData() {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${BACKEND_URL}/profile/patient/onboarding`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch patient onboarding data:", error);
    return null;
  }
}

export async function getDoctorOnboardingData() {
  try {
    const headers = await getAuthHeaders();
    
    const response = await fetch(`${BACKEND_URL}/profile/doctor/onboarding`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch doctor onboarding data:", error);
    return null;
  }
}
// ==================== DOCTOR PROFILE ACTIONS ====================

export async function getPublicDoctorProfile(profileId: string) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    const response = await fetch(`${backendUrl}/doctor/${profileId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch doctor profile";
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } else {
          const textError = await response.text();
          errorMessage = textError || errorMessage;
        }
      } catch {
        // If parsing fails, use default message
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Get doctor profile error:", error);
    throw error;
  }
}

export async function getAvailableSlots(profileId: string, date: string, locationId?: string) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    const params = new URLSearchParams({ date });
    if (locationId) params.append('location_id', locationId);
    
    const response = await fetch(`${backendUrl}/doctor/${profileId}/slots?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch available slots";
      try {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          if (typeof errorData?.detail === "string" && errorData.detail.trim()) {
            errorMessage = errorData.detail;
          }
        } else {
          const textError = await response.text();
          if (textError && textError.trim()) {
            errorMessage = textError;
          }
        }
      } catch {
        // Keep default message if response body parsing fails.
      }
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Get available slots error:", error);
    throw error;
  }
}
export async function signupPatient(formData: FormData) {
  const rawData = {
    first_name: formData.get("firstName") as string,
    last_name: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,  // ADD THIS
    password: formData.get("password") as string,
    date_of_birth: formData.get("dob") as string,
    gender: formData.get("gender") as string,
    blood_group: formData.get("bloodGroup") as string || null,
    allergies: null,
  };

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup/patient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Signup failed");
    }

    const data = await response.json();
    
    // Store session token
    if (data.session?.access_token) {
      const cookieStore = await cookies();
      const signupMaxAge = REMEMBER_ME_MAX_AGE_SECONDS;
      cookieStore.set("session_token", data.session.access_token, getSessionCookieOptions(signupMaxAge));
      const metadataCookieOptions = getMetadataCookieOptions(signupMaxAge);
      cookieStore.set("onboarding_completed", "false", metadataCookieOptions);
      cookieStore.set("user_role", "patient", metadataCookieOptions);
      cookieStore.set("remember_me", "true", metadataCookieOptions);
    }

    return { success: true, userId: data.user_id };
    
  } catch (error) {
    console.error("Signup Error:", error);
    throw error;
  }
}

export async function signupDoctor(formData: FormData) {
  const rawData = {
    first_name: formData.get("firstName") as string,
    last_name: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,  // ADD THIS
    password: formData.get("password") as string,
    bmdc_number: formData.get("bmdc") as string,
    bmdc_document: null, // Handle file upload separately
  };

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup/doctor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Signup failed");
    }

    const data = await response.json();
    
    // Store session token
    if (data.session?.access_token) {
      const cookieStore = await cookies();
      const signupMaxAge = REMEMBER_ME_MAX_AGE_SECONDS;
      cookieStore.set("session_token", data.session.access_token, getSessionCookieOptions(signupMaxAge));
      const metadataCookieOptions = getMetadataCookieOptions(signupMaxAge);
      cookieStore.set("onboarding_completed", "false", metadataCookieOptions);
      cookieStore.set("user_role", "doctor", metadataCookieOptions);
      cookieStore.set("remember_me", "true", metadataCookieOptions);
    }

    return { success: true, userId: data.user_id };
    
  } catch (error) {
    console.error("Signup Error:", error);
    throw error;
  }
}

export async function signout() {
  try {
    await fetch(`${BACKEND_URL}/auth/logout`, { method: "POST" });
    const cookieStore = await cookies();
    cookieStore.delete("session_token");
    cookieStore.delete("onboarding_completed");
    cookieStore.delete("onboarding_skipped");
    cookieStore.delete("user_role");
    cookieStore.delete("verification_status");
    cookieStore.delete("admin_access");
    cookieStore.delete("remember_me");
    cookieStore.delete("account_blocked_reason");
    cookieStore.delete("account_blocked_message");
  } catch (error) {
    console.error(error);
  }
  
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 403) {
        try {
          const errorData = await response.json();
          const detail = errorData?.detail;
          if (typeof detail === "object" && detail?.code === "ACCOUNT_BANNED") {
            const blockedCookieOptions = getMetadataCookieOptions(SHORT_SESSION_MAX_AGE_SECONDS);
            cookieStore.set("account_blocked_reason", String(detail?.reason || "No reason provided"), blockedCookieOptions);
            cookieStore.set("account_blocked_message", String(detail?.message || "Account suspended"), blockedCookieOptions);
          }
        } catch {
          // Ignore parse failures and fall through to null.
        }
      }
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(error);
    return null;
  }
}

// Get current doctor's own profile (authenticated)
export async function getDoctorProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await fetch(`${BACKEND_URL}/profile/doctor/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch doctor profile");
    }

    return await response.json();
  } catch (error) {
    console.error("Get doctor profile error:", error);
    throw error;
  }
}

// Update current doctor's profile
export async function updateDoctorProfile(data: Record<string, unknown>) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await fetch(`${BACKEND_URL}/profile/doctor/onboarding`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = typeof errorData.detail === 'string' 
        ? errorData.detail 
        : JSON.stringify(errorData.detail);
      throw new Error(errorMessage || "Update failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Update doctor profile error:", error);
    throw error;
  }
}

export async function forgotPassword(email: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/forgot-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to send reset email");
    }

    return { success: true, message: "Password reset link sent to your email" };
  } catch (error: unknown) {
    console.error("Forgot password error:", error);
    throw error;
  }
}

export async function resetPassword(accessToken: string, newPassword: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        new_password: newPassword,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to reset password");
    }

    return { success: true, message: "Password has been reset successfully" };
  } catch (error: unknown) {
    console.error("Reset password error:", error);
    throw error;
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await fetch(`${BACKEND_URL}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to change password");
    }

    return { success: true, message: "Password changed successfully" };
  } catch (error: unknown) {
    console.error("Change password error:", error);
    throw error;
  }
}

export async function updateDoctorLocationSchedule(input: {
  locationId: string;
  availableDays: string[];
  dayTimeSlots: Record<string, string[]>;
  appointmentDuration?: number;
}) {
  const token = (await cookies()).get("session_token")?.value;
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `${BACKEND_URL}/profile/doctor/location/${encodeURIComponent(input.locationId)}/schedule`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        available_days: input.availableDays,
        day_time_slots: input.dayTimeSlots,
        appointment_duration: input.appointmentDuration,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.detail || "Failed to update location schedule");
  }
  return response.json();
}

export async function updateDoctorSchedule(
  dayTimeSlots: Record<string, string[]>,
  appointmentDuration: number
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    const response = await fetch(`${BACKEND_URL}/profile/doctor/schedule`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        day_time_slots: dayTimeSlots,
        appointment_duration: appointmentDuration
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to update schedule");
    }

    return await response.json();
  } catch (error) {
    console.error("Update schedule error:", error);
    throw error;
  }
}
