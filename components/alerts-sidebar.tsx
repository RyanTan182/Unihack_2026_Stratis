"use client"

import { useState } from "react"
import {
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  X,
  MapPin,
  Package,
  ExternalLink,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type { AlertData, AlertByCountry } from "@/lib/alerts"
import { groupAlertsByCountry } from "@/lib/alerts"

interface AlertsSidebarProps {
  isOpen: boolean
  onClose: () => void
  alerts: AlertData[]
  countryRisks: Array<{
    id: string
    name: string
    overallRisk: number
  }>
  onDismiss?: (alertId: string) => void
  onViewAlternatives?: (alert: AlertData) => void
}

export function AlertsSidebar({
  isOpen,
  onClose,
  alerts,
  countryRisks,
  onDismiss,
  onViewAlternatives,
}: AlertsSidebarProps) {
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set())

  const groupedAlerts = groupAlertsByCountry(alerts, countryRisks)

  const toggleCountry = (countryId: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev)
      if (next.has(countryId)) {
        next.delete(countryId)
      } else {
        next.add(countryId)
      }
      return next
    })
  }

  const getSeverityConfig = (severity: AlertData['severity']) => {
    switch (severity) {
      case 'critical':
        return {
          bg: 'bg-red-500/10',
          border: 'border-red-500/30',
          text: 'text-red-400',
          icon: AlertTriangle,
        }
      case 'warning':
        return {
          bg: 'bg-yellow-500/10',
          border: 'border-yellow-500/30',
          text: 'text-yellow-400',
          icon: AlertCircle,
        }
      default:
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/30',
          text: 'text-blue-400',
          icon: AlertCircle,
        }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[400px] border-l border-sidebar-border bg-sidebar shadow-xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Risk Alerts</h2>
            <p className="text-[10px] text-muted-foreground">
              {alerts.length} active alert{alerts.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 h-[calc(100vh-140px)]">
        <div className="p-4 space-y-3">
          {groupedAlerts.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No active alerts</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                All supply chain risks are within acceptable thresholds
              </p>
            </div>
          ) : (
            groupedAlerts.map((group) => (
              <div
                key={group.countryId}
                className="rounded-xl border border-border/50 overflow-hidden"
              >
                {/* Country Header */}
                <button
                  onClick={() => toggleCountry(group.countryId)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="text-left">
                      <span className="text-sm font-medium">{group.countryName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            group.overallRisk >= 70
                              ? "border-red-500/50 text-red-400"
                              : group.overallRisk >= 40
                                ? "border-yellow-500/50 text-yellow-400"
                                : "border-emerald-500/50 text-emerald-400"
                          )}
                        >
                          {group.overallRisk}% risk
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {group.alerts.length} alert{group.alerts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedCountries.has(group.countryId) ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Content */}
                {expandedCountries.has(group.countryId) && (
                  <div className="border-t border-border/50 bg-muted/20 p-3 space-y-2">
                    {/* Affected Products */}
                    {group.affectedProducts.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Package className="h-3 w-3" />
                        <span>
                          {group.affectedProducts.length} product{group.affectedProducts.length !== 1 ? 's' : ''} affected
                        </span>
                      </div>
                    )}

                    {/* Individual Alerts */}
                    {group.alerts.map((alert) => {
                      const config = getSeverityConfig(alert.severity)
                      const Icon = config.icon

                      return (
                        <div
                          key={alert.id}
                          className={cn(
                            "rounded-lg border p-3",
                            config.bg,
                            config.border
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", config.text)} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">
                                {alert.title}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {alert.description}
                              </p>

                              {/* Components */}
                              {alert.components && alert.components.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {alert.components.slice(0, 3).map((comp) => (
                                    <div
                                      key={comp.componentId}
                                      className="flex items-center justify-between text-[10px] bg-muted/30 rounded px-2 py-1"
                                    >
                                      <span className="truncate">{comp.componentName}</span>
                                      <span className={cn(
                                        "font-medium ml-2",
                                        comp.risk >= 70 ? "text-red-400" : "text-yellow-400"
                                      )}>
                                        {comp.risk}%
                                      </span>
                                    </div>
                                  ))}
                                  {alert.components.length > 3 && (
                                    <p className="text-[10px] text-muted-foreground">
                                      +{alert.components.length - 3} more
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-2 mt-2">
                                {alert.action && onViewAlternatives && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 text-[10px] px-2", config.text)}
                                    onClick={() => onViewAlternatives(alert)}
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    {alert.action}
                                  </Button>
                                )}
                                {onDismiss && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] px-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => onDismiss(alert.id)}
                                  >
                                    Dismiss
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => setExpandedCountries(new Set(groupedAlerts.map(g => g.countryId)))}
          >
            Expand All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setExpandedCountries(new Set())}
          >
            Collapse All
          </Button>
        </div>
      </div>
    </div>
  )
}
