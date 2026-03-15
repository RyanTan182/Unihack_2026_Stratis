"use client"

import { useState } from "react"
import {
  MapPin,
  Shield,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Globe,
  Building,
  ArrowRight,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn, formatRisk } from "@/lib/utils"
import type { RelocationRecommendation } from "@/lib/relocation-types"

interface RelocationResultsProps {
  recommendations: RelocationRecommendation[]
  currentCountryName: string
  currentCountryRisk: number
  onCountrySelect?: (countryId: string) => void
  onCompare?: (countryIds: string[]) => void
}

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-400" }
}

const getAccessBadgeColor = (access: string) => {
  switch (access) {
    case "excellent": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
    case "good": return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
    case "moderate": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
    default: return "bg-red-500/20 text-red-400 border-red-500/30"
  }
}

export function RelocationResults({
  recommendations,
  currentCountryName,
  currentCountryRisk,
  onCountrySelect,
  onCompare,
}: RelocationResultsProps) {
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set())

  const toggleCountrySelection = (countryId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedForComparison((prev) => {
      const next = new Set(prev)
      if (next.has(countryId)) {
        next.delete(countryId)
      } else {
        next.add(countryId)
      }
      return next
    })
  }

  const handleCompareSelected = () => {
    if (selectedForComparison.size >= 2) {
      onCompare?.(Array.from(selectedForComparison))
    }
  }

  if (recommendations.length === 0) {
    return (
      <Card className="border-primary/20 glass-panel shadow-xl">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="flex items-center gap-2.5 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Limited Options</p>
            <p className="text-xs text-muted-foreground mt-1">
              No suitable relocation alternatives found for the current criteria.
              Consider adjusting your risk concerns or priorities.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const currentRiskLevel = getRiskLevel(currentCountryRisk)

  return (
    <Card className="border-primary/20 glass-panel shadow-xl floating-panel">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-base">
              <Shield className="h-5 w-5 text-primary" />
              Top Recommendations
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Safe relocation options from {currentCountryName}
            </p>
          </div>
          {onCompare && recommendations.length >= 2 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCompare(recommendations.slice(0, 3).map(r => r.countryId))}
              className="text-xs sleek-button"
            >
              Compare Top 3
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Current Country Risk */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Current: {currentCountryName}</span>
            <span className={cn("text-xs font-medium", currentRiskLevel.textColor)}>
              {formatRisk(currentCountryRisk)}% Risk
            </span>
          </div>
          <Progress value={currentCountryRisk} className="h-1.5" />
        </div>

        {/* Recommendations List */}
        <div className="space-y-2">
          {recommendations.map((rec, index) => {
            const riskLevel = getRiskLevel(rec.riskAnalysis.geopolitical)
            const riskReduction = Math.round(((currentCountryRisk - rec.riskAnalysis.geopolitical) / Math.max(currentCountryRisk, 1)) * 100)
            const isSelected = selectedForComparison.has(rec.countryId)

            return (
              <div
                key={rec.countryId}
                className={cn(
                  "group rounded-xl border p-3 transition-all duration-200 cursor-pointer hover-lift",
                  isSelected
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/30 bg-card/30 hover:border-primary/30 hover:bg-card/50"
                )}
                onClick={() => onCountrySelect?.(rec.countryId)}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {/* Checkbox for comparison */}
                    <button
                      onClick={(e) => toggleCountrySelection(rec.countryId, e)}
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded border transition-all cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/50 hover:border-primary/50"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>
                    <div className={cn(
                      "score-badge",
                      index === 0 ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30" :
                      index === 1 ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30" :
                      "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30"
                    )}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{rec.country}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Score: <span className="text-primary font-medium">{rec.overallScore}</span>/100
                      </p>
                    </div>
                  </div>
                  {riskReduction > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                      <TrendingDown className="h-3 w-3 text-emerald-400" />
                      <span className="text-[10px] font-medium text-emerald-400">{riskReduction}% less risk</span>
                    </div>
                  )}
                </div>

                {/* Risk Scores */}
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                  <div className="metric-card">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Geopolitical</p>
                    <p className={cn("text-xs font-semibold", getRiskLevel(rec.riskAnalysis.geopolitical).textColor)}>
                      {rec.riskAnalysis.geopolitical}%
                    </p>
                  </div>
                  <div className="metric-card">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Trade</p>
                    <p className={cn("text-xs font-semibold", getRiskLevel(rec.riskAnalysis.tradeBarriers).textColor)}>
                      {rec.riskAnalysis.tradeBarriers}%
                    </p>
                  </div>
                  <div className="metric-card">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Labor</p>
                    <p className={cn("text-xs font-semibold", getRiskLevel(rec.riskAnalysis.labor).textColor)}>
                      {rec.riskAnalysis.labor}%
                    </p>
                  </div>
                  <div className="metric-card">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Disaster</p>
                    <p className={cn("text-xs font-semibold", getRiskLevel(rec.riskAnalysis.naturalDisaster).textColor)}>
                      {rec.riskAnalysis.naturalDisaster}%
                    </p>
                  </div>
                </div>

                {/* Market Access Badges */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {rec.targetMarketAccess.eu !== 'limited' && (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", getAccessBadgeColor(rec.targetMarketAccess.eu))}>
                      EU: {rec.targetMarketAccess.eu}
                    </span>
                  )}
                  {rec.targetMarketAccess.us !== 'limited' && (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", getAccessBadgeColor(rec.targetMarketAccess.us))}>
                      US: {rec.targetMarketAccess.us}
                    </span>
                  )}
                  {rec.targetMarketAccess.asia !== 'limited' && (
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border", getAccessBadgeColor(rec.targetMarketAccess.asia))}>
                      Asia: {rec.targetMarketAccess.asia}
                    </span>
                  )}
                </div>

                {/* Trade Agreements */}
                {rec.tradeAgreements.length > 0 && (
                  <div className="text-[10px] text-muted-foreground">
                    <Building className="h-3 w-3 inline mr-1" />
                    {rec.tradeAgreements.slice(0, 2).join(", ")}
                    {rec.tradeAgreements.length > 2 && ` +${rec.tradeAgreements.length - 2} more`}
                  </div>
                )}

                {/* Advantages */}
                <div className="mt-2 pt-2 border-t border-border/30">
                  <div className="flex flex-wrap gap-1">
                    {rec.advantages.slice(0, 2).map((adv, i) => (
                      <span key={i} className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle className="h-2.5 w-2.5" />
                        {adv}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Infrastructure & Cost */}
                <div className="flex items-center justify-between mt-2 text-[10px]">
                  <span className="text-muted-foreground">
                    Infrastructure: <span className="text-foreground capitalize">{rec.infrastructure}</span>
                  </span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded font-medium",
                    rec.estimatedCostFactor === "low" ? "text-emerald-400 bg-emerald-500/10" :
                    rec.estimatedCostFactor === "medium" ? "text-yellow-400 bg-yellow-500/10" :
                    "text-orange-400 bg-orange-500/10"
                  )}>
                    {rec.estimatedCostFactor.toUpperCase()} cost
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Compare Button */}
        {onCompare && (
          <div className="space-y-2">
            {selectedForComparison.size >= 2 && (
              <Button
                variant="default"
                className="w-full gap-2 sleek-button glow-primary"
                onClick={handleCompareSelected}
              >
                <Globe className="h-4 w-4" />
                Compare Selected ({selectedForComparison.size})
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {recommendations.length >= 2 && selectedForComparison.size < 2 && (
              <Button
                variant="outline"
                className="w-full gap-2 sleek-button"
                onClick={() => onCompare(recommendations.slice(0, 3).map(r => r.countryId))}
              >
                <Globe className="h-4 w-4" />
                Compare Top 3
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            {selectedForComparison.size === 1 && (
              <p className="text-xs text-center text-muted-foreground">
                Select at least 1 more country to compare
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
