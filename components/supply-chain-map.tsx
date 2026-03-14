"use client"

import { useState, useMemo, useEffect } from "react"
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  ZoomableGroup,
} from "react-simple-maps"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Spinner } from "@/components/ui/spinner"
import { extractChokepointsFromPath } from "@/lib/utils"

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

interface CountryRisk {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

interface NodeConnection {
  id: string
  from: string
  to: string
  fromCoords: [number, number]
  toCoords: [number, number]
  avgRisk: number
  fromType: "country" | "chokepoint"
  toType: "country" | "chokepoint"
}

interface CustomRouteWaypoint {
  id: string
  country: {
    id: string
    name: string
    coordinates?: [number, number]
  }
  type: "origin" | "transit" | "destination"
}

interface CustomRoute {
  id: string
  waypoints: CustomRouteWaypoint[]
  totalRisk: number
  segmentRisks: number[]
}

type ItemType = "product" | "component" | "material" | "resource"

interface SupplyChainItem {
  id: string
  name: string
  type: ItemType
  country: string
  riskPrediction: number
  riskDirection: "up" | "down"
  children: SupplyChainItem[]
  isExpanded?: boolean
}

interface Product {
  id: string
  name: string
  type: "product"
  country: string
  color: string
  riskPrediction: number
  riskDirection: "up" | "down"
  components: SupplyChainItem[]
}

export interface ProductRouteSegment {
  fromNode: string
  toNode: string
  riskScore: number
  isChokepointSegment: boolean
}

export interface ProductSupplyRoute {
  id: string
  fromCountry: string
  toCountry: string
  fromItem: string
  toItem: string
  itemType: ItemType
  riskScore: number
  isDangerous: boolean
  productColor: string
  productId: string
  productName: string
  pathNodes: string[]
  segments: ProductRouteSegment[]
  chokepoints: string[]
}

interface SupplyChainMapProps {
  countryRisks: CountryRisk[]
  onCountrySelect: (countryId: string | null) => void
  selectedCountry: string | null
  customRoute?: CustomRoute | null
  products?: Product[]
  selectedRouteId?: string | null
  onRouteClick?: (route: ProductSupplyRoute) => void
}

const getRiskColor = (risk: number): string => {
  if (risk >= 80) return "#dc2626"
  if (risk >= 60) return "#ea580c"
  if (risk >= 40) return "#eab308"
  if (risk >= 20) return "#22c55e"
  return "#0ea5e9"
}

const getCountryColor = (risk: number | undefined): string => {
  if (risk === undefined) return "#e5e7eb"
  if (risk >= 80) return "#7c3aed"
  if (risk >= 60) return "#a78bfa"
  if (risk >= 40) return "#c4b5fd"
  if (risk >= 20) return "#ddd6fe"
  return "#ede9fe"
}

const nodeCoordinates: Record<string, [number, number]> = {
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
  "Panama": [-80.0, 8.54],
  "United Arab Emirates": [53.85, 23.42],
  "Oman": [57.0, 21.0],
  "Qatar": [51.18, 25.35],
  "Yemen": [48.52, 15.55],
  "Djibouti": [42.59, 11.83],
  "Greece": [21.82, 39.07],
  "Romania": [24.97, 45.94],
  "Bulgaria": [25.49, 42.73],
  "Georgia": [43.36, 42.32],
  "Peru": [-75.02, -9.19],
  "Ethiopia": [40.49, 9.15],

  "Suez Canal": [32.35, 30.7],
  "Panama Canal": [-79.58, 9.08],
  "Strait of Hormuz": [56.25, 26.57],
  "Strait of Malacca": [101.0, 3.0],
  "Bab-el-Mandeb": [43.3, 12.6],
  "Bosphorus": [29.1, 41.1],
}

function extractNodeConnections(nodes: CountryRisk[]): NodeConnection[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const edges: NodeConnection[] = []
  const seen = new Set<string>()

  for (const node of nodes) {
    const fromCoords = nodeCoordinates[node.id]
    if (!fromCoords) continue

    for (const connectedId of node.connections || []) {
      const connectedNode = nodeMap.get(connectedId)
      const toCoords = nodeCoordinates[connectedId]
      if (!connectedNode || !toCoords) continue

      const pairKey = [node.id, connectedId].sort().join("__")
      if (seen.has(pairKey)) continue
      seen.add(pairKey)

      edges.push({
        id: `edge-${node.id}-to-${connectedId}`,
        from: node.id,
        to: connectedId,
        fromCoords,
        toCoords,
        avgRisk: Math.round((node.overallRisk + connectedNode.overallRisk) / 2),
        fromType: node.type,
        toType: connectedNode.type,
      })
    }
  }

  return edges
}

function buildAdjacencyMap(nodes: CountryRisk[]): Map<string, string[]> {
  const graph = new Map<string, Set<string>>()

  for (const node of nodes) {
    if (!graph.has(node.id)) graph.set(node.id, new Set())

    for (const connectedId of node.connections || []) {
      if (!graph.has(connectedId)) graph.set(connectedId, new Set())

      graph.get(node.id)!.add(connectedId)
      graph.get(connectedId)!.add(node.id)
    }
  }

  return new Map(
    Array.from(graph.entries()).map(([key, value]) => [key, Array.from(value)])
  )
}

function findShortestPath(
  graph: Map<string, string[]>,
  start: string,
  end: string
): string[] {
  if (start === end) return [start]
  if (!graph.has(start) || !graph.has(end)) return [start, end]

  const queue: string[][] = [[start]]
  const visited = new Set<string>([start])

  while (queue.length > 0) {
    const path = queue.shift()!
    const current = path[path.length - 1]
    const neighbors = graph.get(current) || []

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue

      const nextPath = [...path, neighbor]
      if (neighbor === end) return nextPath

      visited.add(neighbor)
      queue.push(nextPath)
    }
  }

