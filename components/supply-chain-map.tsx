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
import type { DecompositionTree } from "@/lib/decompose/types"

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

interface SupplyChainMapProps {
  countryRisks: CountryRisk[]
  onCountrySelect: (countryId: string | null) => void
  selectedCountry: string | null
  customRoute?: CustomRoute | null
  decompositionTree?: DecompositionTree | null
  selectedDecompNodeId?: string | null
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

// Get leaf nodes from decomposition tree
function getLeafNodes(tree: DecompositionTree): string[] {
  return Object.values(tree.nodes)
    .filter((node) => node.children.length === 0)
    .map((node) => node.id);
}

// Build default markers: one dot per leaf node at highest-concentration country
function getDefaultMarkers(
  tree: DecompositionTree
): { country: string; concentration: number; nodeId: string }[] {
  const leafIds = getLeafNodes(tree);
  const markers: { country: string; concentration: number; nodeId: string }[] = [];

  for (const leafId of leafIds) {
    const node = tree.nodes[leafId];
    const entries = Object.entries(node.geographic_concentration);
    if (entries.length === 0) continue;
    const [topCountry, topPct] = entries.sort(([, a], [, b]) => b - a)[0];
    markers.push({ country: topCountry, concentration: topPct, nodeId: leafId });
  }

  return markers;
}

// Concentration dot colors (for selected node detail view)
const CONCENTRATION_DOT_COLORS = [
  "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4",
];

export function SupplyChainMap({
  countryRisks,
  onCountrySelect,
  selectedCountry,
  customRoute,
  decompositionTree,
  selectedDecompNodeId,
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

  // Compute concentration markers from decomposition tree
  const defaultMarkers = useMemo(() => {
    if (!decompositionTree) return [];
    return getDefaultMarkers(decompositionTree);
  }, [decompositionTree]);

  const selectedNodeMarkers = useMemo(() => {
    if (!decompositionTree || !selectedDecompNodeId) return [];
    const node = decompositionTree.nodes[selectedDecompNodeId];
    if (!node) return [];
    return Object.entries(node.geographic_concentration)
      .sort(([, a], [, b]) => b - a)
      .map(([country, pct], i) => ({
        country,
        concentration: pct,
        color: CONCENTRATION_DOT_COLORS[i % CONCENTRATION_DOT_COLORS.length],
      }));
  }, [decompositionTree, selectedDecompNodeId]);

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

            {/* Decomposition Concentration Markers */}
            {!selectedDecompNodeId &&
              defaultMarkers.map((marker) => {
                const coords = nodeCoordinates[marker.country];
                if (!coords) return null;
                const radius = Math.max(3, (marker.concentration / 100) * 10);
                return (
                  <Marker key={`default-${marker.nodeId}`} coordinates={coords}>
                    <circle
                      r={radius}
                      fill="#7c3aed"
                      fillOpacity={0.8}
                      stroke="#7c3aed"
                      strokeWidth={0.5}
                      style={{ filter: "drop-shadow(0 0 4px rgba(124, 58, 237, 0.5))" }}
                    />
                  </Marker>
                );
              })}

            {selectedDecompNodeId &&
              selectedNodeMarkers.map((marker) => {
                const coords = nodeCoordinates[marker.country];
                if (!coords) return null;
                const radius = Math.max(3, (marker.concentration / 100) * 12);
                return (
                  <Marker key={`selected-${marker.country}`} coordinates={coords}>
                    <circle
                      r={radius}
                      fill={marker.color}
                      fillOpacity={0.9}
                      stroke={marker.color}
                      strokeWidth={0.5}
                      style={{ filter: `drop-shadow(0 0 4px ${marker.color}88)` }}
                    />
                    <text
                      textAnchor="middle"
                      y={radius + 10}
                      style={{ fontSize: "8px", fill: marker.color, fontWeight: 500 }}
                    >
                      {marker.country} {marker.concentration}%
                    </text>
                  </Marker>
                );
              })}

            {/* chokepoint markers */}
            {chokepointNodes.map((node) => {
              const coords = nodeCoordinates[node.id]
              if (!coords) return null

              const isSelected = selectedCountry === node.id

              return (
                <Marker key={`chokepoint-${node.id}`} coordinates={coords}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <g
                        onClick={() => onCountrySelect(selectedCountry === node.id ? null : node.id)}
                        className="cursor-pointer"
                      >
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
