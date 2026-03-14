"use client"

import { useMemo } from "react"
import { Source, Layer } from "react-map-gl/mapbox"
import type { FoundRoute } from "@/lib/route-types"
import { COUNTRY_COORDINATES } from "@/lib/route-graph"

interface FoundRoutesLayerProps {
  routes: FoundRoute[]
  selectedRouteId?: string | null
}

// Generate arc line between two coordinates using quadratic bezier curve
function generateArcLine(
  start: [number, number],
  end: [number, number],
  numPoints: number = 100
): [number, number][] {
  const result: [number, number][] = []

  const midLat = (start[1] + end[1]) / 2
  const midLon = (start[0] + end[0]) / 2

  // Calculate distance for arc height
  const dist = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2))
  const arcHeight = dist * 0.15 // Arc height proportional to distance

  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints

    // Linear interpolation for base position
    const lat = start[1] + (end[1] - start[1]) * fraction
    const lon = start[0] + (end[0] - start[0]) * fraction

    // Add arc offset (parabolic curve)
    const arcOffset = Math.sin(fraction * Math.PI) * arcHeight

    result.push([lon + arcOffset * 0.5, lat + arcOffset * 0.3])
  }

  return result
}

/**
 * Layer to visualize found routes from the Safe Route Finder
 */
export function FoundRoutesLayer({
  routes,
  selectedRouteId,
}: FoundRoutesLayerProps) {
  // Generate GeoJSON for all found routes
  const foundRoutesGeoJSON = useMemo(() => {
    if (!routes || routes.length === 0) return null

    const features: any[] = []

    routes.forEach((route, routeIndex) => {
      const isRecommended = route.isRecommended
      const isSelected = selectedRouteId === route.id

      // Generate segments between consecutive nodes
      route.nodes.slice(0, -1).forEach((node, index) => {
        const nextNode = route.nodes[index + 1]
        const fromCoords = COUNTRY_COORDINATES[node.id]
        const toCoords = COUNTRY_COORDINATES[nextNode.id]

        if (!fromCoords || !toCoords) return

        const segmentRisk = route.segmentRisks[index] || 0

        // Determine color based on risk
        let color = "#3b82f6" // Default blue
        if (segmentRisk >= 80) color = "#ef4444" // Red
        else if (segmentRisk >= 60) color = "#f97316" // Orange
        else if (segmentRisk >= 40) color = "#eab308" // Yellow
        else if (segmentRisk < 20) color = "#22c55e" // Green

        // Recommended route styling
        let width = 3
        let opacity = 0.85

        if (isRecommended) {
          width = 4
          color = "#06b6d4" // Cyan for recommended
        }

        if (isSelected) {
          width = 5
          opacity = 1
        }

        features.push({
          type: "Feature" as const,
          properties: {
            routeId: route.id,
            routeIndex,
            segmentIndex: index,
            risk: segmentRisk,
            color,
            width,
            opacity,
            isRecommended,
            isSelected,
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
  }, [routes, selectedRouteId])

  if (!foundRoutesGeoJSON || foundRoutesGeoJSON.features.length === 0) return null

  return (
    <Source
      id="found-routes-source"
      type="geojson"
      data={foundRoutesGeoJSON}
    >
      <Layer
        id="found-routes-layer"
        type="line"
        paint={{
          "line-color": ["get", "color"],
          "line-width": ["get", "width"],
          "line-opacity": ["get", "opacity"],
        }}
      />
    </Source>
  )
}
