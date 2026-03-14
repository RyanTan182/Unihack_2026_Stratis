"use client"

import {
  MapPin,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Activity,
  DollarSign,
  Target,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

// Define types locally
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
  productId?: string
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

interface InsightsSectionProps {
  insights: SupplyChainInsightsData | null
  onFindSafeRoute?: (
    origin: string,
    destination: string,
    itemName: string,
    componentId?: string,
    productId?: string
  ) => void
  onViewAlternatives?: (component: ComponentRiskForInsights, parentCountry: string) => void
}

// Local helper function
function getRiskLevel(score: number): { label: string; color: string; textColor: string } {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-400" }
}

export function InsightsSection({
  insights,
  onFindSafeRoute,
  onViewAlternatives,
}: InsightsSectionProps) {
  if (!insights) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        Add products to see supply chain insights
      </div>
    )
  }

  const riskInfo = getRiskLevel(insights.healthScore)

  return (
    <div className="space-y-3">
      {/* Health Score */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium">Health Score</span>
          <Badge className={cn("font-mono text-xs", riskInfo.textColor)}>
            {insights.healthScore}%
          </Badge>
        </div>
        <Progress value={insights.healthScore} max={100} className="h-1.5" />
      </div>

      {/* Risk Breakdown */}
      <div className="space-y-2">
        <div>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-muted-foreground">Geopolitical</span>
            <span className="font-semibold">{insights.riskBreakdown.geopolitical}%</span>
          </div>
          <Progress value={insights.riskBreakdown.geopolitical} max={100} className="h-1" />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-muted-foreground">Logistics</span>
            <span className="font-semibold">{insights.riskBreakdown.logistics}%</span>
          </div>
          <Progress value={insights.riskBreakdown.logistics} max={100} className="h-1" />
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="text-muted-foreground">Price Volatility</span>
            <span className="font-semibold">{insights.riskBreakdown.priceVolatility}%</span>
          </div>
          <Progress value={insights.riskBreakdown.priceVolatility} max={100} className="h-1" />
        </div>
      </div>

      {/* Price Impact */}
      <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Price Impact</span>
          <Badge className={cn(
            "font-mono text-xs ml-auto",
            insights.priceImpact.estimated.startsWith("+") ? "text-red-400" : "text-emerald-400"
          )}>
            {insights.priceImpact.estimated}
          </Badge>
        </div>
      </div>

      {/* High Risk Components */}
      {insights.highRiskComponents.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
            High-Risk ({insights.highRiskComponents.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {insights.highRiskComponents.slice(0, 3).map((comp) => (
              <div key={comp.componentId} className="rounded-lg border border-border/50 bg-muted/30 p-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{comp.componentName}</p>
                    <p className="text-[10px] text-muted-foreground">{comp.country}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="destructive" className="text-[10px] h-5">
                      {comp.risk}%
                    </Badge>
                    {onFindSafeRoute && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => onFindSafeRoute(
                          comp.country,
                          "United States",
                          comp.componentName,
                          comp.componentId,
                          comp.productId
                        )}
                        title="Find safe route"
                      >
                        <MapPin className="h-3 w-3" />
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Recommendations
          </div>
          <div className="space-y-1">
            {insights.recommendations.slice(0, 2).map((rec) => (
              <div key={rec.id} className="rounded-lg border border-border/50 bg-muted/30 p-2">
                <div className="flex items-start gap-1.5">
                  {rec.type === "critical" && <AlertTriangle className="h-3 w-3 text-red-400 flex-shrink-0 mt-0.5" />}
                  {rec.type === "warning" && <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0 mt-0.5" />}
                  {rec.type === "info" && <CheckCircle className="h-3 w-3 text-blue-400 flex-shrink-0 mt-0.5" />}
                  {rec.type === "opportunity" && <TrendingDown className="h-3 w-3 text-emerald-400 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium">{rec.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{rec.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export type { SupplyChainInsightsData, ComponentRiskForInsights }
