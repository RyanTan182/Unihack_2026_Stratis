"use client"

import { useState, useEffect } from "react"
import {
  AlertTriangle,
  AlertCircle,
  X,
  Clock,
  ChevronRight,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { AlertData } from "@/lib/alerts"

export type { AlertData } from "@/lib/alerts"

interface AlertBannerProps {
  alerts: AlertData[]
  onAlertClick?: (alert: AlertData) => void
  onDismiss?: (alertId: string) => void
  onRemindLater?: (alertId: string) => void
  className?: string
}

export function AlertBanner({
  alerts,
  onAlertClick,
  onDismiss,
  onRemindLater,
  className,
}: AlertBannerProps) {
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0)

  const handleDismiss = (alertId: string) => {
    onDismiss?.(alertId)
  }

  const handleRemindLater = (alertId: string) => {
    handleDismiss(alertId)
    onRemindLater?.(alertId)
  }

  const handleAlertClick = (alert: AlertData) => {
    onAlertClick?.(alert)
  }

  // Auto-cycle through alerts if multiple
  useEffect(() => {
    if (alerts.length <= 1) return

    const interval = setInterval(() => {
      setCurrentAlertIndex(prev => (prev + 1) % alerts.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [alerts.length])

  if (alerts.length === 0) return null

  const currentAlert = alerts[currentAlertIndex]
  const hasMultipleAlerts = alerts.length > 1

  const severityConfig = {
    critical: {
      bg: "bg-red-500/8",
      border: "border-red-500/25",
      text: "text-red-400",
      icon: AlertTriangle,
      badge: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    warning: {
      bg: "bg-amber-500/8",
      border: "border-amber-500/25",
      text: "text-amber-400",
      icon: AlertTriangle,
      badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
    info: {
      bg: "bg-blue-500/8",
      border: "border-blue-500/25",
      text: "text-blue-400",
      icon: AlertCircle,
      badge: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    },
  }

  const config = severityConfig[currentAlert.severity]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "animate-in slide-in-from-top-4 fade-in duration-300",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm",
          config.bg,
          config.border
        )}
      >
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
            config.bg,
            config.border
          )}
        >
          <Icon className={cn("h-4 w-4", config.text)} />
        </div>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-semibold truncate", config.text)}>
              {currentAlert.title}
            </span>
            <Badge
              variant="outline"
              className={cn(
                "h-5 shrink-0 border px-1.5 py-0 text-[10px]",
                config.badge
              )}
            >
              {currentAlert.severity === "critical" ? "Critical" : "Warning"}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {currentAlert.description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {currentAlert.action && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 text-xs gap-1.5 hover:bg-muted",
                config.text
              )}
              onClick={() => handleAlertClick(currentAlert)}
            >
              <Zap className="h-3 w-3" />
              {currentAlert.action}
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted"
            onClick={() => handleRemindLater(currentAlert.id)}
            title="Remind me later"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-muted"
            onClick={() => handleDismiss(currentAlert.id)}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>

        {hasMultipleAlerts && (
          <div className="ml-2 flex shrink-0 items-center gap-1.5 border-l border-border/50 pl-2">
            {alerts.map((_, idx) => (
              <button
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === currentAlertIndex
                    ? "w-4 bg-foreground/60"
                    : "w-1.5 bg-muted-foreground/30"
                )}
                onClick={() => setCurrentAlertIndex(idx)}
              />
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">
              {currentAlertIndex + 1}/{alerts.length}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
