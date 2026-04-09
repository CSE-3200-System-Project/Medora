import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-actions'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (user) {
    const roleValue =
      typeof user.role === 'string'
        ? user.role
        : (user.role?.value ?? '')

    const role = roleValue.toLowerCase()

    if (role === 'admin') {
      redirect('/admin')
    }

    if (role === 'doctor') {
      redirect('/doctor/home')
    }

    if (role && !user.onboarding_completed) {
      redirect(`/onboarding/${role}`)
    }

    redirect('/patient/home')
  }

  return (
    <div className="min-h-dvh min-h-app w-full overflow-x-hidden bg-background">
      <div className="min-h-dvh min-h-app w-full flex flex-col">
        {children}
      </div>
    </div>
  )
}
