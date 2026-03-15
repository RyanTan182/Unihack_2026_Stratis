"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  X,
  Package,
  MapPin,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Navigation,
  Loader2,
  TrendingDown,
  ArrowRight,
  Route,
  Layers,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { StoredProduct, SupplyChainNode } from "@/lib/decompose/types"
import type { FoundRoute, CountryRiskData } from "@/lib/route-types"
import { findRoutes } from "@/lib/route-finder"

interface ComponentRoute {
  nodeId: string
  nodeName: string
  nodeType: string
  sourceCountry: string
  sourcePercentage: number
  destinationCountry: string
  route: FoundRoute | null
  routeRisk: number
  isLoading: boolean
  error?: string
}

interface ProductSupplyChainRoutesPanelProps {
  isOpen: boolean
  onClose: () => void
  product: StoredProduct | null
  countryRisks: CountryRiskData[]
  onVisualizeRoutes?: (routes: FoundRoute[]) => void
  onViewAlternatives?: (componentId: string, sourceCountry: string, destinationCountry: string) => void
}

export function ProductSupplyChainRoutesPanel({
  isOpen,
  onClose,
  product,
  countryRisks,
  onVisualizeRoutes,
  onViewAlternatives,
}: ProductSupplyChainRoutesPanelProps) {
  const [componentRoutes, setComponentRoutes] = useState<ComponentRoute[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set())

  // Use refs for callbacks to avoid dependency issues
  const onVisualizeRoutesRef = useRef(onVisualizeRoutes)
  useEffect(() => {
    onVisualizeRoutesRef.current = onVisualizeRoutes
  }, [onVisualizeRoutes])

  // Extract all leaf components with geographic concentration
  const componentsWithGeo = useMemo(() => {
    if (!product) return []

    const components: { node: SupplyChainNode; depth: number }[] = []

    const traverse = (nodeId: string, depth: number) => {
      const node = product.tree.nodes[nodeId]
      if (!node) return

      // Only include nodes that have geographic concentration data
      if (Object.keys(node.geographic_concentration).length > 0) {
        components.push({ node, depth })
      }

      // Traverse children
      node.children.forEach(childId => traverse(childId, depth + 1))
    }

    traverse(product.tree.root_id, 0)
    return components
  }, [product])

  // Calculate routes for all components
  useEffect(() => {
    if (!isOpen || !product || !product.destinationCountry) {
      setComponentRoutes([])
      return
    }

    setIsLoading(true)

    // Initialize with loading state
    const initialRoutes: ComponentRoute[] = componentsWithGeo.map(({ node }) => {
      const geoEntries = Object.entries(node.geographic_concentration).sort((a, b) => b[1] - a[1])
      const primaryCountry = geoEntries[0]?.[0] || ""

      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        sourceCountry: primaryCountry,
        sourcePercentage: geoEntries[0]?.[1] || 0,
        destinationCountry: product.destinationCountry || "",
        route: null,
        routeRisk: 0,
        isLoading: true,
      }
    })

    setComponentRoutes(initialRoutes)

    // Calculate routes asynchronously
    const destinationId = countryRisks.find(c => c.name === product.destinationCountry)?.id

    if (!destinationId) {
      setComponentRoutes(prev => prev.map(r => ({ ...r, isLoading: false, error: "Destination not found" })))
      setIsLoading(false)
      return
    }

    // Process routes
    const calculateRoutes = async () => {
      const results: ComponentRoute[] = []

      for (const comp of initialRoutes) {
        const originId = countryRisks.find(c => c.name === comp.sourceCountry)?.id

        if (!originId) {
          results.push({
            ...comp,
            isLoading: false,
            error: `Country "${comp.sourceCountry}" not found`,
          })
          continue
        }

        try {
          const routeResult = findRoutes(originId, destinationId, { maxRoutes: 1 })

          if (routeResult.success && routeResult.routes.length > 0) {
            const bestRoute = routeResult.routes[0]
            results.push({
              ...comp,
              route: bestRoute,
              routeRisk: bestRoute.totalRisk,
              isLoading: false,
            })
          } else {
            results.push({
              ...comp,
              isLoading: false,
              error: routeResult.error || "No route found",
            })
          }
        } catch (err) {
          results.push({
            ...comp,
            isLoading: false,
            error: err instanceof Error ? err.message : "Failed to calculate route",
          })
        }
      }

      setComponentRoutes(results)
      setIsLoading(false)

      // Notify parent about all routes for visualization
      const validRoutes = results.filter(r => r.route).map(r => r.route!)
      if (validRoutes.length > 0) {
        onVisualizeRoutesRef.current?.(validRoutes)
      }
    }

    calculateRoutes()
  }, [isOpen, product, componentsWithGeo, countryRisks])

  // Calculate aggregated stats
  const stats = useMemo(() => {
    if (componentRoutes.length === 0) return null

    const loaded = componentRoutes.filter(r => !r.isLoading && r.route)
    const avgRisk = loaded.length > 0
      ? Math.round(loaded.reduce((sum, r) => sum + r.routeRisk, 0) / loaded.length)
      : 0

    const highRisk = loaded.filter(r => r.routeRisk >= 60)
    const mediumRisk = loaded.filter(r => r.routeRisk >= 40 && r.routeRisk < 60)
    const lowRisk = loaded.filter(r => r.routeRisk < 40)

    return {
      totalComponents: componentRoutes.length,
      loadedComponents: loaded.length,
      avgRisk,
      highRiskCount: highRisk.length,
      mediumRiskCount: mediumRisk.length,
      lowRiskCount: lowRisk.length,
    }
  }, [componentRoutes])

  const toggleExpanded = (nodeId: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const getRiskColor = (risk: number) => {
    if (risk >= 60) return "text-red-400"
    if (risk >= 40) return "text-amber-400"
    return "text-emerald-400"
  }

  const getRiskBg = (risk: number) => {
    if (risk >= 60) return "bg-red-500/10"
    if (risk >= 40) return "bg-amber-500/10"
    return "bg-emerald-500/10"
  }

  if (!isOpen || !product) return null

  return (
    <div
      className="absolute bottom-4 z-20 w-80 max-h-[60vh] rounded-xl border border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200"
      style={{ left: 'calc(var(--sidebar-width, 320px) + 16px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <Route className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">{product.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {product.destinationCountry ? `→ ${product.destinationCountry}` : "No destination"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 w-6 rounded-full hover:bg-muted cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 rounded-full hover:bg-muted cursor-pointer"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Stats Summary - Always visible */}
      <div className="grid grid-cols-3 gap-1 p-2 border-b border-border/30 bg-muted/10">
        <div className="text-center px-2 py-1.5">
          <p className="text-lg font-bold text-sidebar-foreground">{stats?.totalComponents || 0}</p>
          <p className="text-[9px] text-muted-foreground">Components</p>
        </div>
        <div className="text-center px-2 py-1.5">
          <p className={cn("text-lg font-bold", getRiskColor(stats?.avgRisk || 0))}>
            {stats?.avgRisk || 0}%
          </p>
          <p className="text-[9px] text-muted-foreground">Avg Risk</p>
        </div>
        <div className="text-center px-2 py-1.5">
          <p className="text-lg font-bold text-red-400">{stats?.highRiskCount || 0}</p>
          <p className="text-[9px] text-muted-foreground">High Risk</p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-4">
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Calculating routes...</span>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {isExpanded && !isLoading && (
        <div className="flex-1 overflow-y-auto max-h-[40vh]">
          <div className="p-2 space-y-1.5">
            {componentRoutes.length === 0 ? (
              <div className="text-center py-4">
                <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No components with geographic data</p>
              </div>
            ) : (
              componentRoutes.map((comp) => {
                const isCompExpanded = expandedComponents.has(comp.nodeId)

                return (
                  <div
                    key={comp.nodeId}
                    className={cn(
                      "rounded-lg border transition-all",
                      comp.routeRisk >= 60 ? "border-red-500/30 bg-red-500/5" :
                      comp.routeRisk >= 40 ? "border-amber-500/30 bg-amber-500/5" :
                      "border-border/50 bg-muted/30"
                    )}
                  >
                    {/* Component Header */}
                    <button
                      className="w-full flex items-center gap-2 text-left p-2 cursor-pointer"
                      onClick={() => toggleExpanded(comp.nodeId)}
                    >
                      <div className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded",
                        getRiskBg(comp.routeRisk)
                      )}>
                        <Package className={cn("h-3 w-3", getRiskColor(comp.routeRisk))} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{comp.nodeName}</p>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">
                            {comp.sourceCountry}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {comp.isLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                        ) : comp.route ? (
                          <Badge className={cn("font-mono text-[10px] px-1.5", getRiskColor(comp.routeRisk))}>
                            {comp.routeRisk}%
                          </Badge>
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-amber-400" />
                        )}
                        {isCompExpanded ? (
                          <ChevronDown className="h-3 w-3 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Details */}
                    {isCompExpanded && comp.route && (
                      <div className="px-2 pb-2 pt-0 border-t border-border/30">
                        {/* Route Path */}
                        <div className="mb-2 mt-2">
                          <p className="text-[9px] font-medium text-muted-foreground mb-1">
                            SAFEST ROUTE
                          </p>
                          <div className="flex items-center gap-0.5 text-[10px] flex-wrap">
                            {comp.route.nodes.map((node, idx) => (
                              <span key={node.id} className="flex items-center gap-0.5">
                                {idx > 0 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/50" />}
                                <span className={cn(
                                  "px-1 py-0.5 rounded text-[9px]",
                                  node.type === 'chokepoint' ? "bg-amber-500/20 text-amber-400" : "bg-muted"
                                )}>
                                  {node.name}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-6 text-[9px] gap-1 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation()
                              onVisualizeRoutes?.([comp.route!])
                            }}
                          >
                            <Navigation className="h-2.5 w-2.5" />
                            Show on Map
                          </Button>
                          {comp.routeRisk >= 40 && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="flex-1 h-6 text-[9px] gap-1 cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation()
                                onViewAlternatives?.(comp.nodeId, comp.sourceCountry, comp.destinationCountry)
                              }}
                            >
                              <TrendingDown className="h-2.5 w-2.5" />
                              Alternatives
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error State */}
                    {isCompExpanded && comp.error && (
                      <div className="px-2 pb-2 pt-0 border-t border-border/30">
                        <div className="flex items-center gap-1.5 mt-2">
                          <AlertTriangle className="h-3 w-3 text-red-400" />
                          <span className="text-[10px] text-red-400">{comp.error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
