"use client"

import { useState } from "react"
import {
  Map,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Route,
  MapPin,
  Zap,
  Info,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { FoundRoute } from "@/lib/route-types"

import { getRiskLevel } from "@/lib/risk-calculator"

interface RouteComparisonProps {
  routes: FoundRoute[]
  selectedRouteId: string | null
  onRouteSelect: (route: FoundRoute) => void
  onClose: () => void
}

export function RouteComparison({
  routes,
  selectedRouteId,
  onRouteSelect,
  onClose,
}: RouteComparisonProps) {
  return (
    <div className="w-full">
      <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <Route className="h-4 w-4 text-primary" />
                Route Options
                {routes.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {routes.length} routes found
                  </Badge>
                )}
              </div>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-2">
          {routes.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No alternative routes found
            </div>
          ) : (
            <div className="space-y-2">
              {routes.map((route, index) => {
                const isSelected = route.id === selectedRouteId
                const riskLevel = getRiskLevel(route.totalRisk)
                const routeKey = route.nodes.map(n => n.name).join(" → ")

                return (
                  <button
                    key={route.id}
                    onClick={() => onRouteSelect(route)}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                    )}
                  >
                    {/* Route Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                          index === 0 ? "bg-primary text-primary-foreground" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={cn(
                              "text-sm font-medium",
                              isSelected ? "text-primary" : "text-foreground"
                            )}>
                              Route {index + 1}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                riskLevel.textColor
                              )}
                            >
                              {route.totalRisk}%
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {routeKey}
                          </div>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-primary" />
                      )}
                    </div>

                    {/* Risk Bar */}
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Risk Level</span>
                        <span className={riskLevel.textColor}>{riskLevel.label}</span>
                      </div>
                      <div className="relative h-2 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className={cn(
                            "absolute inset-y-0 rounded-full transition-all duration-500",
                            riskLevel.color
                          )}
                          style={{ width: `${route.totalRisk}%` }}
                        />
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-medium text-foreground">{route.nodes.length}</div>
                        <div className="text-muted-foreground">Waypoints</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-foreground">{route.chokepointsUsed.length}</div>
                        <div className="text-muted-foreground">Chokepoints</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-foreground">{route.estimatedDays || "N/A"}</div>
                        <div className="text-muted-foreground">Est. Transit</div>
                      </div>
                    </div>

                    {/* Chokepoint Tags */}
                    {route.chokepointsUsed.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {route.chokepointsUsed.map((cp) => (
                          <Badge
                            key={cp}
                            variant="outline"
                            className="text-[10px]"
                          >
                            {cp}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Segment Risk Breakdown */}
                    <div className="mt-2 space-y-1">
                      <div className="text-xs font-medium text-foreground mb-1">
                        Segment Risks
                      </div>
                      <div className="flex gap-1">
                        {route.segmentRisks.map((risk, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded bg-muted/30 p-1.5 text-center"
                          >
                            <div className={cn(
                              "text-[10px] font-medium",
                              getRiskLevel(risk).textColor
                            )}>
                                {risk}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
