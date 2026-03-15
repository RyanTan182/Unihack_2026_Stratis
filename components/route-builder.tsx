"use client"

import { useState } from "react"
import {
  X,
  Plus,
  Route,
  AlertTriangle,
  CheckCircle,
  ArrowDown,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn, formatRisk } from "@/lib/utils"
import { EmptyState } from "@/components/ui/empty-state"

interface CountryRisk {
  id: string
  name: string
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
  coordinates?: [number, number]
}

interface RouteWaypoint {
  id: string
  country: CountryRisk
  type: "origin" | "transit" | "destination"
}

interface CustomRoute {
  id: string
  waypoints: RouteWaypoint[]
  totalRisk: number
  segmentRisks: number[]
}

interface RouteBuilderProps {
  isOpen: boolean
  onClose: () => void
  countryRisks: CountryRisk[]
  customRoute: CustomRoute | null
  onRouteChange: (route: CustomRoute | null) => void
}

// Country coordinates for visualization
const countryCoordinates: Record<string, [number, number]> = {
  "China": [104.2, 35.86],
  "United States": [-95.71, 37.09],
  "Germany": [10.45, 51.17],
  "India": [78.96, 20.59],
  "Vietnam": [108.28, 14.06],
  "Brazil": [-51.93, -14.24],
  "Indonesia": [113.92, -0.79],
  "Japan": [138.25, 36.2],
  "South Korea": [127.77, 35.91],
  "Mexico": [-102.55, 23.63],
  "Russia": [105.32, 61.52],
  "Ukraine": [31.17, 48.38],
  "Taiwan": [120.96, 23.7],
  "Saudi Arabia": [45.08, 23.89],
  "South Africa": [22.94, -30.56],
  "Turkey": [35.24, 38.96],
  "Thailand": [100.99, 15.87],
  "Malaysia": [101.98, 4.21],
  "Singapore": [103.82, 1.35],
  "Netherlands": [5.29, 52.13],
  "United Kingdom": [-3.44, 55.38],
  "France": [2.21, 46.23],
  "Italy": [12.57, 41.87],
  "Spain": [-3.75, 40.46],
  "Australia": [133.78, -25.27],
  "Canada": [-106.35, 56.13],
  "Egypt": [30.8, 26.82],
  "Nigeria": [8.68, 9.08],
  "Argentina": [-63.62, -38.42],
  "Chile": [-71.54, -35.68],
  "Poland": [19.15, 51.92],
  "Bangladesh": [90.36, 23.68],
  "Pakistan": [69.35, 30.38],
  "Philippines": [121.77, 12.88],
  "Iran": [53.69, 32.43],
}

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-400" }
}

const calculateRouteRisk = (waypoints: RouteWaypoint[]): { totalRisk: number; segmentRisks: number[] } => {
  if (waypoints.length < 2) return { totalRisk: 0, segmentRisks: [] }

  const segmentRisks: number[] = []

  for (let i = 0; i < waypoints.length - 1; i++) {
    const origin = waypoints[i].country
    const destination = waypoints[i + 1].country

    // Segment risk calculation: weighted average of export risk from origin and import risk to destination
    // Plus a transit complexity factor
    const baseRisk = (origin.exportRisk * 0.4 + destination.importRisk * 0.4 + origin.overallRisk * 0.1 + destination.overallRisk * 0.1)

    // Add complexity factor for transit countries (middle waypoints)
    const transitFactor = waypoints[i].type === "transit" ? 1.1 : 1
    const segmentRisk = Math.min(100, Math.round(baseRisk * transitFactor))
    segmentRisks.push(segmentRisk)
  }

  // Total route risk: weighted average favoring highest risk segments
  // This ensures a single high-risk segment significantly impacts total risk
  const sortedRisks = [...segmentRisks].sort((a, b) => b - a)
  let totalRisk = 0
  let weight = 1
  let totalWeight = 0

  for (const risk of sortedRisks) {
    totalRisk += risk * weight
    totalWeight += weight
    weight *= 0.7 // Decreasing weights for lower risk segments
  }

  return {
    totalRisk: Math.round(totalRisk / totalWeight),
    segmentRisks,
  }
}

