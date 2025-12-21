import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    try {
      // 1. Send the code to YOUR Backend (not Supabase directly)
      const response = await fetch(`${process.env.BACKEND_URL}/auth/google/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        throw new Error('Backend exchange failed')
      }

      const data = await response.json()

      // 2. Set the Session Cookie (Same as your login action)
      if (data.session?.access_token) {
        (await cookies()).set("session_token", data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 7, // 1 week
          path: "/",
        });
      }

      // 3. Redirect based on Profile Status
      if (data.status === 'incomplete') {
        return NextResponse.redirect(`${origin}/onboarding`)
      }

      return NextResponse.redirect(`${origin}/`)

    } catch (error) {
      console.error("Auth Error:", error)
      return NextResponse.redirect(`${origin}/error?message=Auth Failed`)
    }
  }

  return NextResponse.redirect(`${origin}/error?message=No Code Found`)
}