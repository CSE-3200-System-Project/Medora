import React from 'react'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="min-h-screen w-full pt-16 sm:pt-18 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {children}
      </div>
    </div>
  )
}
