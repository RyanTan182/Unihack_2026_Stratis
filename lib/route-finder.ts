/**
 * Route Finder - BFS Algorithm Implementation
 * Finds multiple safe routes between countries using Breadth-First Search
 */

import type { RouteNode, FoundRoute, FindOptions, RouteSegment, RouteFindResult } from './route-types'
import { calculateSegmentRisk, calculateRouteDistance, getTransitDays } from './risk-calculator'
import { getRouteGraph } from './route-graph'

// Re-export types for convenience
export type { FoundRoute, FindOptions, RouteFindResult } from './route-types'

/**
 * Generate a unique ID for a route
 */
function generateRouteId(nodes: RouteNode[]): string {
  return `route-${nodes.map(n => n.id).join('-')}`
}

/**
 * Check if two routes are significantly different
 * (not just the same route with minor variations)
 */
function areRoutesDifferent(route1: RouteNode[], route2: RouteNode[]): boolean {
  if (route1.length !== route2.length) return true

  const set1 = new Set(route1.map(n => n.id))
  const set2 = new Set(route2.map(n => n.id))

  // At least 30% of nodes should be different
  const intersection = [...set1].filter(id => set2.has(id))
  const minUnique = Math.min(set1.size, set2.size) * 0.7

  return intersection.length < minUnique
}

/**
 * Main route finding function using BFS
 *
 * @param origin - Starting node ID
 * @param destination - Ending node ID
 * @param options - Route finding options
 * @returns Array of found routes sorted by risk
 */
export function findRoutes(
  origin: string,
  destination: string,
  options: FindOptions = {}
): RouteFindResult {
  const startTime = performance.now()

  const {
    excludeChokepoints = [],
    maxWaypoints = 6,
    maxRoutes = 3
  } = options

  const graph = getRouteGraph()

  if (!graph) {
    return {
      success: false,
      routes: [],
      origin,
      destination,
      options,
      error: 'Route graph not initialized'
    }
  }

  const originNode = graph.getNode(origin)
  const destNode = graph.getNode(destination)

  if (!originNode) {
    return {
      success: false,
      routes: [],
      origin,
      destination,
      options,
      error: `Origin "${origin}" not found in graph`
    }
  }

  if (!destNode) {
    return {
      success: false,
      routes: [],
      origin,
      destination,
      options,
      error: `Destination "${destination}" not found in graph`
    }
  }

  if (origin === destination) {
    return {
      success: false,
      routes: [],
      origin,
      destination,
      options,
      error: 'Origin and destination must be different'
    }
  }

  // BFS to find all paths
  const allPaths: RouteNode[][] = []
  const queue: { nodeId: string; path: RouteNode[] }[] = [
    { nodeId: origin, path: [originNode] }
  ]

  // Find more paths than needed to ensure diversity
  const maxPathsToFind = maxRoutes * 5

  while (queue.length > 0 && allPaths.length < maxPathsToFind) {
    const { nodeId, path } = queue.shift()!

    // Found destination
    if (nodeId === destination && path.length >= 2) {
      allPaths.push(path)
      continue
    }

    // Exceed max waypoints
    if (path.length > maxWaypoints) continue

    const node = graph.getNode(nodeId)
    if (!node) continue

    // Explore neighbors
    for (const neighborId of node.connections) {
      const neighborNode = graph.getNode(neighborId)
      if (!neighborNode) continue

      // Skip if already in path (avoid cycles)
      if (path.some(n => n.id === neighborId)) continue

      // Skip excluded chokepoints
      if (excludeChokepoints.includes(neighborId)) continue

      queue.push({
        nodeId: neighborId,
        path: [...path, neighborNode]
      })
    }
  }

  // No routes found
  if (allPaths.length === 0) {
    return {
      success: false,
      routes: [],
      origin,
      destination,
      options,
      error: 'No valid route found with current constraints. Try removing chokepoint exclusions or selecting different origin/destination.'
    }
  }

  // Convert paths to FoundRoute objects
  const foundRoutes: FoundRoute[] = allPaths.map(path => {
    const segments: RouteSegment[] = []
    const segmentRisks: number[] = []

    for (let i = 0; i < path.length - 1; i++) {
      const risk = calculateSegmentRisk(path[i], path[i + 1])
      segments.push({
        from: path[i].id,
        to: path[i + 1].id,
        risk,
        distance: graph.getDistance(path[i].id, path[i + 1].id)
      })
      segmentRisks.push(risk)
    }

    const totalRisk = calculateTotalRouteRisk(segmentRisks)
    const distance = calculateRouteDistance(path)

    return {
      id: generateRouteId(path),
      nodes: path,
      totalRisk,
      segmentRisks,
      segments,
      chokepointsUsed: path.filter(n => n.type === 'chokepoint').map(n => n.id),
      countriesUsed: path.filter(n => n.type === 'country').map(n => n.id),
      isRecommended: false,
      distanceKm: distance,
      estimatedDays: getTransitDays(distance)
    }
  })

  // Sort by risk (lowest first)
  foundRoutes.sort((a, b) => a.totalRisk - b.totalRisk)

  // Filter for route diversity
  const diverseRoutes: FoundRoute[] = []

  for (const route of foundRoutes) {
    if (diverseRoutes.length === 0) {
      diverseRoutes.push(route)
    } else {
      // Check if this route is significantly different from existing ones
      const isDifferent = diverseRoutes.every(existing =>
        areRoutesDifferent(existing.nodes, route.nodes)
      )
      if (isDifferent) {
        diverseRoutes.push(route)
      }
    }

    if (diverseRoutes.length >= maxRoutes) break
  }

  // Mark the recommended route
  if (diverseRoutes.length > 0) {
    diverseRoutes[0].isRecommended = true
  }

  const searchTime = performance.now() - startTime

  return {
    success: true,
    routes: diverseRoutes.slice(0, maxRoutes),
    origin,
    destination,
    options,
    searchTime
  }
}

/**
 * Calculate total route risk using weighted average
 * Higher-risk segments have more impact on total
 */
export function calculateTotalRouteRisk(segmentRisks: number[]): number {
  if (segmentRisks.length === 0) return 0

  // Sort risks descending (highest risk first)
  const sorted = [...segmentRisks].sort((a, b) => b - a)

  let totalRisk = 0
  let totalWeight = 0
  let weight = 1

  // Weighted average with decreasing weights for lower-risk segments
  for (const risk of sorted) {
    totalRisk += risk * weight
    totalWeight += weight
    weight *= 0.7 // Each subsequent segment has 70% the weight of the previous
  }

  return Math.round(totalRisk / totalWeight)
}

/**
 * Find alternative routes when a chokepoint is excluded
 * Returns routes that don't use any of the excluded chokepoints
 */
export function findAlternativeRoutes(
  origin: string,
  destination: string,
  excludedChokepoints: string[]
): FoundRoute[] {
  return findRoutes(origin, destination, {
    excludeChokepoints: excludedChokepoints,
    maxRoutes: 3
  }).routes
}

/**
 * Get route statistics for display
 */
export function getRouteStats(route: FoundRoute) {
  const risks = route.segmentRisks

  return {
    totalRisk: route.totalRisk,
    highestSegmentRisk: Math.max(...risks),
    lowestSegmentRisk: Math.min(...risks),
    averageRisk: Math.round(risks.reduce((a, b) => a + b, 0) / risks.length),
    waypointCount: route.nodes.length,
    chokepointCount: route.chokepointsUsed.length,
    distanceKm: route.distanceKm,
    estimatedDays: route.estimatedDays
  }
}
