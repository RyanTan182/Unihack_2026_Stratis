"use client"

import { X, TrendingUp, TrendingDown, Ship, Package, AlertCircle, Clock, ArrowRight, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { ProductSupplyRoute } from "@/components/supply-chain-map"

interface PathDetailsPanelProps {
  route: ProductSupplyRoute | null
  onClose: () => void
}

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-zinc-500 text-white", textColor: "text-zinc-400" }
}

const mockPathDetails = {
  transitTime: "14-21 days",
  lastIncident: "Port congestion in Singapore",
  alternativeRoutes: 3,
  volumeChange: 12,
  carrierReliability: 87,
  customsRisk: 35,
  weatherRisk: 22,
  securityRisk: 45,
}

export function PathDetailsPanel({ route, onClose }: PathDetailsPanelProps) {
  if (!route) return null

  const riskLevel = getRiskLevel(route.riskScore)

  return (
    <div className="absolute bottom-4 left-4 z-10 w-96 animate-in slide-in-from-bottom-4">
      <Card className="glass-panel border-primary/20 shadow-2xl overflow-hidden">
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

          {/* Risk Breakdown */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-foreground">Risk Breakdown</p>
            <div className="space-y-2.5">
              <div className="rounded-lg bg-muted/20 p-2.5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Customs & Tariffs</span>
                  <span className="font-medium text-foreground">{mockPathDetails.customsRisk}%</span>
                </div>
                <Progress value={mockPathDetails.customsRisk} className="h-1.5" />
              </div>
              <div className="rounded-lg bg-muted/20 p-2.5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Weather Disruption</span>
                  <span className="font-medium text-foreground">{mockPathDetails.weatherRisk}%</span>
                </div>
                <Progress value={mockPathDetails.weatherRisk} className="h-1.5" />
              </div>
              <div className="rounded-lg bg-muted/20 p-2.5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">Security & Geopolitical</span>
                  <span className="font-medium text-foreground">{mockPathDetails.securityRisk}%</span>
                </div>
                <Progress value={mockPathDetails.securityRisk} className="h-1.5" />
              </div>
            </div>
          </div>

          <Separator className="bg-border/50" />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border/50 bg-card/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">Transit Time</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{mockPathDetails.transitTime}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-card/50 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Ship className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground">Reliability</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{mockPathDetails.carrierReliability}%</p>
            </div>
          </div>

          {/* Volume Trend */}
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/50 p-3">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground">Volume Change (30d)</p>
                <p className="text-sm font-semibold text-foreground">
                  {mockPathDetails.volumeChange > 0 ? "+" : ""}
                  {mockPathDetails.volumeChange}%
                </p>
              </div>
            </div>
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border",
              mockPathDetails.volumeChange > 0 ? "border-emerald-500/50 text-emerald-400" : "border-red-500/50 text-red-400"
            )}>
              {mockPathDetails.volumeChange > 0 ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          </div>

          {/* Recent Alert */}
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-red-400">Recent Incident</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{mockPathDetails.lastIncident}</p>
            </div>
          </div>

          {/* Route Info */}
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
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 border-border/50 hover:border-primary/30 hover:text-primary">
              View Alternatives ({mockPathDetails.alternativeRoutes})
            </Button>
            <Button size="sm" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5">
              <Zap className="h-3 w-3" />
              Full Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
