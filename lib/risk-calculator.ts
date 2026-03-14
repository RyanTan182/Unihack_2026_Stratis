/**
 * Risk Calculator for Route Segments
 * Provides distance and transit time calculations
 */

import type { RouteNode } from './route-types'
import { COUNTRY_COORDINATES } from './route-graph'

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export function calculateDistance(coord1: [number, number], coord2: [number, number]): number {
  if (!coord1 || !coord2) return 0

  const [lon1, lat1] = coord1
  const [lon2, lat2] = coord2

  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c)
}

/**
 * Calculate the distance for a route with multiple nodes
 */
export function calculateRouteDistance(nodes: RouteNode[]): number {
  let totalDistance = 0

  for (let i = 0; i < nodes.length - 1; i++) {
    const fromCoords = COUNTRY_COORDINATES[nodes[i].id]
    const toCoords = COUNTRY_COORDINATES[nodes[i + 1].id]
    if (fromCoords && toCoords) {
      totalDistance += calculateDistance(fromCoords, toCoords)
    }
  }

  return Math.round(totalDistance)
}

/**
 * Estimate transit time in days based on distance
 * Returns a range: "minDays-maxDays"
 */
export function getTransitDays(distanceKm: number): string {
  if (distanceKm === 0) return "0 days"

  // Average ship speed: ~500 km/day (slow) to ~700 km/day (fast)
  const slowDays = Math.ceil(distanceKm / 400)
  const fastDays = Math.ceil(distanceKm / 600)

  if (slowDays === fastDays) {
    return `${slowDays} days`
  }
  return `${fastDays}-${slowDays} days`
}

/**
 * Get risk level label and colors
 * Matches the existing implementation in route-builder.tsx
 */
export function getRiskLevel(score: number): { label: string; color: string; textColor: string } {
  if (score >= 80) return { label: "Critical", color: "bg-red-500 text-white", textColor: "text-red-400" }
  if (score >= 60) return { label: "High", color: "bg-orange-500 text-white", textColor: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: `bg-yellow-500 text-foreground`, textColor: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "bg-emerald-500 text-white", textColor: "text-emerald-400" }
  return { label: "Minimal", color: "bg-cyan-500 text-white", textColor: "text-cyan-400" }
}

/**
 * Calculate risk for a segment between two nodes
 * This extends the existing formula in route-builder.tsx with additional factors:
 * - Distance factor for longer routes
 * - Chokepoint penalty (exponential for high-risk chokepoints)
 */
export function calculateSegmentRisk(
  from: RouteNode,
  to: RouteNode,
  isTransit: boolean = false
): number {
  // Base risk: direction-aware (matching route-builder.tsx pattern)
  // Use overallRisk as a fallback if import/export risks aren't available
  const fromExportRisk = from.exportRisk ?? from.risk
  const fromImportRisk = from.importRisk ?? from.risk
  const toExportRisk = to.exportRisk ?? to.risk
  const toImportRisk = to.importRisk ?? to.risk

  const baseRisk = (
    fromExportRisk * 0.4 +    // Origin's export risk
    toImportRisk * 0.4 +       // Destination's import risk
    from.risk * 0.1 +         // Origin general stability
    to.risk * 0.1             // Destination general stability
  )

  // Chokepoint penalty: exponential for high-risk chokepoints
  const chokepointPenalty = [from, to]
    .filter(n => n.type === 'chokepoint')
    .reduce((sum, n) => sum + Math.pow(n.risk / 100, 2) * 20, 0)

  // Transit factor: longer routes through transit countries have slightly higher risk
  const transitFactor = isTransit ? 1.1 : 1

  return Math.min(100, Math.round((baseRisk + chokepointPenalty) * transitFactor))
}
