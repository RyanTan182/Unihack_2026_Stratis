"use client"

import { useState } from "react"
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Ship,
  Clock,
  Zap,
  Target,
  Ban,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { PriceFactor } from "@/lib/supply-chain-analyzer"

interface PriceRiskTimelineProps {
  factors: PriceFactor[]
  estimatedImpact: string
  className?: string
}

const eventTypeConfig = {
  tariff: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: DollarSign,
    label: 'Tariff',
  },
  sanction: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: Ban,
    label: 'Sanction',
  },
  logistics: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: Ship,
    label: 'Logistics',
  },
  market: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: TrendingUp,
    label: 'Market',
  },
  risk_premium: {
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: AlertTriangle,
    label: 'Risk Premium',
  },
}

type EventType = keyof typeof eventTypeConfig

interface TimelineEvent {
  id: string
  type: EventType
  source: string
  impact: 'increase' | 'decrease' | 'neutral'
  magnitude: number
  description: string
  isNew?: boolean
}

export function PriceRiskTimeline({
  factors,
  estimatedImpact,
  className,
}: PriceRiskTimelineProps) {
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null)

  // Convert PriceFactors to TimelineEvents
  const events: TimelineEvent[] = factors.map((factor, idx) => {
    let type: EventType = 'market'
    if (factor.source.toLowerCase().includes('tariff')) type = 'tariff'
    else if (factor.source.toLowerCase().includes('sanction')) type = 'sanction'
    else if (factor.source.toLowerCase().includes('logistics')) type = 'logistics'
    else if (factor.source.toLowerCase().includes('risk')) type = 'risk_premium'

    return {
      id: `event-${idx}`,
      type,
      source: factor.source,
      impact: factor.impact,
      magnitude: factor.magnitude,
      description: factor.description,
      isNew: idx === 0,
    }
  })

  // Add a prediction event at the end
  if (events.length > 0) {
    events.push({
      id: 'prediction',
      type: 'market',
      source: 'Predicted Impact',
      impact: estimatedImpact.startsWith('+') ? 'increase' : estimatedImpact.startsWith('-') ? 'decrease' : 'neutral',
      magnitude: Math.abs(parseFloat(estimatedImpact.replace('%', '').replace('+', ''))),
      description: `Estimated cumulative price impact: ${estimatedImpact}`,
      isNew: false,
    })
  }

  // Calculate totals
  const totalIncrease = events
    .filter(e => e.impact === 'increase')
    .reduce((sum, e) => sum + e.magnitude, 0)
  const totalDecrease = events
    .filter(e => e.impact === 'decrease')
    .reduce((sum, e) => sum + e.magnitude, 0)
  const netImpact = totalIncrease - totalDecrease

  return (
    <Card className={cn("border-border/50 bg-card/50", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Price Impact Timeline
          </CardTitle>
          <Badge
            className={cn(
              "border-0",
              netImpact > 0 ? "bg-red-500/20 text-red-400" :
              netImpact < 0 ? "bg-emerald-500/20 text-emerald-400" :
              "bg-yellow-500/20 text-yellow-400"
            )}
          >
            {netImpact >= 0 ? '+' : ''}{netImpact}%
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Summary Bar */}
        <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/30 border border-border/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-red-400" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-red-400">+{totalIncrease}%</span> increase
            </span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-emerald-400" />
            <span className="text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-400">-{totalDecrease}%</span> decrease
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-primary font-medium">Net: {netImpact >= 0 ? '+' : ''}{netImpact}%</span>
          </div>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-border to-primary/20" />

          {/* Events */}
          <div className="space-y-4">
            {events.map((event, idx) => {
              const config = eventTypeConfig[event.type]
              const Icon = config.icon
              const isLast = idx === events.length - 1
              const isSelected = selectedEvent === event.id
              const isHovered = hoveredEvent === event.id

              return (
                <div
                  key={event.id}
                  className={cn(
                    "relative pl-8 transition-all duration-200",
                    isLast && "pb-0"
                  )}
                  onMouseEnter={() => setHoveredEvent(event.id)}
                  onMouseLeave={() => setHoveredEvent(null)}
                  onClick={() => setSelectedEvent(isSelected ? null : event.id)}
                >
                  {/* Event Marker */}
                  <div
                    className={cn(
                      "absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all",
                      config.bg,
                      config.border,
                      (isSelected || isHovered) && "scale-110",
                      isLast && "bg-primary border-primary"
                    )}
                  >
                    <Icon className={cn("h-3 w-3", isLast ? "text-white" : config.color)} />
                  </div>

                  {/* Event Card */}
                  <div
                    className={cn(
                      "rounded-lg border p-3 transition-all cursor-pointer",
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 bg-muted/20 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-medium", config.color)}>
                            {event.source}
                          </span>
                          {event.isNew && (
                            <Badge className="bg-primary/20 text-primary border-0 text-[10px] py-0">
                              New
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {event.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          className={cn(
                            "font-mono border-0",
                            event.impact === 'increase' ? "bg-red-500/20 text-red-400" :
                            event.impact === 'decrease' ? "bg-emerald-500/20 text-emerald-400" :
                            "bg-muted text-muted-foreground"
                          )}
                        >
                          {event.impact === 'increase' ? '+' : event.impact === 'decrease' ? '-' : ''}{event.magnitude}%
                        </Badge>
                        {isLast && (
                          <span className="text-[10px] text-primary flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            Predicted
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-border/50">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className={cn("ml-1 font-medium", config.color)}>{config.label}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Impact:</span>
                            <span className={cn(
                              "ml-1 font-medium",
                              event.impact === 'increase' ? "text-red-400" : "text-emerald-400"
                            )}>
                              {event.impact === 'increase' ? 'Price Increase' : 'Price Decrease'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Empty State */}
        {events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <DollarSign className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No price factors detected</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Add supply chain components to see price impact analysis
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
