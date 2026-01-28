import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-[var(--motion-duration-fast)] ease-[var(--motion-ease-standard)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        medical: "bg-primary text-white hover:bg-primary-muted active:bg-primary-muted/90 shadow-sm hover:shadow-md",
        transaction: "bg-success text-white hover:bg-success-muted active:bg-success-muted/90 shadow-sm hover:shadow-md",
        emergency: "bg-destructive text-white hover:bg-destructive-muted active:bg-destructive-muted/90 shadow-sm hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
      },
      size: {
        default: "h-10 min-h-[44px] px-4 py-2 has-[>svg]:px-3",
        sm: "h-9 min-h-[36px] rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 min-h-[48px] rounded-md px-6 has-[>svg]:px-4 text-base",
        icon: "size-10 min-w-[44px] min-h-[44px]",
        "icon-sm": "size-9 min-w-[36px] min-h-[36px]",
        "icon-lg": "size-12 min-w-[48px] min-h-[48px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
