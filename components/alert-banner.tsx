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

// Re-export AlertData from lib/alerts
export type { AlertData } from "@/lib/alerts"

interface AlertBannerProps {
  alerts: import("@/lib/alerts").AlertData[]
  onAlertClick?: (alert: import("@/lib/alerts").AlertData) => void
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
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set())
  const [currentAlertIndex, setCurrentAlertIndex] = useState(0)

  // Filter out dismissed alerts
  const activeAlerts = alerts.filter(a => !dismissedAlerts.has(a.id))

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]))
    onDismiss?.(alertId)
  }

  const handleRemindLater = (alertId: string) => {
    handleDismiss(alertId)
    onRemindLater?.(alertId)
  }

  const handleAlertClick = (alert: import("@/lib/alerts").AlertData) => {
    onAlertClick?.(alert)
  }

  // Auto-cycle through alerts if multiple
  useEffect(() => {
    if (activeAlerts.length <= 1) return

    const interval = setInterval(() => {
      setCurrentAlertIndex(prev => (prev + 1) % activeAlerts.length)
    }, 8000)

    return () => clearInterval(interval)
  }, [activeAlerts.length])

  // Reset index if it goes out of bounds (e.g., after dismissal)
  useEffect(() => {
    if (activeAlerts.length > 0 && currentAlertIndex >= activeAlerts.length) {
      setCurrentAlertIndex(0)
    }
  }, [activeAlerts.length, currentAlertIndex])

  if (activeAlerts.length === 0) return null

  // Ensure currentAlertIndex is within bounds
  const safeIndex = Math.min(currentAlertIndex, activeAlerts.length - 1)
  const currentAlert = activeAlerts[safeIndex]
  const hasMultipleAlerts = activeAlerts.length > 1

  const severityConfig = {
    critical: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
      icon: AlertTriangle,
      pulseColor: 'bg-red-500',
    },
    warning: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
      icon: AlertCircle,
      pulseColor: 'bg-yellow-500',
    },
    info: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
      icon: AlertCircle,
      pulseColor: 'bg-blue-500',
    },
  }

  const config = severityConfig[currentAlert.severity]
  const Icon = config.icon

  return (
    <div className={cn(
      "animate-in slide-in-from-top-4 fade-in duration-300",
      className
    )}>
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm",
        config.bg,
        config.border
      )}>
        {/* Alert Icon with Pulse */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-20",
            config.pulseColor
          )} />
          <div className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-full",
            config.bg
          )}>
            <Icon className={cn("h-4 w-4", config.text)} />
          </div>
        </div>

        {/* Alert Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-semibold truncate", config.text)}>
              {currentAlert.title}
            </span>
            {currentAlert.severity === 'critical' && (
              <Badge className="bg-red-500/20 text-red-400 border-0 text-[10px] py-0 flex-shrink-0">
                Critical
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {currentAlert.description}
          </p>
        </div>

        {/* Alert Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
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

        {/* Multiple Alerts Indicator */}
        {hasMultipleAlerts && (
          <div className="flex items-center gap-1 flex-shrink-0 ml-2 pl-2 border-l border-border/50">
            {activeAlerts.map((_, idx) => (
              <button
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === currentAlertIndex
                    ? cn("w-4", config.pulseColor.replace('bg-', 'bg-'))
                    : "w-1.5 bg-muted-foreground/30"
                )}
                onClick={() => setCurrentAlertIndex(idx)}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">
              {currentAlertIndex + 1}/{activeAlerts.length}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
