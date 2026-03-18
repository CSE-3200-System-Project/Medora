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
          "bg-destructive text-primary-foreground hover:bg-destructive/90 active:bg-destructive/80 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/70",
        ghost:
          "hover:bg-accent hover:text-accent-foreground active:bg-accent/80 dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        medical: "bg-primary text-primary-foreground hover:bg-primary-muted active:bg-primary-muted/90 shadow-sm hover:shadow-md dark:text-foreground dark:bg-primary/90 dark:hover:bg-primary/75",
        transaction: "bg-success text-primary-foreground hover:bg-success-muted active:bg-success-muted/90 shadow-sm hover:shadow-md dark:text-foreground dark:bg-success/80 dark:hover:bg-success/70",
        emergency: "bg-destructive text-primary-foreground hover:bg-destructive-muted active:bg-destructive-muted/90 shadow-sm hover:shadow-md focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive dark:text-foreground dark:hover:bg-destructive/90",
      },
      size: {
        default: "h-10 sm:h-11 min-h-[44px] px-3 sm:px-4 py-2 has-[>svg]:px-2.5 has-[>svg]:sm:px-3 text-sm sm:text-sm",
        sm: "h-9 sm:h-10 min-h-[36px] rounded-md gap-1.5 px-2.5 sm:px-3 has-[>svg]:px-2 has-[>svg]:sm:px-2.5 text-sm",
        lg: "h-11 sm:h-12 min-h-[44px] rounded-md px-4 sm:px-6 has-[>svg]:px-3 has-[>svg]:sm:px-4 text-base",
        icon: "size-10 sm:size-11 min-w-[44px] min-h-[44px]",
        "icon-sm": "size-9 sm:size-10 min-w-[36px] min-h-[36px]",
        "icon-lg": "size-11 sm:size-12 min-w-[44px] min-h-[44px]",
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
