"use client"

import { X, TrendingUp, TrendingDown, Ship, AlertCircle, ArrowRight, Zap, MapPin, Newspaper, AlertTriangle, Anchor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ProductSupplyRoute } from "@/components/supply-chain-map"

interface CountryRisk {
  id: string
  name: string
  type: "country" | "chokepoint"
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

interface PathDetailsPanelProps {
  route: ProductSupplyRoute | null
  countryRisks: CountryRisk[]
  onClose: () => void
}

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-400" }
}

export function PathDetailsPanel({ route, countryRisks, onClose }: PathDetailsPanelProps) {
  if (!route) return null

  const riskLevel = getRiskLevel(route.riskScore)
  const fromCountryData = countryRisks.find(c => c.name === route.fromCountry || c.id === route.fromCountry)
  const toCountryData = countryRisks.find(c => c.name === route.toCountry || c.id === route.toCountry)

  const componentRisk = route.componentRiskPrediction
  const componentRiskLevel = getRiskLevel(componentRisk)
  const isComponentHighRisk = componentRisk > 60
  const isPathHighRisk = route.riskScore >= 60

  const allNews = [
    ...(fromCountryData?.newsHighlights ?? []).map(n => ({ country: route.fromCountry, text: n })),
    ...(toCountryData?.newsHighlights ?? []).map(n => ({ country: route.toCountry, text: n })),
  ]

  const dangerReasons: string[] = []
  if (isComponentHighRisk) {
    dangerReasons.push(`Component "${route.fromItem}" has a predicted risk of ${componentRisk}%, exceeding the 60% threshold`)
  }
  if (isPathHighRisk) {
    dangerReasons.push(`The shipping path between ${route.fromCountry} and ${route.toCountry} averages ${route.riskScore}% risk`)
  }
  if (fromCountryData && fromCountryData.overallRisk >= 60) {
    dangerReasons.push(`Origin country ${route.fromCountry} is rated high risk (${fromCountryData.overallRisk}%)`)
  }
  if (toCountryData && toCountryData.overallRisk >= 60) {
    dangerReasons.push(`Destination country ${route.toCountry} is rated high risk (${toCountryData.overallRisk}%)`)
  }
  if (route.chokepoints.length > 0) {
    dangerReasons.push(`Route passes through ${route.chokepoints.length} chokepoint${route.chokepoints.length > 1 ? "s" : ""}: ${route.chokepoints.join(", ")}`)
  }

  const highRiskSegments = route.segments.filter(s => s.riskScore >= 60)

  return (
    <div className="absolute bottom-56 left-4 z-10 w-80 animate-in slide-in-from-bottom-4">
      <Card className="glass-panel border-primary/20 shadow-2xl overflow-hidden max-h-[calc(50vh)] overflow-y-auto">
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <Ship className="h-5 w-5 text-primary" />
                Supply Chain Path
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{route.fromCountry}</span>
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">{route.toCountry}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted/50">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Overall Risk */}
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 p-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Combined Path Risk</p>
              <p className="text-3xl font-bold text-foreground">{route.riskScore}%</p>
            </div>
            <div className="text-right">
              <span className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                riskLevel.color
              )}>
                {riskLevel.label} Risk
              </span>
              <div className="mt-2 flex items-center gap-1.5 justify-end">
                {route.riskScore >= 60 ? (
                  <TrendingUp className="h-4 w-4 text-red-400" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-emerald-400" />
                )}
                <span className="text-[10px] text-muted-foreground">
                  {route.riskScore >= 60 ? "Above threshold" : "Within limits"}
                </span>
              </div>
            </div>
          </div>

          {/* Danger Explanation - only shown for dangerous routes */}
          {route.isDangerous && dangerReasons.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                <p className="text-xs font-semibold text-red-400">Why This Route Is Flagged</p>
              </div>
              <ul className="space-y-1.5 pl-6">
                {dangerReasons.map((reason, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground list-disc">{reason}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Component Risk */}
          <div className="rounded-lg border border-border/50 bg-card/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-foreground">Component Risk</span>
              </div>
              <span className={cn("text-xs font-semibold", componentRiskLevel.textColor)}>
                {componentRisk}%
              </span>
            </div>
            <Progress value={componentRisk} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              {route.fromItem} — predicted supply chain disruption risk
            </p>
          </div>

          {/* Country Risk Breakdown */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground">Country Risk Breakdown</p>
            <div className="space-y-2.5">
              {fromCountryData && (
                <div className="rounded-lg bg-muted/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Origin — {route.fromCountry}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Overall Risk</span>
                    <span className="font-medium text-foreground">{fromCountryData.overallRisk}%</span>
                  </div>
                  <Progress value={fromCountryData.overallRisk} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Import: {fromCountryData.importRisk}%</span>
                    <span>Export: {fromCountryData.exportRisk}%</span>
                  </div>
                </div>
              )}
              {toCountryData && (
                <div className="rounded-lg bg-muted/20 p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-3 w-3 text-emerald-400" />
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">Destination — {route.toCountry}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Overall Risk</span>
                    <span className="font-medium text-foreground">{toCountryData.overallRisk}%</span>
                  </div>
                  <Progress value={toCountryData.overallRisk} className="h-1.5" />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Import: {toCountryData.importRisk}%</span>
                    <span>Export: {toCountryData.exportRisk}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* High Risk Segments */}
          {highRiskSegments.length > 0 && (
            <>
              <Separator className="bg-border/50" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">High Risk Segments ({highRiskSegments.length})</p>
                {highRiskSegments.map((seg, i) => {
                  return (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {seg.isChokepointSegment ? (
                          <Anchor className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        ) : (
                          <ArrowRight className="h-3.5 w-3.5 text-red-400 shrink-0" />
                        )}
                        <span className="text-[11px] text-foreground truncate">
                          {seg.fromNode} → {seg.toNode}
                        </span>
                      </div>
                      <Badge variant="destructive" className="border-0 text-[10px] shrink-0 ml-2">
                        {seg.riskScore}%
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Chokepoints */}
          {route.chokepoints.length > 0 && (
            <>
              <Separator className="bg-border/50" />
              <div className="space-y-2">
                <p className="text-xs font-medium text-foreground">Chokepoints on Route</p>
                <div className="flex flex-wrap gap-1.5">
                  {route.chokepoints.map((cp) => (
                    <Badge key={cp} variant="outline" className="border-purple-500/30 text-purple-400 text-[10px] gap-1">
                      <Anchor className="h-2.5 w-2.5" />
                      {cp}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* News Highlights */}
          {allNews.length > 0 && (
            <>
              <Separator className="bg-border/50" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-medium text-foreground">Related News</p>
                </div>
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {allNews.map((news, i) => (
                    <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/20 px-2.5 py-2">
                      <AlertCircle className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground">{news.country}</p>
                        <p className="text-[11px] text-foreground">{news.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Route Details */}
          <Separator className="bg-border/50" />
          <div className="rounded-lg bg-muted/20 p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Route Details</p>
            <div className="flex items-center gap-2 mb-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: route.productColor, boxShadow: `0 0 8px ${route.productColor}50` }}
              />
              <span className="text-sm font-medium text-foreground">{route.productName}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-foreground capitalize">
                {route.fromItem}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-foreground capitalize">
                {route.toItem}
              </span>
            </div>
            {route.pathNodes.length > 2 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Via: {route.pathNodes.slice(1, -1).join(" → ")}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
