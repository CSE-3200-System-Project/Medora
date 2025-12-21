// filepath: c:\Code\System\Medora\frontend\lib\auth-actions.ts
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
      throw new Error("Login failed");
    }

    const data = await response.json();
    
    // Store the access token in a cookie so Next.js middleware can read it later
    if (data.session?.access_token) {
       (await cookies()).set("session_token", data.session.access_token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === "production",
         maxAge: 60 * 60 * 24 * 7, // 1 week
         path: "/",
       });
    }

  } catch (error) {
    console.error(error);
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(formData: FormData) {
  const firstName = formData.get("first-name") as string;
  const lastName = formData.get("last-name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const response = await fetch(`${BACKEND_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        first_name: firstName,
        last_name: lastName,
      }),
    });

    if (!response.ok) {
      throw new Error("Signup failed");
    }
    
    // Handle successful signup (e.g., check email confirmation)

  } catch (error) {
    console.error(error);
    redirect("/error");
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signout() {
  try {
    await fetch(`${BACKEND_URL}/auth/logout`, { method: "POST" });
    (await cookies()).delete("session_token");
  } catch (error) {
    console.log(error);
  }
  redirect("/logout");
}

// Note: Google OAuth is more complex to migrate fully to backend 
// because it involves redirects. It is often easier to keep OAuth 
// initiation on the frontend or use a redirect URL that points to the backend.
export async function signInWithGoogle() {
  try {
    // Ask Backend for the Google URL
    const response = await fetch(`${process.env.BACKEND_URL}/auth/google/url`, {
      cache: 'no-store'
    });
    
    if (!response.ok) throw new Error("Failed to get auth url");
    
    const data = await response.json();
    
    // Redirect user to the URL provided by backend
    redirect(data.url);
  } catch (error) {
    console.error(error);
    redirect("/error");
  }
}

export async function signupPatient(formData: FormData) {
  const rawData = {
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    // Changed from age to date_of_birth to match backend model
    date_of_birth: formData.get("date_of_birth"), 
    gender: formData.get("gender"),
    blood_group: formData.get("blood_group") || null,
    allergies: formData.get("allergies") || null,
  };

  try {
    const response = await fetch(`${process.env.BACKEND_URL}/auth/signup/patient`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Signup failed");
    }
    
  } catch (error) {
    console.error("Signup Error:", error);
    redirect("/error?message=Patient Signup Failed");
  }

  redirect("/patient/login?registered=true");
}

export async function signupDoctor(formData: FormData) {
  const rawData = {
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    email: formData.get("email"),
    password: formData.get("password"),
    bmdc_number: formData.get("bmdc_number"),
    // Handle file upload logic if you are sending a URL, otherwise null
    bmdc_document: null 
  };

  try {
    const response = await fetch(`${process.env.BACKEND_URL}/auth/signup/doctor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rawData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Signup failed");
    }

  } catch (error) {
    console.error("Signup Error:", error);
    redirect("/error?message=Doctor Signup Failed");
  }

  redirect("/doctor/login?registered=true");
}