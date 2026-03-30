import { type NextRequest, NextResponse } from 'next/server'

const supportedLocales = ['en', 'bn'] as const
const defaultLocale = 'en'

function getPreferredLocale(request: NextRequest): (typeof supportedLocales)[number] {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value
  if (cookieLocale && supportedLocales.includes(cookieLocale as (typeof supportedLocales)[number])) {
    return cookieLocale as (typeof supportedLocales)[number]
  }

  const acceptLanguage = request.headers.get('accept-language')?.toLowerCase() ?? ''
  if (acceptLanguage.includes('bn')) {
    return 'bn'
  }

  return defaultLocale
}

function stripLocalePrefix(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const first = segments[0]

  if (first && supportedLocales.includes(first as (typeof supportedLocales)[number])) {
    return {
      locale: first as (typeof supportedLocales)[number],
      pathname: `/${segments.slice(1).join('/')}` || '/',
    }
  }

  return { locale: null, pathname }
}

function toLocalePath(pathname: string, locale: (typeof supportedLocales)[number]) {
  if (pathname === '/') {
    return `/${locale}`
  }
  return `/${locale}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
}

function localeRedirect(request: NextRequest, locale: (typeof supportedLocales)[number], pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = toLocalePath(pathname, locale)
  const response = NextResponse.redirect(url)
  response.cookies.set('NEXT_LOCALE', locale, { path: '/' })
  return response
}

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
  const localeInfo = stripLocalePrefix(pathname)

  if (!localeInfo.locale) {
    const preferred = getPreferredLocale(request)
    return localeRedirect(request, preferred, pathname)
  }

  const locale = localeInfo.locale
  const localizedPathname = localeInfo.pathname
  const onboardingMode = request.nextUrl.searchParams.get('mode')

  // Skip static/api assets
  if (fullyPublicPaths.some(p => localizedPathname.startsWith(p))) {
    const pass = NextResponse.next()
    pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
    return pass
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

  const isAuthRoute = authRoutes.some(route => localizedPathname.startsWith(route))
  const isAdminRoute = adminRoutes.some(route => localizedPathname.startsWith(route))
  const isPublicRoute = publicRoutes.some(route => localizedPathname.startsWith(route))
  const isOnboardingRoute = localizedPathname.startsWith('/onboarding')
  const isPatientRoute = localizedPathname.startsWith('/patient/')
  const isDoctorRoute = localizedPathname.startsWith('/doctor/')
  const isRootPage = localizedPathname === '/'
  const isSettingsRoute = localizedPathname === '/settings'
  const isNotificationsRoute = localizedPathname === '/notifications'
  const isOnboardingEditMode = onboardingMode === 'edit'

  // ──────── Public routes — always accessible ────────
  if (isPublicRoute) {
    const pass = NextResponse.next()
    pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
    return pass
  }

  // ──────── ADMIN ROUTES ────────
  if (isAdminRoute) {
    if (isAdmin) {
      const pass = NextResponse.next()
      pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
      return pass
    }
    return localeRedirect(request, locale, '/login')
  }

  // ──────── AUTH ROUTES (login, register, etc.) — must be logged OUT ────────
  if (isAuthRoute) {
    if (!isLoggedIn) {
      const pass = NextResponse.next()
      pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
      return pass
    }

    // Logged in → redirect away from auth routes
    if (isAdmin) return localeRedirect(request, locale, '/admin')

    // Only patients are hard-gated to onboarding from auth routes.
    if (userRole === 'patient' && onboardingCompleted === 'false' && onboardingSkipped !== 'true') {
      return localeRedirect(request, locale, '/onboarding/patient')
    }

    const home = userRole === 'doctor' ? '/doctor/home' : '/patient/home'
    return localeRedirect(request, locale, home)
  }

  // ──────── All remaining routes require authentication ────────
  if (!isLoggedIn) {
    // Allow root "/" for unauthenticated users (landing page)
    if (isRootPage) {
      const pass = NextResponse.next()
      pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
      return pass
    }

    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = toLocalePath('/login', locale)
    loginUrl.searchParams.set('redirect', localizedPathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.set('NEXT_LOCALE', locale, { path: '/' })
    return response
  }

  // ──────── DOCTOR VERIFICATION GATE ────────
  if (userRole === 'doctor' && verificationStatus !== 'verified') {
    if (localizedPathname !== '/verify-pending') {
      return localeRedirect(request, locale, '/verify-pending')
    }
    const pass = NextResponse.next()
    pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
    return pass
  }

  // Logged-in users should never remain on the public landing page.
  if (isRootPage) {
    if (isAdmin) return localeRedirect(request, locale, '/admin')

    const home = userRole === 'doctor' ? '/doctor/home' : '/patient/home'
    return localeRedirect(request, locale, home)
  }

  // ──────── ONBOARDING GATE ────────
  if (isOnboardingRoute) {
    // Already completed onboarding users can still open onboarding in explicit edit mode.
    if (!isOnboardingEditMode && (onboardingCompleted === 'true' || onboardingSkipped === 'true')) {
      const home = userRole === 'doctor' ? '/doctor/home' : '/patient/home'
      return localeRedirect(request, locale, home)
    }
    const pass = NextResponse.next()
    pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
    return pass
  }

  // If patient onboarding not completed and not on onboarding route → redirect there
  if (userRole === 'patient' && onboardingCompleted === 'false' && onboardingSkipped !== 'true' && !isOnboardingRoute) {
    // Settings and notifications are accessible even without completed onboarding
    if (!isSettingsRoute && !isNotificationsRoute) {
      return localeRedirect(request, locale, '/onboarding/patient')
    }
  }

  // ──────── ROLE-BASED ROUTE PROTECTION ────────
  // Patient trying to access /doctor/* routes
  if (userRole === 'patient' && isDoctorRoute) {
    return localeRedirect(request, locale, '/patient/home')
  }

  // Doctor trying to access /patient/* routes (except /patient/doctor/ for viewing patient profiles as a doctor won't be used)
  if (userRole === 'doctor' && isPatientRoute) {
    return localeRedirect(request, locale, '/doctor/home')
  }

  const pass = NextResponse.next()
  pass.cookies.set('NEXT_LOCALE', locale, { path: '/' })
  return pass
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