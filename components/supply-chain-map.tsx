"use client"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import MapGL, {
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  MapRef,
  MapMouseEvent,
  ViewStateChangeEvent,
} from "react-map-gl/mapbox"
import type { LngLatLike } from "react-map-gl/mapbox"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Spinner } from "@/components/ui/spinner"
import { extractChokepointsFromPath } from "@/lib/utils"
import { Package, Boxes, Box, Fuel } from "lucide-react"
import { FoundRoutesLayer } from "@/components/found-routes-layer"
import type { FoundRoute, RouteMode } from "@/lib/route-types"

export interface CountryRisk {
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

export type ItemType = "product" | "component" | "material" | "resource"

export interface SupplyChainItem {
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
  componentRiskPrediction: number
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
  showRiskZones?: boolean
  onAddItemAtCountry?: (country: string, itemType: ItemType) => void
  foundRoutes?: FoundRoute[]
  selectedFoundRouteId?: string | null
  routeMode?: RouteMode
}

const getRiskColor = (risk: number): string => {
  if (risk >= 80) return "#dc2626"
  if (risk >= 60) return "#ea580c"
  if (risk >= 40) return "#eab308"
  if (risk >= 20) return "#22c55e"
  return "#0ea5e9"
}

const getCountryColor = (risk: number | undefined): string => {
  if (risk === undefined) return "#1e293b"
  if (risk >= 80) return "#7c3aed"
  if (risk >= 60) return "#a78bfa"
  if (risk >= 40) return "#c4b5fd"
  if (risk >= 20) return "#ddd6fe"
  return "#ede9fe"
}

// Mapping from app country names to GeoJSON country names
const geoJsonCountryNameMap: Record<string, string> = {
  "United States": "United States of America",
  // Most other names match directly
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
  const nodeMap: globalThis.Map<string, CountryRisk> = new globalThis.Map(nodes.map((node) => [node.id, node]))
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

function buildAdjacencyMap(nodes: CountryRisk[]): globalThis.Map<string, string[]> {
  const graph: globalThis.Map<string, Set<string>> = new globalThis.Map()

  for (const node of nodes) {
    if (!graph.has(node.id)) graph.set(node.id, new Set())

    for (const connectedId of node.connections || []) {
      if (!graph.has(connectedId)) graph.set(connectedId, new Set())

      graph.get(node.id)!.add(connectedId)
      graph.get(connectedId)!.add(node.id)
    }
  }

  return new globalThis.Map(
    Array.from(graph.entries()).map((entry: [string, Set<string>]) => [entry[0], Array.from(entry[1])])
  )
}

function findShortestPath(
  graph: globalThis.Map<string, string[]>,
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

function getEdgeTraversalCost(
  fromId: string,
  toId: string,
  nodeMap: globalThis.Map<string, CountryRisk>
): number {
  const fromNode = nodeMap.get(fromId)
  const toNode = nodeMap.get(toId)

  const fromRisk = fromNode?.overallRisk ?? 30
  const toRisk = toNode?.overallRisk ?? 30

  const avgRisk = (fromRisk + toRisk) / 2

  const chokepointPenalty =
    fromNode?.type === "chokepoint" || toNode?.type === "chokepoint"
      ? 20
      : 0

  const highRiskChokepointPenalty =
    (fromNode?.type === "chokepoint" && fromRisk >= 60) ||
    (toNode?.type === "chokepoint" && toRisk >= 60)
      ? 25
      : 0

  return avgRisk + chokepointPenalty + highRiskChokepointPenalty * 20
}

function findSafestPath(
  graph: globalThis.Map<string, string[]>,
  nodes: CountryRisk[],
  start: string,
  end: string
): string[] {
  if (start === end) return [start]
  if (!graph.has(start) || !graph.has(end)) return [start, end]

  const nodeMap: globalThis.Map<string, CountryRisk> = new globalThis.Map(
    nodes.map((n) => [n.id, n])
  )

  const distances = new Map<string, number>()
  const previous = new Map<string, string | null>()
  const unvisited = new Set<string>()

  for (const nodeId of graph.keys()) {
    distances.set(nodeId, Number.POSITIVE_INFINITY)
    previous.set(nodeId, null)
    unvisited.add(nodeId)
  }

  distances.set(start, 0)

  while (unvisited.size > 0) {
    let current: string | null = null
    let currentDistance = Number.POSITIVE_INFINITY

    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId) ?? Number.POSITIVE_INFINITY
      if (dist < currentDistance) {
        currentDistance = dist
        current = nodeId
      }
    }

    if (!current) break
    if (current === end) break

    unvisited.delete(current)

    const neighbors = graph.get(current) || []
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor)) continue

