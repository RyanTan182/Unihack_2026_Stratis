"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Globe,
  Layers,
  Play,
  BarChart3,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ActionBarProps {
  // Panel states
  showRiskZones: boolean
  isRouteSummaryOpen?: boolean

  // Counts
  productCount: number

  // Handlers
  onToggleRiskZones: () => void
  onToggleRouteSummary?: () => void
  onClear: () => void

  // Demo related
  isDemoLoaded?: boolean
  onClearDemo?: () => void
  onStartDemo?: () => void

  // Animation
  onAnimateRoutes?: () => void
  isAnimating?: boolean
}

export function ActionBar({
  showRiskZones,
  isRouteSummaryOpen,
  productCount,
  onToggleRiskZones,
  onToggleRouteSummary,
  onClear,
  isDemoLoaded,
  onClearDemo,
  onStartDemo,
  onAnimateRoutes,
  isAnimating,
}: ActionBarProps) {
  return (
    <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
      {/* Route Summary - conditional */}
      {productCount > 0 && onToggleRouteSummary && (
        <Button
          variant={isRouteSummaryOpen ? "default" : "secondary"}
          size="sm"
          className={cn(
            "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
            isRouteSummaryOpen
              ? "bg-primary text-primary-foreground glow-primary"
              : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
          )}
          onClick={onToggleRouteSummary}
        >
          <BarChart3 className="h-4 w-4" />
          Route Summary
        </Button>
      )}

      {/* Risk Zones Toggle */}
      <Button
        variant={showRiskZones ? "default" : "secondary"}
        size="sm"
        className={cn(
          "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
          showRiskZones
            ? "bg-primary text-primary-foreground glow-primary"
            : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
        )}
        onClick={onToggleRiskZones}
      >
        <Globe className="h-4 w-4" />
        Risk Zones
      </Button>

      {/* Clear Selection */}
      <Button
        variant="secondary"
        size="sm"
        className="gap-2 font-medium glass-panel border-primary/20 shadow-lg hover:border-primary/40 hover:bg-muted/50 sleek-button cursor-pointer"
        onClick={onClear}
      >
        <Layers className="h-4 w-4" />
        Clear
      </Button>

      {/* Demo Actions */}
      {isDemoLoaded && productCount > 0 && onClearDemo && (
        <Button
          variant="secondary"
          size="sm"
          className="gap-2 font-medium glass-panel border-primary/20 shadow-lg hover:border-primary/40 hover:bg-muted/50 sleek-button cursor-pointer"
          onClick={onClearDemo}
        >
          <Layers className="h-4 w-4" />
          Clear Demo
        </Button>
      )}

      {onStartDemo && (
        <Button
          variant="secondary"
          size="sm"
          className="gap-2 font-medium glass-panel border-primary/20 shadow-lg hover:border-primary/40 hover:bg-muted/50 sleek-button cursor-pointer"
          onClick={onStartDemo}
        >
          <Play className="h-4 w-4" />
          Demo
        </Button>
      )}

      {/* Animate Routes */}
      {onAnimateRoutes && productCount > 0 && (
        <Button
          variant="secondary"
          size="sm"
          className={cn(
            "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
            isAnimating
              ? "bg-primary text-primary-foreground glow-primary"
              : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
          )}
          onClick={onAnimateRoutes}
          disabled={isAnimating}
        >
          <Sparkles className="h-4 w-4" />
          {isAnimating ? "Animating..." : "Animate Routes"}
        </Button>
      )}
    </div>
  )
}
