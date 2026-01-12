import { type NextRequest, NextResponse } from 'next/server'

// Routes that require authentication
const protectedRoutes = [
  '/patient/home',
  '/patient/find-doctor',
  '/patient/profile',
  '/patient/doctor',
  '/patient/appointments',
  '/patient/appointment-success',
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
  '/auth',
]

// Routes that require specific roles
const patientOnlyRoutes = ['/patient/']
const doctorOnlyRoutes = ['/doctor/']

// Public routes accessible by anyone
const publicRoutes = [
  '/verification-success',
  '/verify-email',
  '/verify-pending',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Get auth cookies
  const sessionToken = request.cookies.get('session_token')?.value
  const userRole = request.cookies.get('user_role')?.value
  const onboardingCompleted = request.cookies.get('onboarding_completed')?.value
  const onboardingSkipped = request.cookies.get('onboarding_skipped')?.value
  const adminAccess = request.cookies.get('admin_access')?.value
  const verificationStatus = request.cookies.get('verification_status')?.value
  
  const isLoggedIn = !!sessionToken
  const isAdmin = adminAccess === 'true' || userRole === 'admin'
  
  // Check if current path is protected
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  const isPatientRoute = patientOnlyRoutes.some(route => pathname.startsWith(route))
  const isDoctorRoute = doctorOnlyRoutes.some(route => pathname.startsWith(route))
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  
  // Allow public routes for everyone
  if (isPublicRoute) {
    return NextResponse.next()
  }
  
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
  
  // STRICT: If user is logged in and tries to access auth routes, redirect to their home
  if (isLoggedIn && isAuthRoute && !isAdmin) {
    // Check onboarding first
    if (onboardingCompleted === 'false' && onboardingSkipped !== 'true') {
      const onboardingUrl = userRole === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'
      return NextResponse.redirect(new URL(onboardingUrl, request.url))
    }
    
    const redirectUrl = userRole === 'doctor' ? '/doctor/home' : '/patient/home'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }
  
  // STRICT: If user is not logged in and tries to access protected routes OR onboarding, redirect to login
  if (!isLoggedIn && (isProtectedRoute || isOnboardingRoute)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }
  
  // Role-based route protection (only if logged in)
  if (isLoggedIn && userRole) {
    // Check doctor verification status - doctors must be admin-verified to access doctor routes AND onboarding
    if (userRole === 'doctor' && verificationStatus !== 'verified') {
      // Allow access to verify-pending page only
      if (pathname !== '/verify-pending') {
        return NextResponse.redirect(new URL('/verify-pending', request.url))
      }
    }
    
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
  if (isLoggedIn && isProtectedRoute && onboardingCompleted === 'false' && onboardingSkipped !== 'true' && !isOnboardingRoute) {
    // For doctors, check verification status before redirecting to onboarding
    if (userRole === 'doctor' && verificationStatus !== 'verified') {
      return NextResponse.redirect(new URL('/verify-pending', request.url))
    }
    
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