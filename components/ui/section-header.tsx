import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  description?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

/**
 * SectionHeader - Standardized section header
 * Use for: Card headers, panel sections, content groups
 */
export function SectionHeader({ title, description, icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            {icon}
          </div>
        )}
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  )
}

/**
 * SectionTitle - Simple section title with optional count
 */
export function SectionTitle({
  title,
  count,
  className,
}: {
  title: string
  count?: number
  className?: string
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <p className="text-xs font-medium text-foreground">{title}</p>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground">({count})</span>
      )}
    </div>
  )
}

/**
 * StatCard - Small stat display card
 */
export function StatCard({
  label,
  value,
  icon,
  className,
}: {
  label: string
  value: string | number
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-lg border border-border/50 bg-card/50 p-3", className)}>
      {icon && (
        <div className="flex items-center gap-2 mb-1">
          {icon}
          <span className="text-[10px] text-muted-foreground">{label}</span>
        </div>
      )}
      {!icon && (
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      )}
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

/**
 * InfoRow - Simple key-value display
 */
export function InfoRow({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex justify-between text-xs", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}
