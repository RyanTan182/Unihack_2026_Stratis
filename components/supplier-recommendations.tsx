"use client"

import { useState } from "react"
import {
  X,
  MapPin,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Ship,
  Building2,
  DollarSign,
  Shield,
  Loader2,
  Star,
  BarChart3,
  Check,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { SupplierAlternative, ComponentRisk } from "@/lib/supply-chain-analyzer"
import { getRiskLevel } from "@/lib/supply-chain-analyzer"

interface SupplierRecommendationsProps {
  isOpen: boolean
  onClose: () => void
  componentRisk: ComponentRisk | null
  destinationCountry: string
  onSelectAlternative: (alternative: SupplierAlternative) => void
  onViewRoute: (origin: string, destination: string) => void
  onReplaceSupplier?: (alternative: SupplierAlternative) => void
}

export function SupplierRecommendations({
  isOpen,
  onClose,
  componentRisk,
  destinationCountry,
  onSelectAlternative,
  onViewRoute,
  onReplaceSupplier,
}: SupplierRecommendationsProps) {
  const [selectedAlternative, setSelectedAlternative] = useState<SupplierAlternative | null>(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'comparison'>('comparison')

  if (!isOpen || !componentRisk) return null

  const riskInfo = getRiskLevel(componentRisk.risk)

  const handleViewRoute = (alternative: SupplierAlternative) => {
    setIsLoadingRoute(true)
    setSelectedAlternative(alternative)
    onSelectAlternative(alternative)
    onViewRoute(alternative.country, destinationCountry)
    setTimeout(() => setIsLoadingRoute(false), 500)
  }

  const handleReplace = (alternative: SupplierAlternative) => {
    onReplaceSupplier?.(alternative)
    onClose()
  }

  const getCostFactorIcon = (factor: 'lower' | 'similar' | 'higher') => {
    switch (factor) {
      case 'lower':
        return <TrendingDown className="h-4 w-4 text-emerald-400" />
      case 'higher':
        return <TrendingUp className="h-4 w-4 text-red-400" />
      default:
        return <Minus className="h-4 w-4 text-yellow-400" />
    }
  }

  const getCostFactorLabel = (factor: 'lower' | 'similar' | 'higher') => {
    switch (factor) {
      case 'lower':
        return { label: 'Lower Cost', color: 'text-emerald-400' }
      case 'higher':
        return { label: 'Higher Cost', color: 'text-red-400' }
      default:
        return { label: 'Similar Cost', color: 'text-yellow-400' }
    }
  }

  // Find the best alternative (lowest risk with good cost)
  const bestAlternative = componentRisk.alternatives.length > 0
    ? componentRisk.alternatives.reduce((best, alt) => {
        const bestScore = best.risk - (best.costFactor === 'lower' ? 5 : 0)
        const altScore = alt.risk - (alt.costFactor === 'lower' ? 5 : 0)
        return altScore < bestScore ? alt : best
      })
    : null

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[400px] shadow-2xl">
      <div className="flex h-full flex-col bg-background/95 backdrop-blur-xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Supplier Alternatives</h2>
              <p className="text-xs text-muted-foreground">
                {componentRisk.componentName} from {componentRisk.country}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <Button
            variant={viewMode === 'comparison' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('comparison')}
          >
            <BarChart3 className="h-3 w-3 mr-1.5" />
            Comparison
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode('list')}
          >
            View List
          </Button>
        </div>

        {/* Current Component Info */}
        <div className="border-b border-border p-4">
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{componentRisk.componentName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{componentRisk.country}</span>
                  </div>
                </div>
                <Badge className={cn("font-mono", riskInfo.color)}>
                  {componentRisk.risk}% Risk
                </Badge>
              </div>

              {/* Risk Factors */}
              {componentRisk.factors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {componentRisk.factors.map((factor, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs border-orange-500/30 text-orange-400">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {factor}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                <span>Destination: {destinationCountry}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Comparison View */}
        {viewMode === 'comparison' && componentRisk.alternatives.length > 0 && (
          <div className="flex-1 overflow-y-auto p-4">
            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Current Supplier */}
              <Card className="border-red-500/30 bg-red-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">Current</span>
                    <Badge variant="outline" className="text-xs border-red-500/30 text-red-400">
                      {componentRisk.risk}%
                    </Badge>
                  </div>
                  <p className="font-medium text-sm mb-2">{componentRisk.country}</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Risk</span>
                        <span className="text-red-400">{componentRisk.risk}%</span>
                      </div>
                      <Progress value={componentRisk.risk} className="h-1.5 bg-muted" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {componentRisk.factors.slice(0, 2).map((factor, idx) => (
                        <span key={idx} className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                          {factor}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Best Alternative */}
              {bestAlternative && (
                <Card className="border-emerald-500/30 bg-emerald-500/5 relative">
                  {bestAlternative === componentRisk.alternatives[0] && (
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px]">
                        <Star className="h-3 w-3 mr-1" />
                        Recommended
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Alternative</span>
                      <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                        {bestAlternative.risk}%
                      </Badge>
                    </div>
                    <p className="font-medium text-sm mb-2">{bestAlternative.country}</p>
                    <div className="space-y-2">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Risk</span>
                          <span className="text-emerald-400">{bestAlternative.risk}%</span>
                        </div>
                        <Progress value={bestAlternative.risk} className="h-1.5 bg-muted" />
                      </div>
                      <div className="flex items-center gap-1">
                        {getCostFactorIcon(bestAlternative.costFactor)}
                        <span className={cn("text-[10px]", getCostFactorLabel(bestAlternative.costFactor).color)}>
                          {getCostFactorLabel(bestAlternative.costFactor).label}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Risk/Cost Tradeoff Chart */}
            <Card className="border-border/50 bg-muted/20 mb-4">
              <CardContent className="p-4">
                <h4 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Risk vs Cost Tradeoff
                </h4>
                <div className="relative h-32 border border-border/30 rounded-lg bg-card/30 p-2">
                  {/* Y-axis: Risk */}
                  <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col items-center justify-between py-2">
                    <span className="text-[8px] text-muted-foreground">100%</span>
                    <span className="text-[8px] text-muted-foreground">Risk</span>
                    <span className="text-[8px] text-muted-foreground">0%</span>
                  </div>
                  {/* X-axis: Cost */}
                  <div className="absolute bottom-0 left-6 right-0 h-4 flex items-center justify-between px-2">
                    <span className="text-[8px] text-muted-foreground">Lower</span>
                    <span className="text-[8px] text-muted-foreground">Cost</span>
                    <span className="text-[8px] text-muted-foreground">Higher</span>
                  </div>
                  {/* Plot area */}
                  <div className="ml-6 mr-2 mt-2 mb-4 h-full relative">
                    {/* Current supplier marker */}
                    <div
                      className="absolute w-3 h-3 rounded-full bg-red-400 border border-red-500"
                      style={{
                        left: '50%',
                        bottom: `${componentRisk.risk}%`,
                        transform: 'translate(-50%, 50%)'
                      }}
                      title={`Current: ${componentRisk.country}`}
                    />
                    {/* Alternative markers */}
                    {componentRisk.alternatives.map((alt, idx) => {
                      const xPos = alt.costFactor === 'lower' ? '20%' : alt.costFactor === 'higher' ? '80%' : '50%'
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "absolute w-3 h-3 rounded-full border cursor-pointer transition-transform hover:scale-125",
                            alt === bestAlternative
                              ? "bg-emerald-400 border-emerald-500 ring-2 ring-emerald-400/30"
                              : "bg-primary border-primary"
                          )}
                          style={{
                            left: xPos,
                            bottom: `${alt.risk}%`,
                            transform: 'translate(-50%, 50%)'
                          }}
                          title={`${alt.country}: ${alt.risk}% risk, ${alt.costFactor} cost`}
                        />
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Alternatives List */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                All Alternatives
              </p>
              {componentRisk.alternatives.map((alt, idx) => {
                const altRiskInfo = getRiskLevel(alt.risk)
                const costInfo = getCostFactorLabel(alt.costFactor)
                const riskReduction = Math.round((1 - alt.risk / componentRisk.risk) * 100)
                const isSelected = selectedAlternative?.country === alt.country
                const isBest = alt === bestAlternative

                return (
                  <Card
                    key={idx}
                    className={cn(
                      "cursor-pointer transition-all duration-200",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                    )}
                    onClick={() => setSelectedAlternative(alt)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                            <span className="text-sm font-bold text-primary">#{idx + 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-sm">{alt.country}</p>
                              {isBest && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border-0 text-[10px] py-0">
                                  <Star className="h-2.5 w-2.5 mr-0.5" />
                                  Best
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className={cn("text-[10px] font-mono", altRiskInfo.textColor)}>
                                {alt.risk}%
                              </Badge>
                              {riskReduction > 0 && (
                                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                                  <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                                  {riskReduction}% lower
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {getCostFactorIcon(alt.costFactor)}
                          <span className={cn("text-xs font-medium", costInfo.color)}>
                            {costInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Advantages */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {alt.advantages.slice(0, 2).map((adv, advIdx) => (
                          <span key={advIdx} className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
                            {adv}
                          </span>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 text-xs">
                          <Ship className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Route:</span>
                          <span className={cn(
                            "font-medium",
                            alt.routeRisk < 40 ? "text-emerald-400" :
                            alt.routeRisk < 60 ? "text-yellow-400" : "text-orange-400"
                          )}>
                            {alt.routeRisk}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[10px] gap-1 px-2"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewRoute(alt)
                            }}
                            disabled={isLoadingRoute}
                          >
                            {isLoadingRoute && selectedAlternative?.country === alt.country ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <MapPin className="h-3 w-3" />
                            )}
                            View
                          </Button>
                          {onReplaceSupplier && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-6 text-[10px] gap-1 px-2"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleReplace(alt)
                              }}
                            >
                              <Zap className="h-3 w-3" />
                              Switch
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        )}

        {/* List View (original style) */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-y-auto p-4">
            {componentRisk.alternatives.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No alternatives found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Consider developing backup suppliers or building inventory buffer
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Recommended Alternatives ({componentRisk.alternatives.length})
                </p>

                {componentRisk.alternatives.map((alt, idx) => {
                  const altRiskInfo = getRiskLevel(alt.risk)
                  const costInfo = getCostFactorLabel(alt.costFactor)
                  const riskReduction = Math.round((1 - alt.risk / componentRisk.risk) * 100)
                  const isSelected = selectedAlternative?.country === alt.country

                  return (
                    <Card
                      key={idx}
                      className={cn(
                        "cursor-pointer transition-all duration-200",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                      )}
                      onClick={() => setSelectedAlternative(alt)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                              <span className="text-sm font-bold text-primary">#{idx + 1}</span>
                            </div>
                            <div>
                              <p className="font-medium">{alt.country}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className={cn("text-xs font-mono", altRiskInfo.textColor)}>
                                  {alt.risk}% Risk
                                </Badge>
                                {riskReduction > 0 && (
                                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    {riskReduction}% lower
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {getCostFactorIcon(alt.costFactor)}
                            <span className={cn("text-xs font-medium", costInfo.color)}>
                              {costInfo.label}
                            </span>
                          </div>
                        </div>

                        {/* Advantages */}
                        <div className="mt-3 space-y-1.5">
                          {alt.advantages.map((adv, advIdx) => (
                            <div key={advIdx} className="flex items-start gap-2">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">{adv}</span>
                            </div>
                          ))}
                        </div>

                        {/* Route Risk */}
                        <div className="mt-3 flex items-center justify-between pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2 text-xs">
                            <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">Route risk:</span>
                            <span className={cn(
                              "font-medium",
                              alt.routeRisk < 40 ? "text-emerald-400" :
                              alt.routeRisk < 60 ? "text-yellow-400" : "text-orange-400"
                            )}>
                              {alt.routeRisk}%
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs gap-1.5"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleViewRoute(alt)
                            }}
                            disabled={isLoadingRoute}
                          >
                            {isLoadingRoute && selectedAlternative?.country === alt.country ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <MapPin className="h-3 w-3" />
                                View Route
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* No Alternatives State */}
        {componentRisk.alternatives.length === 0 && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No alternatives found</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Consider developing backup suppliers or building inventory buffer
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {componentRisk.alternatives.length > 0 && (
          <div className="border-t border-border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {selectedAlternative
                    ? `${selectedAlternative.country} selected`
                    : "Select an alternative to compare"}
                </span>
              </div>
              {selectedAlternative && onReplaceSupplier && (
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5 bg-primary"
                  onClick={() => handleReplace(selectedAlternative)}
                >
                  <Check className="h-3 w-3" />
                  Replace Supplier
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
