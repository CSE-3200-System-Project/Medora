import React from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth-actions'
import { ReminderNotificationService } from '@/components/ui/reminder-notification-service'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side authentication check
  let user = null;
  try {
    user = await getCurrentUser();
  } catch (error) {
    console.error("Failed to resolve current user in home layout:", error);
    redirect("/logout?redirect=login");
  }
  
  // If no valid user, redirect to logout route which will clear cookies and redirect to login
  if (!user) {
    redirect('/logout?redirect=login')
  }

  const roleValue =
    typeof user?.role === "string"
      ? user.role
      : (user?.role?.value ?? "");
  const isPatient = roleValue.toLowerCase() === "patient";
  
  return (
    <div className="min-h-dvh min-h-app w-full overflow-x-hidden">
      {isPatient ? <ReminderNotificationService /> : null}
      <div className="min-h-dvh min-h-app w-full">
        {children}
      </div>
    </div>
  )
}
