"use client"

import { useState, useMemo } from "react"
import {
  X,
  MapPin,
  ArrowRight,
  Ship,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Route,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Product, SupplyChainItem } from "@/components/product-supply-chain"
import type { CountryRiskData } from "@/lib/route-types"
import { findRoutes } from "@/lib/route-finder"
import { getRiskLevel } from "@/lib/risk-calculator"

interface RouteInfo {
  componentId: string
  componentName: string
  origin: string
  destination: string
  risk: number
  days: string
  chokepoints: string[]
  isValid: boolean
}

interface RouteSummaryProps {
  isOpen: boolean
  onClose: () => void
  products: Product[]
  countryRisks: CountryRiskData[]
  onRouteClick?: (origin: string, destination: string) => void
  onCalculateAllRoutes?: () => void
}

type SortField = 'component' | 'origin' | 'destination' | 'risk' | 'days'
type SortOrder = 'asc' | 'desc'

export function RouteSummary({
  isOpen,
  onClose,
  products,
  countryRisks,
  onRouteClick,
  onCalculateAllRoutes,
}: RouteSummaryProps) {
  const [sortField, setSortField] = useState<SortField>('risk')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isCalculating, setIsCalculating] = useState(false)
  const [selectedRow, setSelectedRow] = useState<string | null>(null)

  // Extract all routes from products
  const routes = useMemo(() => {
    const routeList: RouteInfo[] = []

    const processItem = (
      item: SupplyChainItem,
      destination: string,
      productId: string
    ) => {
      // Calculate route from this item to destination
      let routeRisk = 50 // Default
      let routeDays = "~14"
      let chokepoints: string[] = []
      let isValid = true

      try {
        const routeResult = findRoutes(item.country, destination, { maxRoutes: 1 })
        if (routeResult.success && routeResult.routes.length > 0) {
          const route = routeResult.routes[0]
          routeRisk = route.totalRisk
          routeDays = route.estimatedDays || "~14"
          chokepoints = route.chokepointsUsed
        } else {
          isValid = false
        }
      } catch {
        isValid = false
      }

      routeList.push({
        componentId: item.id,
        componentName: item.name || item.type,
        origin: item.country,
        destination,
        risk: routeRisk,
        days: routeDays,
        chokepoints,
        isValid,
      })

      // Process children - they route to their parent
      if (item.children) {
        item.children.forEach(child => processItem(child, item.country, productId))
      }
    }

    products.forEach(product => {
      const destination = product.destinationCountry || 'United States'
      product.components.forEach(comp => processItem(comp, destination, product.id))
    })

    return routeList
  }, [products])

  // Sort routes
  const sortedRoutes = useMemo(() => {
    return [...routes].sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'component':
          comparison = a.componentName.localeCompare(b.componentName)
          break
        case 'origin':
          comparison = a.origin.localeCompare(b.origin)
          break
        case 'destination':
          comparison = a.destination.localeCompare(b.destination)
          break
        case 'risk':
          comparison = a.risk - b.risk
          break
        case 'days':
          comparison = parseFloat(a.days.replace('~', '')) - parseFloat(b.days.replace('~', ''))
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [routes, sortField, sortOrder])

  // Calculate statistics
  const stats = useMemo(() => {
    const validRoutes = routes.filter(r => r.isValid)
    const highRisk = validRoutes.filter(r => r.risk >= 60)
    const avgRisk = validRoutes.length > 0
      ? Math.round(validRoutes.reduce((sum, r) => sum + r.risk, 0) / validRoutes.length)
      : 0

    return {
      total: routes.length,
      valid: validRoutes.length,
      highRisk: highRisk.length,
      avgRisk,
    }
  }, [routes])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortOrder === 'asc'
      ? <ChevronUp className="h-3 w-3" />
      : <ChevronDown className="h-3 w-3" />
  }

  const handleCalculateAll = async () => {
    setIsCalculating(true)
    try {
      onCalculateAllRoutes?.()
    } finally {
      setTimeout(() => setIsCalculating(false), 500)
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute right-4 top-100 z-20 w-[380px] animate-in slide-in-from-right-4">
      <Card className="max-h-[calc(100vh-6rem)] overflow-hidden border-border/50 bg-card/60 shadow-2xl backdrop-blur-xl">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Route className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Route Summary</h2>
                <p className="text-xs text-muted-foreground">
                  {stats.valid} of {stats.total} routes calculated
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 border-b border-border/50 px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-muted-foreground">
                <span className="font-semibold text-red-400">{stats.highRisk}</span> high risk
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-muted-foreground">
                Avg: <span className={cn(
                  "font-semibold",
                  stats.avgRisk >= 60 ? "text-red-400" :
                  stats.avgRisk >= 40 ? "text-yellow-400" : "text-emerald-400"
                )}>{stats.avgRisk}%</span>
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs gap-1.5"
              onClick={handleCalculateAll}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Ship className="h-3 w-3" />
              )}
              View All Routes
            </Button>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-[1fr_70px_70px_50px_50px] gap-1 border-b border-border/50 px-3 py-2 bg-muted/10 text-xs font-medium text-muted-foreground">
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
              onClick={() => toggleSort('component')}
            >
              Component
              <SortIcon field="component" />
            </button>
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
              onClick={() => toggleSort('origin')}
            >
              Origin
              <SortIcon field="origin" />
            </button>
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
              onClick={() => toggleSort('destination')}
            >
              Dest.
              <SortIcon field="destination" />
            </button>
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
              onClick={() => toggleSort('risk')}
            >
              Risk
              <SortIcon field="risk" />
            </button>
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors text-left"
              onClick={() => toggleSort('days')}
            >
              Days
              <SortIcon field="days" />
            </button>
          </div>

          {/* Table Body */}
          <div className="max-h-[400px] overflow-y-auto">
            {sortedRoutes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Route className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No routes to display</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Add products with components to see route analysis
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {sortedRoutes.map((route) => {
                  const riskInfo = getRiskLevel(route.risk)
                  const isSelected = selectedRow === route.componentId

                  return (
                    <button
                      key={route.componentId}
                      className={cn(
                        "w-full grid grid-cols-[1fr_70px_70px_50px_50px] gap-1 px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-primary/5 border-l-2 border-l-primary"
                          : "hover:bg-muted/30"
                      )}
                      onClick={() => {
                        setSelectedRow(route.componentId)
                        onRouteClick?.(route.origin, route.destination)
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs font-medium text-foreground truncate">
                          {route.componentName}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate">{route.origin}</span>
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <ArrowRight className="h-2.5 w-2.5" />
                        <span className="truncate">{route.destination}</span>
                      </div>
                      <Badge
                        className={cn("text-[9px] font-mono border-0 px-1", riskInfo.color)}
                        variant="outline"
                      >
                        {route.risk}%
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{route.days}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {sortedRoutes.length > 0 && (
            <div className="border-t border-border/50 p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Click a row to highlight the route on the map
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-muted-foreground">&lt;40%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                    <span className="text-muted-foreground">40-60%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-muted-foreground">&gt;60%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
