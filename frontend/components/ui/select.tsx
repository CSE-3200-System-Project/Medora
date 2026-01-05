"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"

import { cn } from "@/lib/utils"

// Lightweight, dependency-free Select replacement (used where full Radix is not installed)

type SelectContextType = {
  value: string | null
  setValue: (v: string) => void
  onValueChange?: (v: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = React.createContext<SelectContextType | null>(null)

export function Select({ value, onValueChange, children }: { value?: string | null; onValueChange?: (v: string) => void; children: React.ReactNode }) {
  const [internal, setInternal] = React.useState<string | null>(value ?? null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (value !== undefined && value !== internal) {
      setInternal(value ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const setValue = (v: string) => {
    setInternal(v)
    onValueChange?.(v)
  }

  return (
    <SelectContext.Provider value={{ value: internal, setValue, onValueChange, open, setOpen }}>
      <div className="relative">{children}</div>
    </SelectContext.Provider>
  )
}

export const SelectGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null
  return <span className={cn("truncate text-sm", !ctx.value ? "text-muted-foreground" : "text-foreground")}>{ctx.value ?? placeholder}</span>
}

export const SelectTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(({ className, children, ...props }, ref) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none", className)}
      {...props}
    >
      <div className="flex-1 text-left">{children}</div>
      <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

export const SelectContent = ({ children }: { children: React.ReactNode }) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null
  if (!ctx.open) return null

  return (
    <div className="absolute z-50 mt-2 w-full rounded-md border border-border bg-popover shadow-md">
      <div className="p-1">{children}</div>
    </div>
  )
}

export const SelectLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-2 py-1 text-sm font-semibold text-muted-foreground">{children}</div>
)

export const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null

  const handleClick = () => {
    ctx.setValue(value)
    ctx.setOpen(false)
  }

  return (
    <div
      role="button"
      onClick={handleClick}
      className={cn("cursor-pointer rounded-md px-3 py-1 text-sm text-popover-foreground hover:bg-primary-more-light hover:text-primary")}
    >
      {children}
    </div>
  )
}

export const SelectSeparator = () => <div className="my-1 h-px bg-muted" />

export default Select

