import * as React from "react"

import { cn } from "@/lib/utils"

interface CardProps extends React.ComponentProps<"div"> {
  /** Enable hover animation (desktop only) */
  hoverable?: boolean;
}

function Card({ className, hoverable = false, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        // Base card styles with improved spacing
        "bg-card text-card-foreground flex flex-col rounded-2xl border border-border shadow-sm",
        // Mobile-first padding (20-24px as per PRD)
        "p-5 md:p-6",
        // Gap between card children
        "gap-4 md:gap-5",
        // Hover animation for desktop only (as per PRD)
        hoverable && "card-hover cursor-pointer",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "flex flex-col space-y-1.5",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-lg font-semibold leading-tight tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground leading-relaxed", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center pt-2 -mx-5 -mb-5 md:-mx-6 md:-mb-6 px-5 md:px-6 py-4 bg-surface/50 rounded-b-2xl border-t border-border/50", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
