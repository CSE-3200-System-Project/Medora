// filepath: c:\Code\System\Medora\frontend\middleware.ts
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session_token')?.value
  const onboardingCompleted = request.cookies.get('onboarding_completed')?.value
  const userRole = request.cookies.get('user_role')?.value
  
  // Protected routes
  const protectedRoutes = ['/dashboard', '/onboarding']
  const isProtectedRoute = protectedRoutes.some(route => 
    request.nextUrl.pathname.startsWith(route)
  )

  // If trying to access protected route without token, redirect to login
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // If we have a token, enforce onboarding
  if (token && isProtectedRoute) {
    // If onboarding is NOT completed, and user is NOT on onboarding page, redirect to onboarding
    if (onboardingCompleted !== 'true' && !request.nextUrl.pathname.startsWith('/onboarding')) {
      const target = userRole ? `/onboarding/${userRole.toLowerCase()}` : '/login'; // Fallback to login if role missing
      return NextResponse.redirect(new URL(target, request.url))
    }

    // Allow access to onboarding pages even if completed (since dashboard doesn't exist yet)
    // if (onboardingCompleted === 'true' && request.nextUrl.pathname.startsWith('/onboarding')) {
    //   const target = userRole ? `/${userRole.toLowerCase()}/dashboard` : '/';
    //   return NextResponse.redirect(new URL(target, request.url))
    // }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}