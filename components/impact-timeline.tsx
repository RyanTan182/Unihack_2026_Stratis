"use client"

import { Check, Clock, MapPin, FileText, Truck, TestTube } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelinePhase {
  name: string
  duration: string
  description: string
}

interface ImpactTimelineProps {
  phases: TimelinePhase[]
  totalDuration: string
  className?: string
}

const PHASE_ICONS: Record<string, typeof Clock> = {
  "Planning & Assessment": MapPin,
  "Permits & Legal": FileText,
  "Facility Setup": Truck,
  "Equipment Transfer": Truck,
  "Testing & Certification": TestTube,
  default: Clock,
}

export function ImpactTimeline({ phases, totalDuration, className }: ImpactTimelineProps) {
  const getPhaseIcon = (phaseName: string) => {
    return PHASE_ICONS[phaseName] || PHASE_ICONS.default
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          Relocation Timeline
        </h4>
        <span className="text-xs text-muted-foreground font-medium">
          Total: {totalDuration}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-border/50" />

        {/* Phases */}
        <div className="space-y-3">
          {phases.map((phase, index) => {
            const Icon = getPhaseIcon(phase.name)
            const isLast = index === phases.length - 1

            return (
              <div
                key={phase.name}
                className={cn(
                  "relative flex items-start gap-3",
                  isLast && "pb-0"
                )}
              >
                {/* Icon */}
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-muted border border-border/50">
                  <Icon className="h-4 w-4 text-primary" />
                </div>

                {/* Content */}
                <div className="flex-1 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {phase.name}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                      {phase.duration}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {phase.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Completion indicator */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/30">
          <Check className="h-3 w-3 text-emerald-400" />
        </div>
        <span className="text-xs text-muted-foreground">
          Production ready after {totalDuration}
        </span>
      </div>
    </div>
  )
}
