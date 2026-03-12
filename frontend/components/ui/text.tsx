import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const textVariants = cva("", {
  variants: {
    variant: {
      default: "text-foreground",
      muted: "text-muted-foreground", 
      destructive: "text-destructive",
      success: "text-success",
      warning: "text-yellow-600",
      primary: "text-primary",
    },
    size: {
      xs: "text-xs",
      sm: "text-sm",
      base: "text-base",
      lg: "text-lg", 
      xl: "text-xl",
      "2xl": "text-2xl",
      "3xl": "text-3xl",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
      bold: "font-bold",
    },
    wrap: {
      normal: "", 
      break: "break-words",
      truncate: "truncate",
      "line-clamp-1": "line-clamp-1",
      "line-clamp-2": "line-clamp-2", 
      "line-clamp-3": "line-clamp-3",
      "line-clamp-4": "line-clamp-4",
    },
    align: {
      left: "text-left",
      center: "text-center", 
      right: "text-right",
      justify: "text-justify",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "base",
    weight: "normal",
    wrap: "normal", 
    align: "left",
  },
})

interface TextProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof textVariants> {
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
}

/**
 * Text - Consistent typography with responsive wrapping options
 * 
 * Usage:
 * <Text variant="muted" wrap="truncate">Long text that will be truncated</Text>
 * <Text as="h1" size="2xl" weight="bold">Heading</Text>
 * <Text wrap="line-clamp-2">Text that wraps to 2 lines max</Text>
 */
function Text({
  className,
  variant,
  size, 
  weight,
  wrap,
  align,
  as: Component = "span",
  ...props
}: TextProps) {
  return (
    <Component
      className={cn(textVariants({ variant, size, weight, wrap, align }), className)}
      {...props}
    />
  )
}

// Helper components for common patterns
function Heading({
  className,
  level = 1,
  size,
  children,
  ...props
}: {
  className?: string
  level?: 1 | 2 | 3 | 4 | 5 | 6
  size?: VariantProps<typeof textVariants>["size"]
  children: React.ReactNode
} & Omit<TextProps, "as" | "size">) {
  
  const defaultSizes = {
    1: "3xl",
    2: "2xl", 
    3: "xl",
    4: "lg",
    5: "base",
    6: "sm",
  } as const
  
  const headingSize = size || defaultSizes[level]
  
  return (
    <Text
      as={`h${level}` as any}
      size={headingSize}
      weight="bold"
      className={cn("tracking-tight", className)}
      {...props}
    >
      {children}
    </Text>
  )
}

function TruncatedText({ 
  children, 
  className,
  maxLines = 1,
  ...props 
}: { 
  children: React.ReactNode
  className?: string
  maxLines?: 1 | 2 | 3 | 4
  tooltip?: boolean
} & Omit<TextProps, "wrap">) {
  const wrapVariant = maxLines === 1 ? "truncate" : `line-clamp-${maxLines}` as const
  
  return (
    <Text
      wrap={wrapVariant}
      className={className}
      {...props}
    >
      {children}
    </Text>
  )
}

function BreakableText({
  children,
  className,
  ...props  
}: {
  children: React.ReactNode
  className?: string
} & Omit<TextProps, "wrap">) {
  return (
    <Text
      wrap="break"
      className={className}
      {...props}
    >
      {children}
    </Text>
  )
}

export { Text, Heading, TruncatedText, BreakableText, textVariants }