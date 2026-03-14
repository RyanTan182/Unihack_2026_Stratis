import { cn } from "@/lib/utils"
import { Progress } from "@/components/ui/progress"

interface RiskProgressProps {
  value: number
  className?: string
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  label?: string
}

/**
 * RiskProgress - Standardized progress bar for risk visualization
 * Uses gradient colors based on risk level
 */
export function RiskProgress({ value, className, size = "md", showLabel = false, label }: RiskProgressProps) {
  const getRiskColor = (score: number): string => {
    if (score >= 80) return "#ef4444" // Red
    if (score >= 60) return "#f97316" // Orange
    if (score >= 40) return "#eab308" // Yellow
    if (score >= 20) return "#22c55e" // Green
    return "#a1a1aa" // Muted gray
  }

  const sizeClasses = {
    sm: "h-1",
    md: "h-1.5",
    lg: "h-2",
  }

  const color = getRiskColor(value)

  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium text-foreground">{value}%</span>
        </div>
      )}
      <div className={cn("relative overflow-hidden rounded-full bg-muted", sizeClasses[size])}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${value}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}40`,
          }}
        />
      </div>
    </div>
  )
}

/**
 * RiskBar - Horizontal bar with label for risk display
 */
export function RiskBar({
  value,
  label,
  className,
}: {
  value: number
  label: string
  className?: string
}) {
  const getRiskColor = (score: number): string => {
    if (score >= 80) return "#ef4444"
    if (score >= 60) return "#f97316"
    if (score >= 40) return "#eab308"
    if (score >= 20) return "#22c55e"
    return "#a1a1aa"
  }

  const getTextColor = (score: number): string => {
    if (score >= 80) return "text-red-400"
    if (score >= 60) return "text-orange-400"
    if (score >= 40) return "text-yellow-400"
    if (score >= 20) return "text-emerald-400"
    return "text-zinc-400"
  }

  return (
    <div className={cn("rounded-lg bg-muted/20 p-2.5", className)}>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("font-medium", getTextColor(value))}>{value}%</span>
      </div>
      <Progress value={value} className="h-1.5" />
    </div>
  )
}
