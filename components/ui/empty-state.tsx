import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
  className?: string
}

/**
 * EmptyState - Standardized empty state component
 * Use for: Empty lists, no data states, initial states
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-10 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/50">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          onClick={action.onClick}
          className="mt-4 gap-2 border-primary/30 text-primary hover:bg-primary/10 hover:text-primary"
        >
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  )
}

/**
 * EmptyStateCompact - Smaller empty state for inline use
 */
export function EmptyStateCompact({
  icon,
  title,
  className,
}: {
  icon: React.ReactNode
  title: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-6 text-center", className)}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/30">
        {icon}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{title}</p>
    </div>
  )
}
