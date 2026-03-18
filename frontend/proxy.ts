import { type NextRequest, NextResponse } from 'next/server'

// Routes only accessible when logged OUT
const authRoutes = [
  '/login',
  '/selection',
  '/patient/register',
  '/doctor/register',
  '/forgot-password',
  '/auth',
]

// Admin-only routes
const adminRoutes = ['/admin']

// Public routes accessible by anyone regardless of auth state
const publicRoutes = [
  '/verification-success',
  '/verify-email',
  '/verify-pending',
]

// Routes that do NOT require auth and are not auth- or admin-specific
const fullyPublicPaths = [
  '/_next',
  '/api',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/icons',
]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static/api assets
  if (fullyPublicPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Get auth cookies
  const sessionToken = request.cookies.get('session_token')?.value
  const userRole = request.cookies.get('user_role')?.value?.toLowerCase()
  const onboardingCompleted = request.cookies.get('onboarding_completed')?.value
  const onboardingSkipped = request.cookies.get('onboarding_skipped')?.value
  const adminAccess = request.cookies.get('admin_access')?.value
  const verificationStatus = request.cookies.get('verification_status')?.value

  const isLoggedIn = !!sessionToken
  const isAdmin = adminAccess === 'true' || userRole === 'admin'

  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route))
  const isOnboardingRoute = pathname.startsWith('/onboarding')
  const isPatientRoute = pathname.startsWith('/patient/')
  const isDoctorRoute = pathname.startsWith('/doctor/')
  const isRootPage = pathname === '/'
  const isSettingsRoute = pathname === '/settings'
  const isNotificationsRoute = pathname === '/notifications'

  // ──────── Public routes — always accessible ────────
  if (isPublicRoute) {
    return NextResponse.next()
  }

  // ──────── ADMIN ROUTES ────────
  if (isAdminRoute) {
    if (isAdmin) return NextResponse.next()
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ──────── AUTH ROUTES (login, register, etc.) — must be logged OUT ────────
  if (isAuthRoute) {
    if (!isLoggedIn) return NextResponse.next()

    // Logged in → redirect away from auth routes
    if (isAdmin) return NextResponse.redirect(new URL('/admin', request.url))

    // Check onboarding
    if (onboardingCompleted === 'false' && onboardingSkipped !== 'true') {
      const onboardingUrl = userRole === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'
      return NextResponse.redirect(new URL(onboardingUrl, request.url))
    }

    const home = userRole === 'doctor' ? '/doctor/home' : '/patient/home'
    return NextResponse.redirect(new URL(home, request.url))
  }

  // ──────── All remaining routes require authentication ────────
  if (!isLoggedIn) {
    // Allow root "/" for unauthenticated users (landing page)
    if (isRootPage) return NextResponse.next()

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ──────── DOCTOR VERIFICATION GATE ────────
  if (userRole === 'doctor' && verificationStatus !== 'verified') {
    if (pathname !== '/verify-pending') {
      return NextResponse.redirect(new URL('/verify-pending', request.url))
    }
    return NextResponse.next()
  }

  // ──────── ONBOARDING GATE ────────
  if (isOnboardingRoute) {
    // Already completed onboarding → send to home
    if (onboardingCompleted === 'true' || onboardingSkipped === 'true') {
      const home = userRole === 'doctor' ? '/doctor/home' : '/patient/home'
      return NextResponse.redirect(new URL(home, request.url))
    }
    return NextResponse.next()
  }

  // If onboarding not completed and not on onboarding route → redirect there
  if (onboardingCompleted === 'false' && onboardingSkipped !== 'true' && !isOnboardingRoute) {
    // Settings and notifications are accessible even without completed onboarding
    if (!isSettingsRoute && !isNotificationsRoute) {
      const onboardingUrl = userRole === 'doctor' ? '/onboarding/doctor' : '/onboarding/patient'
      return NextResponse.redirect(new URL(onboardingUrl, request.url))
    }
  }

  // ──────── ROLE-BASED ROUTE PROTECTION ────────
  // Patient trying to access /doctor/* routes
  if (userRole === 'patient' && isDoctorRoute) {
    return NextResponse.redirect(new URL('/patient/home', request.url))
  }

  // Doctor trying to access /patient/* routes (except /patient/doctor/ for viewing patient profiles as a doctor won't be used)
  if (userRole === 'doctor' && isPatientRoute) {
    return NextResponse.redirect(new URL('/doctor/home', request.url))
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
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}