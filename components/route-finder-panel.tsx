"use client"

import { useState, useEffect } from "react"
import {
  X,
  Route,
  Search,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { findRoutes } from "@/lib/route-finder"
import type { FoundRoute, FindOptions } from "@/lib/route-types"
import type { CountryRiskData } from "@/lib/route-types"

interface RouteFinderPanelProps {
  isOpen: boolean
  onClose: () => void
  countryRisks: CountryRiskData[]
  onRouteFound?: (routes: FoundRoute[]) => void
  preselectedOrigin?: string
  preselectedDestination?: string
}

const CHOKEPOINTS = [
  { id: "Strait of Hormuz", name: "Hormuz", risk: 78 },
  { id: "Bab-el-Mandeb", name: "Bab-el-Mandeb", risk: 83 },
  { id: "Suez Canal", name: "Suez Canal", risk: 64 },
  { id: "Strait of Malacca", name: "Malacca", risk: 61 },
  { id: "Panama Canal", name: "Panama", risk: 58 },
  { id: "Bosphorus", name: "Bosphorus", risk: 57 },
]

export function RouteFinderPanel({
  isOpen,
  onClose,
  countryRisks,
  onRouteFound,
  preselectedOrigin,
  preselectedDestination,
}: RouteFinderPanelProps) {
  const [origin, setOrigin] = useState<string>("")
  const [destination, setDestination] = useState<string>("")
  const [excludedChokepoints, setExcludedChokepoints] = useState<string[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [foundRoutes, setFoundRoutes] = useState<FoundRoute[]>([])
  const [error, setError] = useState<string | null>(null)

  // Update state when preselected values change
  useEffect(() => {
    if (preselectedOrigin) setOrigin(preselectedOrigin)
    if (preselectedDestination) setDestination(preselectedDestination)
    if (preselectedOrigin || preselectedDestination) {
      setFoundRoutes([])
      setError(null)
    }
  }, [preselectedOrigin, preselectedDestination])

  const countries = countryRisks
    .filter((c) => c.type === "country")
    .sort((a, b) => a.name.localeCompare(b.name))

  const handleFindRoutes = async () => {
    if (!origin || !destination) {
      setError("Select both origin and destination")
      return
    }
    if (origin === destination) {
      setError("Origin and destination must differ")
      return
    }

    setIsSearching(true)
    setError(null)
    setFoundRoutes([])

    try {
      const options: FindOptions = {
        excludeChokepoints: excludedChokepoints,
        maxWaypoints: 6,
        maxRoutes: 3,
      }
      const result = findRoutes(origin, destination, options)

      if (result.success && result.routes.length > 0) {
        setFoundRoutes(result.routes)
        onRouteFound?.(result.routes)
      } else {
        setError(result.error || "No routes found")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to find routes")
    } finally {
      setIsSearching(false)
    }
  }

  const toggleChokepoint = (id: string) => {
    setExcludedChokepoints((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 60) return "text-orange-500"
    if (risk >= 40) return "text-yellow-500"
    return "text-emerald-500"
  }

  if (!isOpen) return null

  return (
    <div className="p-4">
      <div className="border-primary/20 glass-panel shadow-2xl overflow-y-auto p-6 rounded-lg">
        <div className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base">
              <Route className="h-5 w-5 text-primary" />
              Route Finder
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Simple Input Section */}
          <div className="space-y-2">
            <Select value={origin} onValueChange={setOrigin}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="From country..." />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="To country..." />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Find Button - Primary CTA */}
          <Button
            onClick={handleFindRoutes}
            disabled={!origin || !destination || isSearching}
            className={cn(
              "w-full h-10 font-medium",
              origin && destination && !isSearching
                ? "bg-primary hover:bg-primary/90"
                : "bg-muted"
            )}
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Finding...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Find Safest Route
              </>
            )}
          </Button>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg p-2">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Results - Simplified */}
          {foundRoutes.length > 0 && (
            <div className="space-y-2 pt-2">
              {/* Recommended Route - Hero Style */}
              {foundRoutes.filter((r) => r.isRecommended).map((route) => (
                <div
                  key={route.id}
                  className="rounded-xl border-2 border-primary/50 bg-primary/5 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge className="text-xs gap-1">
                      <Shield className="h-3 w-3" />
                      Recommended
                    </Badge>
                    <span className={cn("text-xl font-bold", getRiskColor(route.totalRisk))}>
                      {route.totalRisk}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {route.nodes.map((n) => n.name).join(" → ")}
                  </div>
                  {route.estimatedDays && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ~{route.estimatedDays} days
                    </div>
                  )}
                </div>
              ))}

              {/* Alternative Routes - Compact */}
              {foundRoutes.filter((r) => !r.isRecommended).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">Alternatives</div>
                  {foundRoutes
                    .filter((r) => !r.isRecommended)
                    .map((route, i) => (
                      <div
                        key={route.id}
                        className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <div className="truncate flex-1 mr-2">
                          {route.nodes.map((n) => n.name).join(" → ")}
                        </div>
                        <span className={cn("font-medium", getRiskColor(route.totalRisk))}>
                          {route.totalRisk}%
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Advanced Options - Collapsible */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-1"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Avoid chokepoints
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-2 gap-1.5 p-2 rounded-lg bg-muted/20 border border-border/30">
              {CHOKEPOINTS.map((cp) => (
                <label
                  key={cp.id}
                  className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/30 rounded p-1 transition-colors"
                >
                  <Checkbox
                    checked={excludedChokepoints.includes(cp.id)}
                    onCheckedChange={() => toggleChokepoint(cp.id)}
                    className="h-3.5 w-3.5"
                  />
                  <span>{cp.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
