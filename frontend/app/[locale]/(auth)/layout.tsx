import React from 'react'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-background">
      <div className="min-h-screen w-full flex flex-col">
        {children}
      </div>
    </div>
  )
}
