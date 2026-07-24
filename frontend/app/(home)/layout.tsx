import React from 'react'
import { redirect } from 'next/navigation'
import { getCachedCurrentUser } from '@/lib/current-user'
import { CurrentUserProvider } from '@/lib/current-user-context'
import { ReminderNotificationService } from '@/components/ui/reminder-notification-service'

export const dynamic = 'force-dynamic'

export default async function HomeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Server-side authentication check
  let user = null;
  try {
    user = await getCachedCurrentUser();
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
  const clientUser = {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: roleValue.toLowerCase(),
    profile_photo_url: user.profile_photo_url,
  };
  
  return (
    <CurrentUserProvider user={clientUser}>
      <div className="min-h-dvh min-h-app w-full overflow-x-hidden">
        {isPatient ? <ReminderNotificationService /> : null}
        <div className="min-h-dvh min-h-app w-full">
          {children}
        </div>
      </div>
    </CurrentUserProvider>
  )
}
