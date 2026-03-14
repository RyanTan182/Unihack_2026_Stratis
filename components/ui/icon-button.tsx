import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const iconButtonVariants = cva(
  "inline-flex items-center justify-center rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        primary: "text-primary hover:bg-primary/10",
        ghost: "text-muted-foreground hover:bg-transparent hover:text-foreground",
        destructive: "text-muted-foreground hover:text-red-400 hover:bg-red-500/10",
        active: "text-primary bg-primary/10 hover:bg-primary/20",
      },
      size: {
        sm: "h-7 w-7",
        md: "h-8 w-8",
        lg: "h-10 w-10",
        xl: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof iconButtonVariants> {
  icon: React.ReactNode
  tooltip?: string
}

/**
 * IconButton - Accessible icon-only button with proper aria-label
 * REQUIRED: aria-label must be provided for accessibility
 */
export function IconButton({ className, variant, size, icon, tooltip, "aria-label": ariaLabel, ...props }: IconButtonProps) {
  return (
    <button
      className={cn(iconButtonVariants({ variant, size }), "cursor-pointer", className)}
      aria-label={ariaLabel || tooltip}
      title={tooltip}
      {...props}
    >
      {icon}
    </button>
  )
}

/**
 * IconToggleButton - Icon button with active/inactive state
 */
interface IconToggleButtonProps extends Omit<IconButtonProps, "variant"> {
  isActive: boolean
  activeVariant?: "primary" | "active"
  inactiveVariant?: "default" | "ghost"
}

export function IconToggleButton({
  isActive,
  activeVariant = "active",
  inactiveVariant = "default",
  className,
  ...props
}: IconToggleButtonProps) {
  return (
    <IconButton
      variant={isActive ? activeVariant : inactiveVariant}
      className={cn(isActive && "text-primary", className)}
      {...props}
    />
  )
}
