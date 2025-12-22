// filepath: c:\Code\System\Medora\frontend\middleware.ts
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value
  
  // Protected routes
  const protectedRoutes = ['/dashboard', '/onboarding']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // If trying to access protected route without token, redirect to login
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If we have a token, we might want to check verification status
  // But since we can't easily make API calls in middleware without edge compatibility issues,
  // we'll rely on the client-side/server-action checks we added in login/auth-actions
  // or we could decode the JWT if we had the secret here.
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}