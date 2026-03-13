"use client"

import { useState } from "react"
import {
  X,
  Plus,
  GripVertical,
  Route,
  AlertTriangle,
  CheckCircle,
  ArrowDown,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-600" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-600" }
  if (score >= 40) return { label: "Medium", color: "bg-yellow-500 text-foreground", textColor: "text-yellow-600" }
  if (score >= 20) return { label: "Low", color: "bg-green-500 text-white", textColor: "text-green-600" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-600" }
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
    <div className="absolute right-4 top-16 z-20 w-96 animate-in slide-in-from-right-4">
      <Card className="max-h-[calc(100vh-8rem)] overflow-hidden border-border bg-card/95 shadow-xl backdrop-blur-sm">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Route className="h-5 w-5 text-primary" />
                Route Builder
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Create a multi-country supply chain route
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="max-h-[calc(100vh-16rem)] space-y-4 overflow-y-auto">
          {/* Add Country */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Add Country to Route</label>
            <Select onValueChange={addWaypoint}>
              <SelectTrigger>
                <SelectValue placeholder="Select a country..." />
              </SelectTrigger>
              <SelectContent>
                {availableCountries
                  .filter((c) => !waypoints.find((wp) => wp.country.id === c.id))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((country) => (
                    <SelectItem key={country.id} value={country.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{country.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${getRiskLevel(country.overallRisk).textColor}`}
                        >
                          {country.overallRisk}%
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Waypoints List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Route Waypoints ({waypoints.length})
              </label>
              {waypoints.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRoute}
                  className="h-7 text-xs text-muted-foreground"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>

            {waypoints.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <Route className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Add countries to build your route
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Minimum 2 countries required
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {waypoints.map((waypoint, index) => {
                  const segmentRisk = index > 0 ? segmentRisks[index - 1] : null
                  return (
                    <div key={waypoint.id}>
                      {/* Segment Risk Indicator */}
                      {index > 0 && segmentRisk !== null && (
                        <div className="flex items-center gap-2 py-1 pl-4">
                          <div className="flex h-6 w-6 items-center justify-center">
                            <ArrowDown className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 rounded border border-border bg-muted/30 px-2 py-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Segment Risk
                              </span>
                              <span className={`text-xs font-medium ${getRiskLevel(segmentRisk).textColor}`}>
                                {segmentRisk}%
                              </span>
                            </div>
                            <Progress value={segmentRisk} className="mt-1 h-1" />
                          </div>
                        </div>
                      )}

                      {/* Waypoint Card */}
                      <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 transition-colors hover:bg-accent/50">
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => moveWaypoint(index, "up")}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => moveWaypoint(index, "down")}
                            disabled={index === waypoints.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>

                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-xs font-bold text-primary">{index + 1}</span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">
                              {waypoint.country.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-xs capitalize"
                            >
                              {waypoint.type}
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>Import: {waypoint.country.importRisk}%</span>
                            <span>Export: {waypoint.country.exportRisk}%</span>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeWaypoint(waypoint.id)}
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
              <Separator />

              <Collapsible open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between p-0 hover:bg-transparent">
                    <span className="text-sm font-medium">Route Risk Analysis</span>
                    {isDetailsOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-4">
                  {/* Total Risk Score */}
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Total Route Risk</p>
                        <p className="text-3xl font-bold text-foreground">{totalRisk}%</p>
                      </div>
                      <div className="text-right">
                        <Badge className={riskLevel.color}>{riskLevel.label}</Badge>
                        <div className="mt-2 flex items-center gap-1">
                          {totalRisk >= 60 ? (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span className="text-xs text-muted-foreground">
                            {totalRisk >= 60 ? "High risk route" : "Acceptable risk"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Progress value={totalRisk} className="mt-3 h-2" />
                  </div>

                  {/* Risk Factors */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Risk Factors</p>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Countries in route</span>
                        <span className="font-medium">{waypoints.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transit countries</span>
                        <span className="font-medium">
                          {waypoints.filter((wp) => wp.type === "transit").length}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Highest segment risk</span>
                        <span className={`font-medium ${getRiskLevel(Math.max(...segmentRisks)).textColor}`}>
                          {Math.max(...segmentRisks)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Lowest segment risk</span>
                        <span className={`font-medium ${getRiskLevel(Math.min(...segmentRisks)).textColor}`}>
                          {Math.min(...segmentRisks)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* News Highlights from Route */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Key Risk News</p>
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
                            className="rounded border border-border bg-card p-2 text-xs"
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
