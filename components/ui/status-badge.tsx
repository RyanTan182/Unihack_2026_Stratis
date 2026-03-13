import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

/**
 * StatusBadge - Standardized badge component for status indicators
 * Use for: Risk levels, active/inactive states, labels, counts
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 font-medium transition-colors",
  {
    variants: {
      variant: {
        // Risk levels
        critical: "border border-red-500/50 text-red-400",
        high: "border border-orange-500/50 text-orange-400",
        medium: "border border-yellow-500/50 text-yellow-400",
        low: "border border-emerald-500/50 text-emerald-400",
        minimal: "border border-cyan-500/50 text-cyan-400",
        // Status
        active: "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
        inactive: "border border-border text-muted-foreground",
        enabled: "border border-emerald-500/50 text-emerald-400",
        disabled: "border border-border text-muted-foreground",
        // General
        default: "border border-border text-foreground",
        primary: "border border-primary/50 bg-primary/10 text-primary",
      },
      size: {
        sm: "px-1.5 py-0.5 text-[9px] rounded-full",
        md: "px-2 py-0.5 text-[10px] rounded-full",
        lg: "px-2.5 py-1 text-xs rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode
  children: React.ReactNode
}

export function StatusBadge({ className, variant, size, icon, children, ...props }: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {icon}
      {children}
    </span>
  )
}

/**
 * Get risk variant from score - utility function
 */
export function getRiskVariant(score: number): "critical" | "high" | "medium" | "low" | "minimal" {
  if (score >= 80) return "critical"
  if (score >= 60) return "high"
  if (score >= 40) return "medium"
  if (score >= 20) return "low"
  return "minimal"
}

/**
 * Get risk label from score - utility function
 */
export function getRiskLabel(score: number): string {
  if (score >= 80) return "Critical"
  if (score >= 60) return "High"
  if (score >= 40) return "Medium"
  if (score >= 20) return "Low"
  return "Minimal"
}
