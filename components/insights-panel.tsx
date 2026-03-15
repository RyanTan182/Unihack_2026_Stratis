"use client"

import {
  X,
  MapPin,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Activity,
  DollarSign,
  Target,
  Zap,
  Factory,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn, formatRisk } from "@/lib/utils"

// Define types locally to avoid circular imports
interface PriceFactor {
  source: string
  impact: 'increase' | 'decrease' | 'neutral'
  magnitude: number
  description: string
}

interface ComponentRiskForInsights {
  componentId: string
  componentName: string
  country: string
  risk: number
}

interface Recommendation {
  id: string
  type: 'critical' | 'warning' | 'info' | 'opportunity'
  title: string
  description: string
  action: string
}

interface SupplyChainInsightsData {
  healthScore: number
  riskBreakdown: {
    geopolitical: number
    logistics: number
    priceVolatility: number
  }
  highRiskComponents: ComponentRiskForInsights[]
  priceImpact: {
    estimated: string
    factors: PriceFactor[]
  }
  recommendations: Recommendation[]
}

interface InsightsPanelProps {
  isOpen: boolean
  onClose: () => void
  insights: SupplyChainInsightsData
  onFindSafeRoute?: (origin: string, destination: string, itemName: string) => void
  onViewAlternatives?: (component: ComponentRiskForInsights, parentCountry: string) => void
  onRelocationClick?: (country: string, componentName: string) => void
}

// Local helper function to avoid importing from supply-chain-analyzer
function getRiskLevel(score: number): { label: string; color: string; textColor: string } {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-400" }
}

export function InsightsPanel({
  isOpen,
  onClose,
  insights,
  onFindSafeRoute,
  onViewAlternatives,
  onRelocationClick,
}: InsightsPanelProps) {
  if (!isOpen) return null

  const riskInfo = getRiskLevel(insights.healthScore)

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[400px] shadow-2xl">
      <div className="flex h-full flex-col bg-background/95 backdrop-blur-xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Supply Chain Insights</h2>
              <p className="text-xs text-muted-foreground">Health score & risk analysis</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Health Score Section */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Health Score</span>
            <Badge className={cn("font-mono", riskInfo.textColor)}>
              {insights.healthScore}%
            </Badge>
          </div>
          <Progress value={insights.healthScore} max={100} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{insights.healthScore >= 70 ? "Good" : insights.healthScore >= 40 ? "Fair" : "Needs attention"}</span>
            <span>{100 - insights.healthScore}% remaining</span>
          </div>
        </div>

        {/* Risk Breakdown */}
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-medium mb-3">Risk Breakdown</h3>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Geopolitical</span>
                <span className="text-sm font-semibold">{insights.riskBreakdown.geopolitical}%</span>
              </div>
              <Progress value={insights.riskBreakdown.geopolitical} max={100} className="h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Logistics</span>
                <span className="text-sm font-semibold">{insights.riskBreakdown.logistics}%</span>
              </div>
              <Progress value={insights.riskBreakdown.logistics} max={100} className="h-1.5" />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Price Volatility</span>
                <span className="text-sm font-semibold">{insights.riskBreakdown.priceVolatility}%</span>
              </div>
              <Progress value={insights.riskBreakdown.priceVolatility} max={100} className="h-1.5" />
            </div>
          </div>
        </div>

        {/* Price Impact */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <h3 className="text-sm font-medium">Price Impact</h3>
              <p className="text-xs text-muted-foreground">Estimated impact on costs</p>
            </div>
            <Badge className={cn(
              "font-mono",
              insights.priceImpact.estimated.startsWith("+") ? "text-red-400" : "text-emerald-400"
            )}>
              {insights.priceImpact.estimated}
            </Badge>
          </div>
          {insights.priceImpact.factors.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {insights.priceImpact.factors.slice(0, 3).map((factor, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <ArrowRight className={cn(
                    "h-3 w-3 mt-0.5 flex-shrink-0",
                    factor.impact === "increase" ? "text-red-400" :
                    factor.impact === "decrease" ? "text-emerald-400" :
                    "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground">{factor.source}</span>
                    <span className="text-muted-foreground ml-1">+{factor.magnitude}%</span>
                    <p className="text-muted-foreground truncate">{factor.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High Risk Components */}
        {insights.highRiskComponents.length > 0 && (
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              High-Risk Components ({insights.highRiskComponents.length})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {insights.highRiskComponents.slice(0, 3).map((comp) => (
                <div key={comp.componentId} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{comp.componentName}</p>
                      <p className="text-xs text-muted-foreground">{comp.country}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="destructive" className="text-xs">
                        {formatRisk(comp.risk)}%
                      </Badge>
                      {onFindSafeRoute && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onFindSafeRoute(comp.country, "United States", comp.componentName)}
                          title="Find safe route"
                        >
                          <MapPin className="h-3 w-3" />
                        </Button>
                      )}
                      {onViewAlternatives && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onViewAlternatives(comp, "United States")}
                          title="View alternatives"
                        >
                          <Target className="h-3 w-3" />
                        </Button>
                      )}
                      {onRelocationClick && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => onRelocationClick(comp.country, comp.componentName)}
                          title="Find relocation options"
                        >
                          <Factory className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {insights.recommendations.length > 0 && (
          <div className="p-4 flex-1 overflow-y-auto">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Recommendations
            </h3>
            <div className="space-y-2">
              {insights.recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="flex items-start gap-2">
                    {rec.type === "critical" && <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />}
                    {rec.type === "warning" && <AlertTriangle className="h-4 w-4 text-yellow-400 flex-shrink-0" />}
                    {rec.type === "info" && <CheckCircle className="h-4 w-4 text-blue-400 flex-shrink-0" />}
                    {rec.type === "opportunity" && <TrendingDown className="h-4 w-4 text-emerald-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rec.description}</p>
                      <Badge variant="outline" className="mt-2 text-xs">
                        {rec.action}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
