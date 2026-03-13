"use client"

import { X, TrendingUp, TrendingDown, Ship, Package, AlertCircle, Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ProductSupplyRoute } from "@/components/supply-chain-map"

interface PathDetailsPanelProps {
  route: ProductSupplyRoute | null
  onClose: () => void
}

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Critical", color: "bg-risk-critical text-white" }
  if (score >= 60) return { label: "High", color: "bg-risk-high text-white" }
  if (score >= 40) return { label: "Medium", color: "bg-risk-medium text-foreground" }
  if (score >= 20) return { label: "Low", color: "bg-risk-low text-white" }
  return { label: "Minimal", color: "bg-risk-minimal text-white" }
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
      <Card className="border-border bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Ship className="h-5 w-5 text-primary" />
                Supply Chain Path
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{route.fromCountry}</span>
                <ArrowRight className="h-4 w-4" />
                <span>{route.toCountry}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Overall Risk */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Combined Path Risk</p>
              <p className="text-2xl font-bold text-foreground">{route.riskScore}%</p>
            </div>
            <Badge className={riskLevel.color}>{riskLevel.label} Risk</Badge>
          </div>

          {/* Risk Breakdown */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Risk Breakdown</p>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Customs & Tariffs</span>
                  <span className="font-medium">{mockPathDetails.customsRisk}%</span>
                </div>
                <Progress value={mockPathDetails.customsRisk} className="mt-1 h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Weather Disruption</span>
                  <span className="font-medium">{mockPathDetails.weatherRisk}%</span>
                </div>
                <Progress value={mockPathDetails.weatherRisk} className="mt-1 h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Security & Geopolitical</span>
                  <span className="font-medium">{mockPathDetails.securityRisk}%</span>
                </div>
                <Progress value={mockPathDetails.securityRisk} className="mt-1 h-2" />
              </div>
            </div>
          </div>

          <Separator />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Transit Time</span>
              </div>
              <p className="mt-1 text-sm font-medium">{mockPathDetails.transitTime}</p>
            </div>
            <div className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Reliability</span>
              </div>
              <p className="mt-1 text-sm font-medium">{mockPathDetails.carrierReliability}%</p>
            </div>
          </div>

          {/* Volume Trend */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Volume Change (30d)</p>
                <p className="text-sm font-medium">
                  {mockPathDetails.volumeChange > 0 ? "+" : ""}
                  {mockPathDetails.volumeChange}%
                </p>
              </div>
            </div>
            {mockPathDetails.volumeChange > 0 ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>

          {/* Recent Alert */}
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            <div>
              <p className="text-xs font-medium text-destructive">Recent Incident</p>
              <p className="text-xs text-muted-foreground">{mockPathDetails.lastIncident}</p>
            </div>
          </div>

          {/* Route Info */}
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Route Details</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: route.productColor }}
                />
                <span className="text-sm font-medium">{route.productName}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="text-xs capitalize">
                  {route.fromItem}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" className="text-xs capitalize">
                  {route.toItem}
                </Badge>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1">
              View Alternatives ({mockPathDetails.alternativeRoutes})
            </Button>
            <Button size="sm" className="flex-1">
              Full Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