      const edgeCost = getEdgeTraversalCost(current, neighbor, nodeMap)
      const alt = currentDistance + edgeCost

      if (alt < (distances.get(neighbor) ?? Number.POSITIVE_INFINITY)) {
        distances.set(neighbor, alt)
        previous.set(neighbor, current)
      }
    }
  }

  const path: string[] = []
  let cursor: string | null = end

  while (cursor) {
    path.unshift(cursor)
    cursor = previous.get(cursor) ?? null
  }

  if (path.length === 0 || path[0] !== start) {
    return [start, end]
  }

  console.log(path)

  return path
}

function buildRouteSegmentsFromPath(
  pathNodes: string[],
  nodes: CountryRisk[]
): ProductRouteSegment[] {
  const nodeMap: globalThis.Map<string, CountryRisk> = new globalThis.Map(nodes.map((n) => [n.id, n]))
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
  countryRisks: CountryRisk[],
  routeMode: RouteMode = "shortest"
): ProductSupplyRoute[] {
  const routes: ProductSupplyRoute[] = []
  const DANGER_THRESHOLD = 60
  const graph = buildAdjacencyMap(countryRisks)
  const nodeMap: globalThis.Map<string, CountryRisk> = new globalThis.Map(countryRisks.map((n) => [n.id, n]))

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
      const pathNodes =
        routeMode === "safest"
          ? findSafestPath(graph, countryRisks, item.country, parentCountry)
          : findShortestPath(graph, item.country, parentCountry)
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
        isDangerous: avgRisk >= DANGER_THRESHOLD || item.riskPrediction > 60,
        componentRiskPrediction: item.riskPrediction,
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

// Generate GeoJSON for route arcs
function generateArcLine(
  from: [number, number],
  to: [number, number]
): [number, number][] {
  const points: [number, number][] = []
  const segments = 100

  // Calculate midpoint with elevation
  const midLon = (from[0] + to[0]) / 2
  const midLat = (from[1] + to[1]) / 2
  const distance = Math.sqrt(
    Math.pow(to[0] - from[0], 2) + Math.pow(to[1] - from[1], 2)
  )
  const elevation = Math.min(distance * 0.15, 15) // Cap elevation

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const lon = from[0] + (to[0] - from[0]) * t
    const lat = from[1] + (to[1] - from[1]) * t

    // Add elevation using a parabolic curve
    const elev = Math.sin(t * Math.PI) * elevation
    points.push([lon, lat + elev * 0.5])
  }

  return points
}

// Custom dark map style for Stratis - OLED black matching sidebar
const mapStyle: mapboxgl.Style = {
  version: 8,
  name: "Stratis OLED Dark",
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      ],
      tileSize: 256,
    },
    "countries-fill": {
      type: "geojson",
      data: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
    }
  },
  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        // Pure OLED black for oceans/background
        "background-color": "#000000"
      }
    },
    {
      id: "carto-dark",
      type: "raster",
      source: "carto-dark",
      minzoom: 0,
      maxzoom: 22,
      paint: {
        "raster-saturation": 0,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.6,
        "raster-opacity": 0.7,
      }
    },
    {
      id: "countries-fill",
      type: "fill",
      source: "countries-fill",
      paint: {
        // Countries visible with subtle dark grey - distinguishable from black ocean
        "fill-color": "#2a2a3d",
        "fill-opacity": 0.9
      }
    },
    {
      id: "countries-border",
      type: "line",
      source: "countries-fill",
      paint: {
        // Visible borders with slightly lighter tone
        "line-color": "#3d3d5c",
        "line-width": 0.6,
        "line-opacity": 0.8
      }
    }
  ],
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf"
}

