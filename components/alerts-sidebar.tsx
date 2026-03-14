"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Globe,
  ChevronDown,
  ChevronRight,
  Package,
  Zap,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { AlertData } from "@/lib/alerts"
import { groupAlertsByCountry, type AlertByCountry } from "@/lib/alerts"

interface AlertsSidebarProps {
  alerts: AlertData[]
  onAlertClick?: (alert: AlertData) => void
  onDismiss?: (alertId: string) => void
}

const severityConfig = {
  critical: {
    accent: "text-red-400",
    bg: "bg-red-500/8",
    border: "border-red-500/25",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    icon: AlertTriangle,
  },
  warning: {
    accent: "text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/25",
    badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    icon: AlertTriangle,
  },
}

export function AlertsSidebar({
  alerts,
  onAlertClick,
  onDismiss,
}: AlertsSidebarProps) {
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set())
  const grouped = groupAlertsByCountry(alerts)

  const toggleCountry = (country: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev)
      if (next.has(country)) next.delete(country)
      else next.add(country)
      return next
    })
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-3">
        <h2 className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Risk Alerts
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {alerts.length === 0
            ? "No active alerts"
            : `${grouped.length} high-risk countr${grouped.length === 1 ? "y" : "ies"}`}
        </p>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted/50 p-4">
                <Globe className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="mt-4 text-sm font-medium text-muted-foreground">
                No alerts
              </p>
              <p className="mt-1 max-w-[200px] text-xs leading-relaxed text-muted-foreground/70">
                Add products to analyze and see supply chain risk alerts here
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <CountryAlertCard
                key={group.country}
                group={group}
                isExpanded={expandedCountries.has(group.country)}
                onToggle={() => toggleCountry(group.country)}
                onAlertClick={onAlertClick}
                onDismiss={onDismiss}
                severityConfig={severityConfig}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface CountryAlertCardProps {
  group: AlertByCountry
  isExpanded: boolean
  onToggle: () => void
  onAlertClick?: (alert: AlertData) => void
  onDismiss?: (alertId: string) => void
  severityConfig: typeof severityConfig
}

function CountryAlertCard({
  group,
  isExpanded,
  onToggle,
  onAlertClick,
  onDismiss,
  severityConfig,
}: CountryAlertCardProps) {
  const config = severityConfig[group.severity]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border transition-all",
        config.bg,
        config.border
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <div className="relative">
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              group.products.forEach((p) => onDismiss(p.alert.id))
            }}
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-3 p-3 pr-9 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                config.bg,
                config.border,
                "border"
              )}
            >
              <Icon className={cn("h-4 w-4", config.accent)} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">
                  {group.country}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-1.5 text-[10px] font-medium",
                    config.badge
                  )}
                >
                  {group.risk}% risk
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {group.products.length} product
                {group.products.length !== 1 ? "s" : ""} affected
              </p>
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
        </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="border-t border-border/50 bg-background/30 px-3 pb-3 pt-2">
            <div className="space-y-2">
              {group.products.map((prod) => (
                <div
                  key={prod.productId}
                  className="rounded-lg border border-border/40 bg-background/60 p-2.5"
                >
                  <div className="flex items-start gap-2">
                    <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground">
                        {prod.productName}
                      </span>
                      {prod.components.length > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Components: {prod.components.join(", ")}
                        </p>
                      )}
                      {onAlertClick && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAlertClick(prod.alert)
                          }}
                        >
                          <Zap className="h-3 w-3" />
                          View alternatives
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
