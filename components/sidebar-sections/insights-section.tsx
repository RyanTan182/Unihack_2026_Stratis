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
  Sparkles,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { useState, useCallback } from "react"
import { useAlternatives, type AlternativeEntry } from "@/hooks/use-alternatives"

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

// Component for high-risk component row with alternatives
function HighRiskComponentRow({
  comp,
  onFindSafeRoute,
  onViewAlternatives,
}: {
  comp: ComponentRiskForInsights
  onFindSafeRoute?: (
    origin: string,
    destination: string,
    itemName: string,
    componentId?: string,
    productId?: string
  ) => void
  onViewAlternatives?: (component: ComponentRiskForInsights, parentCountry: string) => void
}) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const { alternatives, loading, error, fetchAlternatives, clearAlternatives } = useAlternatives()

  const handleViewAlternatives = useCallback(async () => {
    if (onViewAlternatives) {
      // Use the callback if provided (for external handling)
      onViewAlternatives(comp, comp.country)
    } else {
      // Use internal alternatives fetching
      if (showAlternatives) {
        setShowAlternatives(false)
        clearAlternatives()
      } else {
        setShowAlternatives(true)
        await fetchAlternatives(
          comp.country,
          "component",
          comp.componentName,
          comp.risk
        )
      }
    }
  }, [comp, onViewAlternatives, showAlternatives, fetchAlternatives, clearAlternatives])

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-2">
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
          <Button
            size="sm"
            variant="outline"
            className={cn("h-6 px-1.5 text-[10px]", showAlternatives && "bg-primary/10 border-primary text-primary")}
            onClick={handleViewAlternatives}
            title="View AI alternatives"
          >
            <Sparkles className="h-3 w-3 mr-0.5" />
            Alternatives
          </Button>
        </div>
      </div>

      {/* Alternatives Display */}
      {showAlternatives && (
        <div className="mt-2 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground">
              AI-Generated Alternatives
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-4 w-4 p-0"
              onClick={() => setShowAlternatives(false)}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Fetching alternatives...
            </div>
          ) : error ? (
            <p className="text-[10px] text-red-400">{error}</p>
          ) : alternatives.length > 0 ? (
            <div className="space-y-1.5">
              {alternatives.map((alt, i) => (
                <AlternativeCard key={i} alternative={alt} />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground">No alternatives found.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Card for displaying an alternative
function AlternativeCard({ alternative }: { alternative: AlternativeEntry }) {
  const riskColors = {
    low: "text-emerald-400",
    medium: "text-yellow-400",
    high: "text-red-400",
  }

  return (
    <div className="rounded border border-border/50 bg-background/50 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium">{alternative.country}</span>
        <Badge
          variant="outline"
          className={cn("text-[9px] h-4 px-1", riskColors[alternative.risk])}
        >
          {alternative.risk} risk
        </Badge>
      </div>
      <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">
        {alternative.reason}
      </p>
    </div>
  )
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
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {insights.highRiskComponents.slice(0, 3).map((comp) => (
              <HighRiskComponentRow
                key={comp.componentId}
                comp={comp}
                onFindSafeRoute={onFindSafeRoute}
                onViewAlternatives={onViewAlternatives}
              />
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
