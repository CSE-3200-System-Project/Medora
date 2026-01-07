import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  
  // Optional: Call backend logout
  const token = cookieStore.get("session_token")?.value;
  if (token) {
      try {
          const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
          await fetch(`${backendUrl}/auth/logout`, { 
              method: "POST",
              headers: { "Authorization": `Bearer ${token}` }
          });
      } catch (e) {
          console.error("Logout failed", e);
      }
  }

  // Delete all auth-related cookies
  cookieStore.delete("session_token");
  cookieStore.delete("user_role");
  cookieStore.delete("onboarding_completed");
  
  return NextResponse.redirect(new URL("/login", request.url));
}

