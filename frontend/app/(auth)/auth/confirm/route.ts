import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const cookieStore = await cookies()
    
    // Create a temporary Supabase client just for this verification
    // We need to use the anon key and URL from env vars
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })
    
    if (!error) {
      // If verification is successful, we need to ensure our backend session is set
      // The supabase client above sets the supabase auth cookies, but our app uses 'session_token'
      // We can extract the session from supabase and set our cookie
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.access_token) {
        cookieStore.set("session_token", session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: "/",
        });

        // Fetch profile to decide redirect
        try {
          const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";
          const response = await fetch(`${backendUrl}/auth/me`, {
            headers: { "Authorization": `Bearer ${session.access_token}` }
          });
          
          if (response.ok) {
            const profile = await response.json();
            
            // If onboarding is not completed, go there
            if (!profile.onboarding_completed) {
              return NextResponse.redirect(new URL(`/onboarding/${profile.role}`, request.url));
            }
            
            // Otherwise go to dashboard
            return NextResponse.redirect(new URL(`/${profile.role}/dashboard`, request.url));
          }
        } catch (e) {
          console.error("Failed to fetch profile in confirm route", e);
        }
      }
      
      // Fallback if profile fetch fails
      return NextResponse.redirect(new URL('/login?verified=true', request.url))
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(new URL('/error?message=Verification Failed', request.url))
}