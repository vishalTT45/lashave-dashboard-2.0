import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full px-3 py-1 type-caption font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        light: "",
        solid: "text-white",
      },
      color: {
        primary: "",
        success: "",
        error: "",
        warning: "",
        info: "",
        light: "",
        dark: "",
      },
    },
    compoundVariants: [
      { variant: "light", color: "primary", class: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400" },
      { variant: "light", color: "success", class: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500" },
      { variant: "light", color: "error", class: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500" },
      { variant: "light", color: "warning", class: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400" },
      { variant: "light", color: "info", class: "bg-blue-light-50 text-blue-light-500 dark:bg-blue-light-500/15 dark:text-blue-light-500" },
      { variant: "light", color: "light", class: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80" },
      { variant: "light", color: "dark", class: "bg-gray-500 text-white dark:bg-white/5 dark:text-white" },
      { variant: "solid", color: "primary", class: "bg-brand-500" },
      { variant: "solid", color: "success", class: "bg-success-500" },
      { variant: "solid", color: "error", class: "bg-error-500" },
      { variant: "solid", color: "warning", class: "bg-warning-500" },
      { variant: "solid", color: "info", class: "bg-blue-light-500" },
      { variant: "solid", color: "light", class: "bg-gray-400 dark:bg-white/5 dark:text-white/80" },
      { variant: "solid", color: "dark", class: "bg-gray-700" },
    ],
    defaultVariants: {
      variant: "light",
      color: "primary",
    },
  }
)

function Badge({
  className,
  variant,
  color,
  startIcon,
  endIcon,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    startIcon?: React.ReactNode
    endIcon?: React.ReactNode
  }) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      data-color={color}
      className={cn(badgeVariants({ variant, color }), className)}
      {...props}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </span>
  )
}

export { Badge, badgeVariants }
