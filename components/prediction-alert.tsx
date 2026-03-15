// components/prediction-alert.tsx

"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AffectedCountry, RiskDirection } from "@/lib/mirofish/types"

interface PredictionAlertProps {
  prediction: AffectedCountry
  onClick?: () => void
}

function directionConfig(direction: RiskDirection) {
  switch (direction) {
    case "up":
      return {
        icon: TrendingUp,
        color: "text-red-400",
        bg: "bg-red-400/10",
        label: "Rising",
        pulse: "animate-pulse",
      }
    case "down":
      return {
        icon: TrendingDown,
        color: "text-green-400",
        bg: "bg-green-400/10",
        label: "Declining",
        pulse: "",
      }
    default:
      return {
        icon: Minus,
        color: "text-muted-foreground",
        bg: "bg-muted/30",
        label: "Stable",
        pulse: "",
      }
  }
}

export function PredictionAlert({ prediction, onClick }: PredictionAlertProps) {
  const config = directionConfig(prediction.direction)
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        "hover:bg-muted/50 cursor-pointer w-full",
        config.bg
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          prediction.direction === "up" ? "bg-red-400 animate-pulse" : "bg-muted-foreground"
        )}
      />
      <span className={cn("font-medium", config.color)}>Predicted</span>
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={cn("text-xs", config.color)}>
        {prediction.currentRisk}→{prediction.predictedRisk}
      </span>
    </button>
  )
}
