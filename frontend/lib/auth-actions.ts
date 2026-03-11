"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

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
      const errorData = await response.json();
      throw new Error(errorData.detail || "Login failed");
    }

    const data = await response.json();
    
    // Store the access token
    if (data.session?.access_token) {
      const cookieOptions: any = {
        httpOnly: false,  // Changed to false for accessibility
        secure: false,  // Changed to false for local development
        sameSite: "lax",
        path: "/",
      };
      
      // If remember me is checked, set maxAge to 7 days
      // Otherwise, cookie expires when browser closes (session cookie)
      if (rememberMe) {
        cookieOptions.maxAge = 60 * 60 * 24 * 7; // 7 days
      }
      
      (await cookies()).set("session_token", data.session.access_token, cookieOptions);
    }

    // Get profile info from login response
    const profile = data.profile;
    const role = (profile?.role || "patient").toLowerCase();
    const verificationStatus = (profile?.verification_status || "unverified").toLowerCase();
    const cookieStore = await cookies();
    
    // Set role and onboarding status cookies for middleware
    cookieStore.set("user_role", role, { path: "/" });
    cookieStore.set("onboarding_completed", String(profile?.onboarding_completed || false), { path: "/" });
    cookieStore.set("verification_status", verificationStatus, { path: "/" });
    
    // Check email verification FIRST
    if (!data.user.email_confirmed_at) {
      redirect("/verify-email");
    }
    
    // Doctors must be admin-verified before proceeding (check for pending, rejected, unverified, etc.)
    if (role === "doctor" && verificationStatus !== "verified") {
      redirect("/verify-pending");
    }
    
    // Check onboarding
    if (!profile?.onboarding_completed) {
      redirect(`/onboarding/${role}`);
    }
    
    // Redirect based on role
    if (role === "doctor") {
      redirect("/doctor/home");
    } else if (role === "patient") {
      redirect("/patient/home");
    } else if (role === "admin") {
      redirect("/admin/dashboard");
    } else {
      redirect("/");
    }
    
  } catch (error: any) {
    if (error.message === "NEXT_REDIRECT" || error.digest?.startsWith("NEXT_REDIRECT")) {
        throw error;
    }
    console.error(error);
    throw error;
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
    
    cookieStore.set("onboarding_completed", "true", { path: "/" });
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

export async function updatePatientOnboarding(data: any) {
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

export async function updateDoctorOnboarding(data: any) {
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
      } catch (parseError) {
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

export async function getAvailableSlots(profileId: string, date: string, location?: string) {
  try {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    const params = new URLSearchParams({ date });
    if (location) params.append('location', location);
    
    const response = await fetch(`${backendUrl}/doctor/${profileId}/slots?${params.toString()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to fetch available slots");
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
      cookieStore.set("session_token", data.session.access_token, {
        httpOnly: false,  // Changed to false for accessibility
        secure: false,  // Changed to false for local development  
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      cookieStore.set("onboarding_completed", "false", { path: "/" });
      cookieStore.set("user_role", "patient", { path: "/" });
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
      cookieStore.set("session_token", data.session.access_token, {
        httpOnly: false,  // Changed to false so client can access it
        secure: false,  // Changed to false for local development
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      cookieStore.set("onboarding_completed", "false", { path: "/" });
      cookieStore.set("user_role", "doctor", { path: "/" });
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
export async function updateDoctorProfile(data: any) {
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
  } catch (error: any) {
    console.error("Forgot password error:", error);
    throw error;
  }
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
