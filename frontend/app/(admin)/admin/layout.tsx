import React from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="admin-theme min-h-screen w-full overflow-x-hidden">
      <div className="min-h-screen w-full pt-16 sm:pt-18 bg-gradient-to-br from-background via-surface to-background">
        {children}
      </div>
    </div>
  )
}

