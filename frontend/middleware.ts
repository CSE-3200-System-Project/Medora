// filepath: c:\Code\System\Medora\frontend\middleware.ts
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Logic to check for auth cookie/token would go here
  // For now, we just pass the request through
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}