export function SupplyChainMap({
  countryRisks,
  onCountrySelect,
  selectedCountry,
  customRoute,
  products = [],
  selectedRouteId,
  onRouteClick,
  showRiskZones = false,
  onAddItemAtCountry,
  foundRoutes = [],
  selectedFoundRouteId,
  routeMode = "shortest",
}: SupplyChainMapProps) {
  const [mounted, setMounted] = useState(false)
  const [viewState, setViewState] = useState({
    longitude: 20,
    latitude: 20,
    zoom: 1.5,
    pitch: 0,
    bearing: 0,
  })
  const [hoveredMarker, setHoveredMarker] = useState<string | null>(null)
  const [popupInfo, setPopupInfo] = useState<{
    lngLat: [number, number]
    content: React.ReactNode
  } | null>(null)
  const mapRef = useRef<MapRef>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const DRAG_THRESHOLD = 5

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle map resize when container size changes
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Resize map after it's fully loaded
    const handleResize = () => {
      map.resize()
    }

    // Initial resize after map loads
    if (map.loaded()) {
      handleResize()
    } else {
      map.once('load', handleResize)
    }

    // Also resize on window resize
    window.addEventListener('resize', handleResize)

    // Resize after a short delay to ensure container is properly sized
    const timeoutId = setTimeout(handleResize, 100)

    // Use ResizeObserver to detect container size changes
    const container = map.getContainer()
    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(container)

    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [mounted])

  // Toggle base countries-fill layer visibility when risk zones are toggled
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Wait for map to be fully loaded
    const updateLayer = () => {
      if (map.getLayer('countries-fill')) {
        map.setPaintProperty(
          'countries-fill',
          'fill-opacity',
          showRiskZones ? 0 : 0.9
        )
      }
      if (map.getLayer('countries-border')) {
        map.setPaintProperty(
          'countries-border',
          'line-opacity',
          showRiskZones ? 0 : 0.8
        )
      }
    }

    if (map.loaded()) {
      updateLayer()
    } else {
      map.once('load', updateLayer)
    }

    return () => {
      map.off('load', updateLayer)
    }
  }, [showRiskZones])

  const countryRiskMap = useMemo(() => {
    const map: Record<string, CountryRisk> = {}
    countryRisks.forEach((risk) => {
      map[risk.id] = risk
    })
    return map
  }, [countryRisks])

  // Generate match expression for risk zones layer
  // Maps GeoJSON country names to risk colors
  const riskZonesMatchExpression = useMemo(() => {
    const matches: (string | number)[] = []
    Object.entries(countryRiskMap).forEach(([name, risk]) => {
      // Skip chokepoints - they're not countries in GeoJSON
      if (risk.type === "chokepoint") return
      // Get the GeoJSON country name (use mapping if exists)
      const geoJsonName = geoJsonCountryNameMap[name] || name
      matches.push(geoJsonName)
      matches.push(getRiskColor(risk.overallRisk))
    })
    return matches
  }, [countryRiskMap])

  const chokepointNodes = useMemo(() => {
    return countryRisks.filter((node) => node.type === "chokepoint")
  }, [countryRisks])

  const nodeConnections = useMemo(() => {
    return extractNodeConnections(countryRisks)
  }, [countryRisks])

  const productRoutes = useMemo(() => {
    return extractProductRoutes(products, countryRisks, routeMode)
  }, [products, countryRisks, routeMode])

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
    const countryMap: globalThis.Map<string, { name: string; type: ItemType }[]> = new globalThis.Map()

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

    countryMap.forEach((items: { name: string; type: ItemType }[], country: string) => {
      const countryRisk = countryRisks.find((c) => c.name === country)
      markers.push({
        country,
        items,
        isDangerous: (countryRisk?.overallRisk || 0) >= 60,
      })
    })

    return markers
  }, [products, countryRisks])

  // Generate GeoJSON for network connections
  const networkGeoJSON = useMemo(() => {
    const features = nodeConnections.map((edge) => {
      const isChokepoint = edge.fromType === "chokepoint" || edge.toType === "chokepoint"
      return {
        type: "Feature" as const,
        properties: {
          id: edge.id,
          isChokepoint,
          avgRisk: edge.avgRisk,
          // Use primary cyan for chokepoints, muted slate for regular connections
          color: isChokepoint ? getRiskColor(edge.avgRisk) : "#475569",
          width: isChokepoint ? 1.5 : 1,
          opacity: isChokepoint ? 0.35 : 0.2,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: generateArcLine(edge.fromCoords, edge.toCoords),
        },
      }
    })

    return {
      type: "FeatureCollection" as const,
      features,
    }
  }, [nodeConnections])

  // Generate GeoJSON for product routes
  const productRoutesGeoJSON = useMemo(() => {
    const features: any[] = []

    productRoutes.forEach((route) => {
      const isSelected = selectedRouteId === route.id
      const isDimmed = !!selectedRouteId && !isSelected

      route.segments.forEach((segment) => {
        const fromCoords = nodeCoordinates[segment.fromNode]
        const toCoords = nodeCoordinates[segment.toNode]
        if (!fromCoords || !toCoords) return

        const segmentIsDangerous = segment.riskScore >= 60
        const isHighRisk = segmentIsDangerous || route.isDangerous

        features.push({
          type: "Feature" as const,
          properties: {
            routeId: route.id,
            riskScore: segment.riskScore,
            isDangerous: segmentIsDangerous,
            isSelected,
            isDimmed,
            color: isHighRisk ? "#dc2626" : route.productColor,
            width: isSelected ? 4 : isHighRisk ? 3.5 : 2.5,
            opacity: isDimmed ? 0.22 : isHighRisk ? 1 : 0.9,
          },
          geometry: {
            type: "LineString" as const,
            coordinates: generateArcLine(fromCoords, toCoords),
          },
        })
      })
    })

    return {
      type: "FeatureCollection" as const,
      features,
    }
  }, [productRoutes, selectedRouteId])

  // Generate GeoJSON for custom route
  const customRouteGeoJSON = useMemo(() => {
    if (!customRoute || customRoute.waypoints.length < 2) return null

    const features: any[] = []

    customRoute.waypoints.slice(0, -1).forEach((waypoint, index) => {
      const nextWaypoint = customRoute.waypoints[index + 1]
      const fromCoords = waypoint.country.coordinates || nodeCoordinates[waypoint.country.name]
      const toCoords = nextWaypoint.country.coordinates || nodeCoordinates[nextWaypoint.country.name]
      const segmentRisk = customRoute.segmentRisks[index]

      if (!fromCoords || !toCoords) return

      features.push({
        type: "Feature" as const,
        properties: {
          riskScore: segmentRisk,
          color: getRiskColor(segmentRisk),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: generateArcLine(fromCoords, toCoords),
        },
      })
    })

    return {
      type: "FeatureCollection" as const,
      features,
    }
  }, [customRoute])

  const handleMouseDown = useCallback((event: MapMouseEvent) => {
    dragStartRef.current = { x: event.point.x, y: event.point.y }
  }, [])

  const handleMapClick = useCallback((event: MapMouseEvent) => {
    if (dragStartRef.current) {
      const dx = Math.abs(event.point.x - dragStartRef.current.x)
      const dy = Math.abs(event.point.y - dragStartRef.current.y)
      dragStartRef.current = null
      if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
        setPopupInfo(null)
        return
      }
    }

    const map = mapRef.current?.getMap()
    if (!map) return

    if (map.getLayer('product-routes')) {
      const routeFeatures = map.queryRenderedFeatures(event.point, {
        layers: ['product-routes']
      })
      if (routeFeatures.length > 0) return
    }

    const queryLayers: string[] = []
    if (map.getLayer('countries-fill')) queryLayers.push('countries-fill')
    if (map.getLayer('risk-zones-fill')) queryLayers.push('risk-zones-fill')

    if (queryLayers.length > 0) {
      const features = map.queryRenderedFeatures(event.point, {
        layers: queryLayers
      })

      if (features.length > 0) {
        const countryName = features[0].properties?.name
        if (countryName) {
          onCountrySelect(selectedCountry === countryName ? null : countryName)
          return
        }
      }
    }

    setPopupInfo(null)
  }, [onCountrySelect, selectedCountry])

  const handleRouteClick = useCallback((event: MapMouseEvent, route: ProductSupplyRoute) => {
    event.originalEvent.stopPropagation()
    onRouteClick?.(route)
  }, [onRouteClick])

  // Handle route layer click
  useEffect(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    const handleRouteLayerClick = (e: any) => {
      const feature = e.features?.[0]
      if (feature) {
        const routeId = feature.properties.routeId
        const route = productRoutes.find(r => r.id === routeId)
        if (route) {
          onRouteClick?.(route)
        }
      }
    }

    map.on('click', 'product-routes', handleRouteLayerClick)

    const setPointer = () => { map.getCanvas().style.cursor = 'pointer' }
    const clearPointer = () => { map.getCanvas().style.cursor = '' }

    map.on('mouseenter', 'product-routes', setPointer)
    map.on('mouseleave', 'product-routes', clearPointer)
    map.on('mouseenter', 'countries-fill', setPointer)
    map.on('mouseleave', 'countries-fill', clearPointer)

    return () => {
      map.off('click', 'product-routes', handleRouteLayerClick)
      map.off('mouseenter', 'product-routes', setPointer)
      map.off('mouseleave', 'product-routes', clearPointer)
      map.off('mouseenter', 'countries-fill', setPointer)
      map.off('mouseleave', 'countries-fill', clearPointer)
    }
  }, [productRoutes, onRouteClick])

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
      <div className="relative h-full w-full overflow-hidden bg-background">
        <MapGL
          ref={mapRef}
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
          onMouseDown={handleMouseDown}
          onClick={handleMapClick}
          style={{ width: "100%", height: "100%" }}
          mapStyle={mapStyle}
          mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || ""}
          renderWorldCopies={true}
          maxBounds={[[-180, -85], [180, 85]]}
          minZoom={1}
          maxZoom={8}
          interactiveLayerIds={['product-routes', 'countries-fill']}
        >
          {/* Network connections layer */}
          <Source
            id="network"
            type="geojson"
            data={networkGeoJSON}
          >
            <Layer
              id="network-lines"
              type="line"
              paint={{
                "line-color": ["get", "color"],
                "line-width": ["get", "width"],
                "line-opacity": ["get", "opacity"],
                "line-dasharray": ["case",
                  ["get", "isChokepoint"],
                  ["literal", [4, 3]],
                  ["literal", [2, 4]]
                ],
              }}
            />
          </Source>

          {/* Risk Zones layer - colors countries by risk level */}
          {showRiskZones && (
            <Source
              id="risk-zones-source"
              type="geojson"
              data="https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson"
            >
              <Layer
                id="risk-zones-fill"
                type="fill"
                paint={{
                  "fill-color": [
                    "match",
                    ["get", "name"], // GeoJSON uses "name" property
                    ...riskZonesMatchExpression,
                    "#1e293b" // Default color for countries not in data
                  ],
                  "fill-opacity": 0.7
                }}
              />
              <Layer
                id="risk-zones-border"
                type="line"
                paint={{
                  "line-color": "#3d3d5c",
                  "line-width": 0.5,
                  "line-opacity": 0.5
                }}
              />
            </Source>
          )}

          {/* Product routes layer */}
          {productRoutes.length > 0 && (
            <Source
              id="product-routes-source"
              type="geojson"
              data={productRoutesGeoJSON}
            >
              <Layer
                id="product-routes"
                type="line"
                paint={{
                  "line-color": ["get", "color"],
                  "line-width": ["get", "width"],
                  "line-opacity": ["get", "opacity"],
                }}
              />
            </Source>
          )}

          {/* Custom route layer */}
          {customRouteGeoJSON && (
            <Source
              id="custom-route-source"
              type="geojson"
              data={customRouteGeoJSON}
            >
              <Layer
                id="custom-route"
                type="line"
                paint={{
                  "line-color": ["get", "color"],
                  "line-width": 3,
                  "line-opacity": 0.9,
                }}
              />
            </Source>
          )}

          {/* Found routes layer from Safe Route Finder */}
          <FoundRoutesLayer
            routes={foundRoutes}
            selectedRouteId={selectedFoundRouteId}
          />

          {/* Custom route markers */}
          {customRoute && customRoute.waypoints.map((waypoint, index) => {
            const coords = waypoint.country.coordinates || nodeCoordinates[waypoint.country.name]
            if (!coords) return null

            const isOrigin = waypoint.type === "origin"
            const isDestination = waypoint.type === "destination"
            const segmentRisk = index > 0 ? customRoute.segmentRisks[index - 1] : customRoute.totalRisk

            return (
              <Marker
                key={`custom-marker-${waypoint.id}`}
                longitude={coords[0]}
                latitude={coords[1]}
                anchor="center"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="group relative cursor-pointer"
                      onMouseEnter={() => setHoveredMarker(`custom-${waypoint.id}`)}
                      onMouseLeave={() => setHoveredMarker(null)}
                    >
                      {(isOrigin || isDestination) && (
                        <div
                          className="absolute inset-0 animate-ping rounded-full opacity-40"
                          style={{
                            width: 36,
                            height: 36,
                            margin: -2,
                            border: `2px solid ${isOrigin ? "#22c55e" : "#dc2626"}`,
                          }}
                        />
                      )}
                      <div
                        className="flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl"
                        style={{
                          width: 24,
                          height: 24,
                          backgroundColor: getRiskColor(segmentRisk),
                        }}
                      >
                        <span className="text-[9px] font-bold text-white">{index + 1}</span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-lg border border-border/50 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-xl">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{waypoint.country.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {waypoint.type}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </Marker>
            )
          })}

          {/* Product country markers */}
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
              <Marker
                key={`product-marker-${marker.country}`}
                longitude={coords[0]}
                latitude={coords[1]}
                anchor="center"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="group relative cursor-pointer">
                      {marker.isDangerous && (
                        <div
                          className="absolute inset-0 animate-pulse rounded-full opacity-50"
                          style={{
                            width: 48,
                            height: 48,
                            margin: -8,
                            border: "2px solid #dc2626",
                          }}
                        />
                      )}
                      <div
                        className="flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl"
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: markerColor,
                        }}
                      >
                        {marker.items.length > 1 && (
                          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-background text-[8px] font-bold text-foreground">
                            {marker.items.length}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-lg border border-border/50 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-xl">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">{marker.country}</p>
                      {marker.isDangerous && (
                        <p className="text-xs font-medium text-red-400">High Risk Location</p>
                      )}
                      <div className="space-y-1">
                        {marker.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: markerColor }}
                            />
                            <span className="capitalize text-muted-foreground">{item.type}:</span>
                            <span className="text-foreground">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </Marker>
            )
          })}

          {/* Chokepoint markers */}
          {chokepointNodes.map((node) => {
            const coords = nodeCoordinates[node.id]
            if (!coords) return null

            const isSelected = selectedCountry === node.id
            const isActive = activeProductChokepoints.has(node.id)
            const activeColor = isSelected
              ? "#7c3aed"
              : productRoutes.find(r =>
                  selectedRouteId
                    ? r.id === selectedRouteId && r.chokepoints.includes(node.id)
                    : r.chokepoints.includes(node.id)
                )?.productColor ?? "#7c3aed"

            return (
              <Marker
                key={`chokepoint-${node.id}`}
                longitude={coords[0]}
                latitude={coords[1]}
                anchor="center"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="group relative cursor-pointer"
                      onClick={() => onCountrySelect(selectedCountry === node.id ? null : node.id)}
                      style={{ opacity: isActive ? 1 : 0.5 }}
                    >
                      {isActive && (
                        <div
                          className="absolute animate-pulse rounded-lg"
                          style={{
                            width: 44,
                            height: 44,
                            margin: -6,
                            border: `2px solid ${activeColor}`,
                            borderRadius: 10,
                            opacity: 0.6,
                          }}
                        />
                      )}
                      <div
                        className="flex items-center justify-center rounded-md border-2 border-white shadow-lg transition-all duration-200 group-hover:scale-125 group-hover:shadow-xl"
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: getRiskColor(node.overallRisk),
                          borderColor: isSelected ? "#111827" : "#fff",
                          borderWidth: isSelected ? 2.5 : 2,
                        }}
                      >
                        <div className="h-2 w-2 rounded-full bg-white" />
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="rounded-lg border border-border/50 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-xl">
                    <div className="space-y-1.5">
                      <p className="text-sm font-semibold text-foreground">{node.name}</p>
                      <p className="text-xs text-muted-foreground">Chokepoint</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Risk:</span>
                        <span
                          className="text-xs font-medium"
                          style={{ color: getRiskColor(node.overallRisk) }}
                        >
                          {node.overallRisk}%
                        </span>
                      </div>
                      {isActive && (
                        <p className="text-xs font-medium text-primary">
                          Active in route
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </Marker>
            )
          })}

          {/* Navigation controls */}
          <NavigationControl
            position="top-right"
            showCompass={false}
            visualizePitch={false}
          />
        </MapGL>

        {/* Custom Mapbox Control Styles */}
        <style jsx global>{`
          .mapboxgl-ctrl-group {
            background: oklch(0.14 0.014 260 / 0.95) !important;
            border: 1px solid oklch(0.35 0.020 260 / 0.5) !important;
            border-radius: 0.625rem !important;
            backdrop-filter: blur(12px) !important;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
          }
          .mapboxgl-ctrl-group button {
            width: 32px !important;
            height: 32px !important;
            background: transparent !important;
            border: none !important;
          }
          .mapboxgl-ctrl-group button + button {
            border-top: 1px solid oklch(0.25 0.018 260) !important;
          }
          .mapboxgl-ctrl-icon {
            filter: invert(1) brightness(0.9) !important;
          }
          .mapboxgl-ctrl-group button:hover {
            background: oklch(0.22 0.025 260) !important;
          }
          .mapboxgl-ctrl-attrib {
            display: none !important;
          }
        `}</style>

      </div>
    </TooltipProvider>
  )
}
