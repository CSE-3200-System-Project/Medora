import React from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="app-background min-h-dvh min-h-app w-full overflow-x-hidden">
      {children}
    </div>
  )
}
