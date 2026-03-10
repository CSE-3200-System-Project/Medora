import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-actions'

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side authentication check — onboarding requires auth
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
}
