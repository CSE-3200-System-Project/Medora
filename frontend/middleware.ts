import { type NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const protectedRoutes = [
  '/patient/home',
  '/patient/find-doctor',
  '/patient/profile',
  '/patient/doctor',
  '/doctor/home',
  '/doctor/profile',
  '/doctor/appointments',
  '/doctor/patients',
  '/doctor/settings',
  '/admin',
]

// Admin-only routes
const adminRoutes = ['/admin']

// Routes only accessible when logged out
const authRoutes = [
  '/login',
  '/selection',
  '/patient/register',
  '/doctor/register',
  '/forgot-password',
]

// Routes that require specific roles
const patientOnlyRoutes = ['/patient/']
const doctorOnlyRoutes = ['/doctor/']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get auth cookies
  const sessionToken = request.cookies.get('session_token')?.value
  const userRole = request.cookies.get('user_role')?.value
  const onboardingCompleted = request.cookies.get('onboarding_completed')?.value
  const adminAccess = request.cookies.get('admin_access')?.value
  
  const isLoggedIn = !!sessionToken
  const isAdmin = adminAccess === 'true' || userRole === 'admin'
  
  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  const isPatientRoute = patientOnlyRoutes.some(route => pathname.startsWith(route))
  const isDoctorRoute = doctorOnlyRoutes.some(route => pathname.startsWith(route))
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  
  // Allow admin access with admin cookie (no login required)
  if (isAdminRoute && isAdmin) {
    return NextResponse.next()
  }
  
  // Admin route protection - must be admin role or have admin access
  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // If admin tries to access auth routes, redirect to admin
  if (isAdmin && isAuthRoute) {
    return NextResponse.redirect(new URL('/admin', request.url))
  }
  
  // If user is logged in and tries to access auth routes, redirect to their home
  if (isLoggedIn && isAuthRoute && !isAdmin) {
    const redirectUrl = userRole === 'admin' ? '/admin' : (userRole === 'doctor' ? '/doctor/home' : '/patient/home')
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
  
  // If user is not logged in and tries to access protected routes, redirect to login
  if (!isLoggedIn && isProtectedRoute) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // Role-based route protection (only if logged in)
  if (isLoggedIn && userRole) {
    // Patient trying to access doctor routes (except viewing doctor profiles)
    if (userRole === 'patient' && isDoctorRoute && !pathname.startsWith('/patient/doctor/')) {
      return NextResponse.redirect(new URL('/patient/home', request.url))
    }
    
    // Doctor trying to access patient-only routes
    if (userRole === 'doctor' && isPatientRoute && !pathname.includes('/patient/doctor/')) {
      return NextResponse.redirect(new URL('/doctor/home', request.url))
    }
  }
  
  // Check onboarding completion for protected routes (not onboarding itself)
  if (isLoggedIn && isProtectedRoute && onboardingCompleted === 'false' && !isOnboardingRoute) {
    const onboardingUrl = userRole === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'
    return NextResponse.redirect(new URL(onboardingUrl, request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (svg, png, jpg, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}