  return [start, end]
}

function buildRouteSegmentsFromPath(
  pathNodes: string[],
  nodes: CountryRisk[]
): ProductRouteSegment[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const segments: ProductRouteSegment[] = []

  for (let i = 0; i < pathNodes.length - 1; i++) {
    const fromNode = pathNodes[i]
    const toNode = pathNodes[i + 1]
    const fromRisk = nodeMap.get(fromNode)?.overallRisk ?? 30
    const toRisk = nodeMap.get(toNode)?.overallRisk ?? 30
    const fromType = nodeMap.get(fromNode)?.type
    const toType = nodeMap.get(toNode)?.type

    segments.push({
      fromNode,
      toNode,
      riskScore: Math.round((fromRisk + toRisk) / 2),
      isChokepointSegment: fromType === "chokepoint" || toType === "chokepoint",
    })
  }

  return segments
}

function extractProductRoutes(
  products: Product[],
  countryRisks: CountryRisk[]
): ProductSupplyRoute[] {
  const routes: ProductSupplyRoute[] = []
  const DANGER_THRESHOLD = 60
  const graph = buildAdjacencyMap(countryRisks)
  const nodeMap = new Map(countryRisks.map((n) => [n.id, n]))

  const getNodeRisk = (nodeId: string): number => {
    return nodeMap.get(nodeId)?.overallRisk ?? 30
  }

  const extractFromItem = (
    item: SupplyChainItem,
    parentCountry: string,
    parentName: string,
    productColor: string,
    productId: string,
    productName: string,
  ) => {
    if (item.country !== parentCountry) {
      const pathNodes = findShortestPath(graph, item.country, parentCountry)
      const segments = buildRouteSegmentsFromPath(pathNodes, countryRisks)
      const chokepoints = extractChokepointsFromPath(pathNodes, nodeMap)

      const segmentRiskScores = segments.map((s) => s.riskScore)
      const avgRisk =
        segmentRiskScores.length > 0
          ? Math.round(
              segmentRiskScores.reduce((sum, risk) => sum + risk, 0) /
                segmentRiskScores.length
            )
          : Math.round((getNodeRisk(item.country) + getNodeRisk(parentCountry)) / 2)

      routes.push({
        id: `${item.id}-to-${parentName}`,
        fromCountry: item.country,
        toCountry: parentCountry,
        fromItem: item.name || item.type,
        toItem: parentName,
        itemType: item.type,
        riskScore: avgRisk,
        isDangerous: avgRisk >= DANGER_THRESHOLD,
        productColor,
        productId,
        productName,
        pathNodes,
        segments,
        chokepoints,
      })
    }

    item.children.forEach((child) => {
      extractFromItem(
        child,
        item.country,
        item.name || item.type,
        productColor,
        productId,
        productName
      )
    })
  }

  products.forEach((product) => {
    product.components.forEach((component) => {
      extractFromItem(
        component,
        product.country,
        product.name || "Product",
        product.color,
        product.id,
        product.name || "Unnamed Product"
      )
    })
  })

  return routes
}