export function RouteBuilder({
  isOpen,
  onClose,
  countryRisks,
  customRoute,
  onRouteChange,
}: RouteBuilderProps) {
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>(
    customRoute?.waypoints || []
  )
  const [isDetailsOpen, setIsDetailsOpen] = useState(true)

  const availableCountries = countryRisks.map((c) => ({
    ...c,
    coordinates: countryCoordinates[c.name] || [0, 0],
  }))

  const addWaypoint = (countryId: string) => {
    const country = availableCountries.find((c) => c.id === countryId)
    if (!country) return

    const newWaypoint: RouteWaypoint = {
      id: `wp-${Date.now()}`,
      country: country,
      type: waypoints.length === 0 ? "origin" : "transit",
    }

    const updatedWaypoints = [...waypoints, newWaypoint].map((wp, idx, arr) => ({
      ...wp,
      type: idx === 0 ? "origin" as const : idx === arr.length - 1 ? "destination" as const : "transit" as const,
    }))

    setWaypoints(updatedWaypoints)
    updateRoute(updatedWaypoints)
  }

  const removeWaypoint = (waypointId: string) => {
    const updatedWaypoints = waypoints
      .filter((wp) => wp.id !== waypointId)
      .map((wp, idx, arr) => ({
        ...wp,
        type: idx === 0 ? "origin" as const : idx === arr.length - 1 ? "destination" as const : "transit" as const,
      }))

    setWaypoints(updatedWaypoints)
    updateRoute(updatedWaypoints)
  }

  const moveWaypoint = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= waypoints.length) return

    const newWaypoints = [...waypoints]
    const [movedItem] = newWaypoints.splice(fromIndex, 1)
    newWaypoints.splice(toIndex, 0, movedItem)

    const updatedWaypoints = newWaypoints.map((wp, idx, arr) => ({
      ...wp,
      type: idx === 0 ? "origin" as const : idx === arr.length - 1 ? "destination" as const : "transit" as const,
    }))

    setWaypoints(updatedWaypoints)
    updateRoute(updatedWaypoints)
  }

  const updateRoute = (wps: RouteWaypoint[]) => {
    if (wps.length < 2) {
      onRouteChange(null)
      return
    }

    const { totalRisk, segmentRisks } = calculateRouteRisk(wps)

    onRouteChange({
      id: "custom-route",
      waypoints: wps,
      totalRisk,
      segmentRisks,
    })
  }

  const clearRoute = () => {
    setWaypoints([])
    onRouteChange(null)
  }

  const { totalRisk, segmentRisks } = calculateRouteRisk(waypoints)
  const riskLevel = getRiskLevel(totalRisk)

  if (!isOpen) return null

  return (
    <div className="absolute right-4 top-20 z-20 w-[380px] animate-in slide-in-from-right-4 duration-300">
      <Card className="max-h-[calc(100vh-6rem)] overflow-hidden border-primary/20 glass-panel shadow-2xl">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <Route className="h-5 w-5 text-primary" />
                Route Builder
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Create multi-country supply chain routes
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted/50">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="max-h-[calc(100vh-16rem)] space-y-4 overflow-y-auto p-4">
          {/* Add Country */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Add Country</label>
            <Select onValueChange={addWaypoint}>
              <SelectTrigger className="h-10 border-border/50 bg-muted/30 transition-colors focus:border-primary/50">
                <SelectValue placeholder="Select a country..." />
              </SelectTrigger>
              <SelectContent className="glass-panel border-primary/20">
                {availableCountries
                  .filter((c) => !waypoints.find((wp) => wp.country.id === c.id))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((country) => (
                    <SelectItem key={country.id} value={country.id} className="focus:bg-primary/10">
                      <div className="flex items-center justify-between gap-4">
                        <span>{country.name}</span>
                        <span className={cn("text-xs font-medium", getRiskLevel(country.overallRisk).textColor)}>
                          {formatRisk(country.overallRisk)}%
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Separator className="bg-border/50" />

          {/* Waypoints List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-foreground">
                Route ({waypoints.length} stops)
              </label>
              {waypoints.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRoute}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {waypoints.length === 0 ? (
              <EmptyState
                icon={<Route className="h-7 w-7 text-muted-foreground/50" />}
                title="No route created"
                description="Add at least 2 countries to build a supply chain route"
              />
            ) : (
              <div className="space-y-1">
                {waypoints.map((waypoint, index) => {
                  const segmentRisk = index > 0 ? segmentRisks[index - 1] : null
                  return (
                    <div key={waypoint.id}>
                      {/* Segment Risk Indicator */}
                      {index > 0 && segmentRisk !== null && (
                        <div className="flex items-center gap-2 py-1.5 pl-4">
                          <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                          <div className="flex-1 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">
                                Segment Risk
                              </span>
                              <span className={cn("text-xs font-medium", getRiskLevel(segmentRisk).textColor)}>
                                {formatRisk(segmentRisk)}%
                              </span>
                            </div>
                            <Progress value={segmentRisk} className="mt-1 h-1" />
                          </div>
                        </div>
                      )}

                      {/* Waypoint Card */}
                      <div className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card/50 p-2.5 transition-all hover:border-primary/30 hover:bg-card/80">
                        <div className="flex flex-col gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                            onClick={() => moveWaypoint(index, "up")}
                            disabled={index === 0}
                            aria-label={`Move ${waypoint.country.name} up`}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                            onClick={() => moveWaypoint(index, "down")}
                            disabled={index === waypoints.length - 1}
                            aria-label={`Move ${waypoint.country.name} down`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold border",
                          waypoint.type === "origin" ? "border-emerald-500/50 bg-emerald-500 text-white" :
                          waypoint.type === "destination" ? "border-red-500/50 bg-red-500 text-white" :
                          "border-primary/50 bg-primary text-primary-foreground"
                        )}>
                          {index + 1}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground text-sm truncate">
                              {waypoint.country.name}
                            </span>
                            <span className={cn(
                              "text-[10px] font-medium capitalize px-1.5 py-0.5 rounded border",
                              waypoint.type === "origin" ? "border-emerald-500/50 text-emerald-400" :
                              waypoint.type === "destination" ? "border-red-500/50 text-red-400" :
                              "border-border text-muted-foreground"
                            )}>
                              {waypoint.type}
                            </span>
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                            <span>Import: {formatRisk(waypoint.country.importRisk)}%</span>
                            <span>Export: {formatRisk(waypoint.country.exportRisk)}%</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-400 transition-all"
                          onClick={() => removeWaypoint(waypoint.id)}
                          aria-label={`Remove ${waypoint.country.name} from route`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Risk Analysis */}
          {waypoints.length >= 2 && (
            <>
              <Separator className="bg-border/50" />

              <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                    <span className="text-xs font-medium text-foreground">Route Risk Analysis</span>
                    {isDetailsOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Total Risk Score */}
                  <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Route Risk</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{formatRisk(totalRisk)}%</p>
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                          riskLevel.color
                        )}>
                          {riskLevel.label}
                        </span>
                        <div className="mt-2 flex items-center gap-1.5 justify-end">
                          {totalRisk >= 60 ? (
                            <AlertTriangle className="h-4 w-4 text-orange-400" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-emerald-400" />
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {totalRisk >= 60 ? "High risk" : "Acceptable"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Progress value={totalRisk} className="mt-4 h-2" />
                  </div>

                  {/* Risk Factors */}
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-foreground">Risk Factors</p>

                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Countries in route</span>
                        <span className="font-medium text-foreground">{waypoints.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transit countries</span>
                        <span className="font-medium text-foreground">
                          {waypoints.filter((wp) => wp.type === "transit").length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Highest segment risk</span>
                        <span className={cn("font-medium", getRiskLevel(Math.max(...segmentRisks)).textColor)}>
                          {Math.max(...segmentRisks)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lowest segment risk</span>
                        <span className={cn("font-medium", getRiskLevel(Math.min(...segmentRisks)).textColor)}>
                          {Math.min(...segmentRisks)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* News Highlights from Route */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">Key Risk News</p>
                    <div className="max-h-32 space-y-1.5 overflow-y-auto">
                      {waypoints
                        .flatMap((wp) =>
                          wp.country.newsHighlights.slice(0, 1).map((news) => ({
                            country: wp.country.name,
                            news,
                          }))
                        )
                        .slice(0, 5)
                        .map((item, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border border-border/50 bg-card/50 p-2 text-xs"
                          >
                            <span className="font-medium text-primary">{item.country}:</span>{" "}
                            <span className="text-muted-foreground">{item.news}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { countryCoordinates }
export type { CustomRoute, RouteWaypoint }
