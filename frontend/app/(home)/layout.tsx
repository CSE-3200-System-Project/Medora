import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-actions'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side authentication check
  const user = await getCurrentUser()
  
  // If no valid user, redirect to logout route which will clear cookies and redirect to login
  if (!user) {
    redirect('/logout?redirect=login')
  }
  
  return (
    <>
      {children}
    </>
  )
}