function getRouteColorForChokepoint(
  routes: ProductSupplyRoute[],
  chokepointId: string,
  selectedRouteId?: string | null
): string | null {
  const matchedRoute = routes.find((route) => {
    if (selectedRouteId && route.id !== selectedRouteId) return false
    return route.chokepoints.includes(chokepointId)
  })
  return matchedRoute?.productColor ?? null
}

export function SupplyChainMap({
  countryRisks,
  onCountrySelect,
  selectedCountry,
  customRoute,
  products = [],
  selectedRouteId,
  onRouteClick,
}: SupplyChainMapProps) {
  const [mounted, setMounted] = useState(false)
  const [tooltipContent, setTooltipContent] = useState("")
  const [position, setPosition] = useState<{ coordinates: [number, number]; zoom: number }>({
    coordinates: [20, 20],
    zoom: 1,
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const countryRiskMap = useMemo(() => {
    const map: Record<string, CountryRisk> = {}
    countryRisks.forEach((risk) => {
      map[risk.id] = risk
    })
    return map
  }, [countryRisks])

  const countryOnlyRiskMap = useMemo(() => {
    const map: Record<string, CountryRisk> = {}
    countryRisks.forEach((risk) => {
      if (risk.type === "country") {
        map[risk.id] = risk
      }
    })
    return map
  }, [countryRisks])

  const chokepointNodes = useMemo(() => {
    return countryRisks.filter((node) => node.type === "chokepoint")
  }, [countryRisks])

  const nodeConnections = useMemo(() => {
    return extractNodeConnections(countryRisks)
  }, [countryRisks])

  const productRoutes = useMemo(() => {
    return extractProductRoutes(products, countryRisks)
  }, [products, countryRisks])

  const activeProductChokepoints = useMemo(() => {
    const set = new Set<string>()

    productRoutes.forEach((route) => {
      const shouldInclude = !selectedRouteId || selectedRouteId === route.id
      if (!shouldInclude) return
      route.chokepoints.forEach((cp) => set.add(cp))
    })

    return set
  }, [productRoutes, selectedRouteId])

  const productCountryMarkers = useMemo(() => {
    const markers: { country: string; items: { name: string; type: ItemType }[]; isDangerous: boolean }[] = []
    const countryMap = new Map<string, { name: string; type: ItemType }[]>()

    const collectFromItem = (item: SupplyChainItem) => {
      const existing = countryMap.get(item.country) || []
      existing.push({ name: item.name || item.type, type: item.type })
      countryMap.set(item.country, existing)
      item.children.forEach(collectFromItem)
    }

    products.forEach((product) => {
      const existing = countryMap.get(product.country) || []
      existing.push({ name: product.name || "Product", type: "product" })
      countryMap.set(product.country, existing)
      product.components.forEach(collectFromItem)
    })

    countryMap.forEach((items, country) => {
      const countryRisk = countryRisks.find((c) => c.name === country)
      markers.push({
        country,
        items,
        isDangerous: (countryRisk?.overallRisk || 0) >= 60,
      })
    })

    return markers
  }, [products, countryRisks])

  const handleMoveEnd = (nextPosition: { coordinates: [number, number]; zoom: number }) => {
    setPosition(nextPosition)
  }

  if (!mounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative h-full w-full bg-background">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 130,
            center: [20, 20],
          }}
          className="h-full w-full"
        >
          <ZoomableGroup
            zoom={position.zoom}
            center={position.coordinates}
            onMoveEnd={handleMoveEnd}
            minZoom={1}
            maxZoom={8}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const countryRisk = countryOnlyRiskMap[geo.properties.name]
                  const isSelected = selectedCountry === geo.properties.name

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={getCountryColor(countryRisk?.overallRisk)}
                      stroke={isSelected ? "#7c3aed" : "#94a3b8"}
                      strokeWidth={isSelected ? 1.5 : 0.5}
                      className="cursor-pointer outline-none transition-colors duration-200 hover:opacity-80"
                      onClick={() => {
                        onCountrySelect(
                          selectedCountry === geo.properties.name ? null : geo.properties.name
                        )
                      }}
                      onMouseEnter={() => {
                        const risk = countryRisk
                        if (risk) {
                          setTooltipContent(
                            `${risk.name}: Import ${risk.importRisk}% | Export ${risk.exportRisk}%`
                          )
                        } else {
                          setTooltipContent(`${geo.properties.name}: No data`)
                        }
                      }}
                      onMouseLeave={() => {
                        setTooltipContent("")
                      }}
                    />
                  )
                })
              }
            </Geographies>

            {/* base network */}
            {nodeConnections.map((edge) => {
              const isChokepointEdge =
                edge.fromType === "chokepoint" || edge.toType === "chokepoint"

              return (
                <Line
                  key={edge.id}
                  from={edge.fromCoords}
                  to={edge.toCoords}
                  stroke={isChokepointEdge ? getRiskColor(edge.avgRisk) : "#94a3b8"}
                  strokeWidth={isChokepointEdge ? 1.8 : 1.1}
                  strokeLinecap="round"
                  strokeDasharray={isChokepointEdge ? "4 3" : "2 4"}
                  style={{
                    opacity: isChokepointEdge ? 0.18 : 0.12,
                  }}
                />
              )
            })}

            {/* custom route */}
            {customRoute && customRoute.waypoints.length >= 2 && (
              <>
                {customRoute.waypoints.slice(0, -1).map((waypoint, index) => {
                  const nextWaypoint = customRoute.waypoints[index + 1]
                  const fromCoords = waypoint.country.coordinates || nodeCoordinates[waypoint.country.name]
                  const toCoords = nextWaypoint.country.coordinates || nodeCoordinates[nextWaypoint.country.name]
                  const segmentRisk = customRoute.segmentRisks[index]

                  if (!fromCoords || !toCoords) return null

                  return (
                    <Line
                      key={`custom-${waypoint.id}-${nextWaypoint.id}`}
                      from={fromCoords}
                      to={toCoords}
                      stroke={getRiskColor(segmentRisk)}
                      strokeWidth={3}
                      strokeLinecap="round"
                      className="transition-all duration-200"
                      style={{ opacity: 0.9 }}
                    />
                  )
                })}

                {customRoute.waypoints.map((waypoint, index) => {
                  const coords = waypoint.country.coordinates || nodeCoordinates[waypoint.country.name]
                  if (!coords) return null

                  const isOrigin = waypoint.type === "origin"
                  const isDestination = waypoint.type === "destination"
                  const segmentRisk = index > 0 ? customRoute.segmentRisks[index - 1] : customRoute.totalRisk

                  return (
                    <Marker key={`custom-marker-${waypoint.id}`} coordinates={coords}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <g>
                            {(isOrigin || isDestination) && (
                              <circle
                                r={10}
                                fill="none"
                                stroke={isOrigin ? "#22c55e" : "#dc2626"}
                                strokeWidth={2}
                                className="animate-pulse"
                              />
                            )}
                            <circle
                              r={7}
                              fill={getRiskColor(segmentRisk)}
                              stroke="#fff"
                              strokeWidth={2}
                              className="cursor-pointer transition-transform duration-200 hover:scale-125"
                            />
                            <text
                              textAnchor="middle"
                              y={3}
                              className="fill-white text-[8px] font-bold"
                            >
                              {index + 1}
                            </text>
                          </g>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            <p className="font-medium">{waypoint.country.name}</p>
                            <p className="text-xs capitalize text-muted-foreground">
                              {waypoint.type}
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Marker>
                  )
                })}
              </>
            )}

            {/* product routes via chokepoints */}
            {productRoutes.length > 0 && (
              <>
                {productRoutes.map((route) => {
                  const isSelected = selectedRouteId === route.id
                  const isDimmed = !!selectedRouteId && !isSelected

                  return (
                    <g key={route.id}>
                      {route.segments.map((segment, segmentIndex) => {
                        const fromCoords = nodeCoordinates[segment.fromNode]
                        const toCoords = nodeCoordinates[segment.toNode]
                        if (!fromCoords || !toCoords) return null

                        const segmentIsDangerous = segment.riskScore >= 60

                        return (
                          <Line
                            key={`${route.id}-segment-${segmentIndex}`}
                            from={fromCoords}
                            to={toCoords}
                            stroke={segmentIsDangerous ? "#dc2626" : route.productColor}
                            strokeWidth={isSelected ? 4 : segmentIsDangerous ? 3.5 : 2.5}
                            strokeLinecap="round"
                            strokeDasharray={segmentIsDangerous ? "none" : "6 3"}
                            className="cursor-pointer transition-all duration-200"
                            onClick={() => onRouteClick?.(route)}
                            style={{
                              opacity: isDimmed ? 0.22 : segmentIsDangerous ? 1 : 0.9,
                              filter: segmentIsDangerous
                                ? "drop-shadow(0 0 5px rgba(220, 38, 38, 0.7))"
                                : `drop-shadow(0 0 3px ${route.productColor}55)`,
                            }}
                          />
                        )
                      })}
                    </g>
                  )
                })}

                {/* product country markers */}
                {productCountryMarkers.map((marker) => {
                  const coords = nodeCoordinates[marker.country]
                  if (!coords) return null

                  const productForCountry = products.find(
                    (p) =>
                      p.country === marker.country ||
                      p.components.some((c) => c.country === marker.country)
                  )
                  const markerColor = productForCountry?.color ?? "#2563eb"

                  return (
                    <Marker key={`product-marker-${marker.country}`} coordinates={coords}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <g>
                            {marker.isDangerous && (
                              <circle
                                r={14}
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth={2}
                                className="animate-ping"
                                style={{ opacity: 0.4 }}
                              />
                            )}
                            {marker.isDangerous && (
                              <circle r={12} fill="none" stroke="#dc2626" strokeWidth={2} />
                            )}
                            <circle
                              r={8}
                              fill={markerColor}
                              stroke="#fff"
                              strokeWidth={2}
                              className="cursor-pointer transition-transform duration-200 hover:scale-125"
                            />
                            {marker.items.length > 1 && (
                              <>
                                <circle cx={6} cy={-6} r={6} fill="#1f2937" stroke="#fff" strokeWidth={1} />
                                <text
                                  x={6}
                                  y={-3}
                                  textAnchor="middle"
                                  style={{ fontSize: 7, fill: "white", fontWeight: "bold" }}
                                >
                                  {marker.items.length}
                                </text>
                              </>
                            )}
                          </g>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-2">
                            <p className="font-semibold">{marker.country}</p>
                            {marker.isDangerous && (
                              <p className="text-xs font-medium text-red-500">High Risk Location</p>
                            )}
                            <div className="space-y-1">
                              {marker.items.map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs">
                                  <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: markerColor }}
                                  />
                                  <span className="capitalize text-muted-foreground">{item.type}:</span>
                                  <span>{item.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </Marker>
                  )
                })}
              </>
            )}

            {/* chokepoint markers */}
            {chokepointNodes.map((node) => {
              const coords = nodeCoordinates[node.id]
              if (!coords) return null

              const isSelected = selectedCountry === node.id
              const isActive = activeProductChokepoints.has(node.id)
              const activeColor = getRouteColorForChokepoint(productRoutes, node.id, selectedRouteId)

              return (
                <Marker key={`chokepoint-${node.id}`} coordinates={coords}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <g
                        onClick={() => onCountrySelect(selectedCountry === node.id ? null : node.id)}
                        className="cursor-pointer"
                        style={{ opacity: isActive ? 1 : 0.4 }}
                      >
                        {isActive && (
                          <circle
                            r={13}
                            fill="none"
                            stroke={activeColor ?? "#7c3aed"}
                            strokeWidth={3}
                            className="animate-pulse"
                          />
                        )}
                        <rect
                          x={-8}
                          y={-8}
                          width={16}
                          height={16}
                          rx={3}
                          fill={getRiskColor(node.overallRisk)}
                          stroke={isSelected ? "#111827" : "#fff"}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          className="transition-transform duration-200 hover:scale-110"
                        />
                        <circle cx={0} cy={0} r={2} fill="white" />
                      </g>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="space-y-1">
                        <p className="font-semibold">{node.name}</p>
                        <p className="text-xs text-muted-foreground">Chokepoint</p>
                        <p className="text-xs text-muted-foreground">
                          Overall risk: {node.overallRisk}%
                        </p>
                        {isActive && (
                          <p className="text-xs font-medium text-blue-600">
                            Used in active product route
                          </p>
                        )}
                        {node.newsHighlights.slice(0, 2).map((item, idx) => (
                          <p key={idx} className="text-xs">{item}</p>
                        ))}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </Marker>
              )
            })}
          </ZoomableGroup>
        </ComposableMap>

        {products.length > 0 && (
          <div className="absolute bottom-4 left-4 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold text-foreground">Products</p>
            <div className="space-y-1.5">
              {products.map((product) => (
                <div key={product.id} className="flex items-center gap-2">
                  <div className="h-2.5 w-6 rounded-full" style={{ backgroundColor: product.color }} />
                  <span className="max-w-[120px] truncate text-xs text-muted-foreground">
                    {product.name || "Unnamed Product"}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-3 border-t border-border pt-2">
              <p className="mb-1.5 text-xs font-semibold text-foreground">Route Status</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-0.5 w-5 rounded bg-red-600" style={{ height: 3 }} />
                  <span className="text-xs font-medium text-red-500">Dangerous</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5"
                    style={{
                      height: 3,
                      background:
                        "repeating-linear-gradient(90deg,#94a3b8,#94a3b8 3px,transparent 3px,transparent 7px)",
                      borderRadius: 2,
                    }}
                  />
                  <span className="text-xs text-muted-foreground">Safe</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-sm border border-white bg-violet-500" />
                  <span className="text-xs text-muted-foreground">Chokepoint</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur-sm">
          <p className="mb-2 text-xs font-semibold text-foreground">Risk Level</p>
          <div className="space-y-1">
            {[
              { color: "#7c3aed", label: "Worst" },
              { color: "#a78bfa", label: "Worse" },
              { color: "#c4b5fd", label: "Bad" },
              { color: "#ddd6fe", label: "Good" },
              { color: "#ede9fe", label: "Best" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="h-3 w-4 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {tooltipContent && (
          <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-lg border border-border bg-card/95 px-3 py-2 text-sm shadow-lg backdrop-blur-sm">
            {tooltipContent}
          </div>
        )}

        <div className="absolute right-4 top-4 flex flex-col gap-1">
          <button
            onClick={() =>
              setPosition((prev) => ({
                ...prev,
                zoom: Math.min(prev.zoom * 1.5, 8),
              }))
            }
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            +
          </button>
          <button
            onClick={() =>
              setPosition((prev) => ({
                ...prev,
                zoom: Math.max(prev.zoom / 1.5, 1),
              }))
            }
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-accent"
          >
            -
          </button>
        </div>
      </div>
    </TooltipProvider>
  )
}