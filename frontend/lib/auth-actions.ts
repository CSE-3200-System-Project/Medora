"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL;

export async function login(formData: FormData) {
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
      (await cookies()).set("session_token", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
      });
    }

    // Get user role to redirect appropriately
    const role = (data.user?.user_metadata?.role || "patient").toLowerCase();
    
    // Check verification and onboarding status
    try {
      const profileResponse = await fetch(`${BACKEND_URL}/auth/me`, {
         headers: { "Authorization": `Bearer ${data.session.access_token}` },
         cache: "no-store",
      });
      
      if (profileResponse.ok) {
          const profile = await profileResponse.json();
          const role = profile.role.toLowerCase();
          const cookieStore = await cookies();
          
          // Set role and onboarding status cookies for middleware
          cookieStore.set("user_role", role, { path: "/" });
          cookieStore.set("onboarding_completed", String(profile.onboarding_completed), { path: "/" });
          
          // Check email verification
          if (!data.user.email_confirmed_at) {
               redirect("/verify-email");
          }
          
          if (!profile.onboarding_completed) {
               redirect(`/onboarding/${role}`);
          }
          
          // Temporary: Redirect to onboarding even if completed because dashboard doesn't exist
          redirect(`/onboarding/${role}`);
          // redirect(`/${profile.role}/dashboard`);
      }
    } catch (e) {
      // If fetching profile fails, fallback to dashboard or onboarding
      // But we should probably let the error propagate or handle gracefully
      console.error("Profile check failed", e);
    }

    revalidatePath("/", "layout");
    redirect(`/onboarding/${role}`);
    // redirect(`/${role}/dashboard`);
    
  } catch (error) {
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
    
    return { success: true };
  } catch (error) {
    console.error("Complete onboarding error:", error);
    throw error;
  }
}

async function getAuthHeaders() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  
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
      throw new Error(errorData.detail || "Update failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Onboarding update error:", error);
    throw error;
  }
}

export async function signupPatient(formData: FormData) {
  const rawData = {
    first_name: formData.get("firstName") as string,
    last_name: formData.get("lastName") as string,
    email: formData.get("email") as string,
    phone: formData.get("phone") as string,  // ✅ ADD THIS
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
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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
    phone: formData.get("phone") as string,  // ✅ ADD THIS
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
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
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
    cookieStore.delete("user_role");
  } catch (error) {
    console.log(error);
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