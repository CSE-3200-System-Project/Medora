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
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextType | null>(null)

export function Select({ value, onValueChange, children, disabled }: { value?: string | null; onValueChange?: (v: string) => void; children: React.ReactNode; disabled?: boolean }) {
  const [internal, setInternal] = React.useState<string | null>(value ?? null)
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (value !== undefined && value !== internal) {
      setInternal(value ?? null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const setValue = (v: string) => {
    if (disabled) return
    setInternal(v)
    onValueChange?.(v)
  }

  return (
    <SelectContext.Provider value={{ value: internal, setValue, onValueChange, open, setOpen, disabled }}>
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
      onClick={() => !ctx.disabled && ctx.setOpen(!ctx.open)}
      disabled={ctx.disabled}
      className={cn(
        // Mobile-first with proper touch target
        "flex h-11 min-h-[44px] w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2",
        "text-base md:text-sm",
        "transition-[color,box-shadow,border-color] duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)]",
        "focus:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        ctx.disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      {...props}
    >
      <div className="flex-1 text-left truncate">{children}</div>
      <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  )
})
SelectTrigger.displayName = "SelectTrigger"

export const SelectContent = ({ children }: { children: React.ReactNode }) => {
  const ctx = React.useContext(SelectContext)
  if (!ctx) return null
  if (!ctx.open) return null

  return (
    <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
      <div className="p-1">{children}</div>
    </div>
  )
}

export const SelectLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="px-3 py-2 text-sm font-semibold text-muted-foreground">{children}</div>
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
      className={cn(
        // Proper touch target for mobile
        "cursor-pointer rounded-lg px-3 py-2.5 min-h-[44px] flex items-center",
        "text-base md:text-sm text-popover-foreground",
        "transition-colors duration-150",
        "hover:bg-primary-more-light hover:text-primary",
        "active:bg-primary-light"
      )}
    >
      {children}
    </div>
  )
}

export const SelectSeparator = () => <div className="my-1 h-px bg-muted" />

export default Select

