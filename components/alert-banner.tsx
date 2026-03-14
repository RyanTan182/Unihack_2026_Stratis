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
import { cn, formatRisk } from "@/lib/utils"
import type { SupplyChainInsights, Recommendation } from "@/lib/supply-chain-analyzer"
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

  // Generate alerts from insights
  useEffect(() => {
    if (!insights) {
      setAlerts([])
      return
    }

    const generatedAlerts: AlertData[] = []

    // High risk components
    const criticalComponents = insights.highRiskComponents.filter(c => c.risk >= 70)
    if (criticalComponents.length > 0) {
      generatedAlerts.push({
        id: 'high-risk-components',
        type: 'high_risk',
        severity: 'critical',
        title: `${criticalComponents.length} High-Risk Component${criticalComponents.length > 1 ? 's' : ''} Detected`,
        description: `${criticalComponents[0].componentName} from ${criticalComponents[0].country} has ${formatRisk(criticalComponents[0].risk)}% risk`,
        action: 'View alternatives',
        relatedComponentId: criticalComponents[0].componentId,
      })
    }

    // Price spike
    const priceImpact = parseFloat(insights.priceImpact.estimated.replace('%', '').replace('+', ''))
    if (priceImpact > 10) {
      generatedAlerts.push({
        id: 'price-spike',
        type: 'price_spike',
        severity: 'warning',
        title: `Price Impact Alert: ${insights.priceImpact.estimated}`,
        description: `Multiple factors contributing to ${insights.priceImpact.estimated} price increase`,
        action: 'View details',
      })
    } else if (priceImpact > 5) {
      generatedAlerts.push({
        id: 'price-moderate',
        type: 'price_spike',
        severity: 'info',
        title: `Moderate Price Impact: ${insights.priceImpact.estimated}`,
        description: 'Monitor price factors that may affect your supply chain costs',
        action: 'View timeline',
      })
    }

    // Critical chokepoints
    const criticalChokepoints = insights.criticalChokepoints.filter(c => c.risk >= 70)
    if (criticalChokepoints.length > 0) {
      generatedAlerts.push({
        id: 'route-disruption',
        type: 'route_disruption',
        severity: 'warning',
        title: `Critical Chokepoint${criticalChokepoints.length > 1 ? 's' : ''}: ${criticalChokepoints[0].name}`,
        description: `${formatRisk(criticalChokepoints[0].risk)}% risk affecting ${criticalChokepoints[0].affectedComponents.length} components`,
        action: 'Find alternatives',
      })
    }

    // Critical recommendations
    const criticalRecs = insights.recommendations.filter(r => r.type === 'critical')
    if (criticalRecs.length > 0) {
      criticalRecs.forEach((rec, idx) => {
        generatedAlerts.push({
          id: `recommendation-${idx}`,
          type: 'critical_recommendation',
          severity: 'critical',
          title: rec.title,
          description: rec.description,
          action: rec.action,
          relatedComponentId: rec.componentId,
        })
      })
    }

    // Filter out dismissed alerts
    const activeAlerts = generatedAlerts.filter(a => !dismissedAlerts.has(a.id))
    setAlerts(activeAlerts)
  }, [insights, dismissedAlerts])

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
