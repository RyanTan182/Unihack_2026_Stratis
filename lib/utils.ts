import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SupplyChainItem, CountryRisk } from '@/components/supply-chain-map'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a risk value to at most 2 decimal places
 * Examples: 76.456 → "76.46", 76.4 → "76.4", 80 → "80"
 */
export function formatRisk(risk: number): string {
  const rounded = Math.round(risk * 100) / 100
  // Remove trailing zeros after decimal point
  return parseFloat(rounded.toFixed(2)).toString()
}

// Types for supply chain traversal
interface TraversalResult {
  uniqueCountries: string[]
  uniqueChokepoints: string[]
}

export function buildCountryGraph(
  countryRisks: CountryRisk[]
): Map<string, CountryRisk[]> {
  const riskMap = new Map(countryRisks.map((r) => [r.id, r]))
  const graph = new Map<string, CountryRisk[]>()
  
  countryRisks.forEach((node) => {
    if (!graph.has(node.id)) graph.set(node.id, [])
    node.connections?.forEach((connId) => {
      const connNode = riskMap.get(connId)
      if (connNode) {
        if (!graph.has(connId)) graph.set(connId, [])
        graph.get(node.id)!.push(connNode)
        graph.get(connId)!.push(node)
      }
    })
  })

  return graph
}

export function findHighestRiskPath(
  graph: Map<string, CountryRisk[]>
): {
  path: string[]
  maxRisk: number
} {
  // Extract all unique nodes from the graph
  const allNodes = new Map<string, CountryRisk>()
  graph.forEach((neighbors) => {
    neighbors.forEach((neighbor) => {
      if (!allNodes.has(neighbor.id)) {
        allNodes.set(neighbor.id, neighbor)
      }
    })
  })

  // Find the node with maximum overall risk
  let maxRiskNodeId: string | null = null
  let maxRiskValue = 0

  allNodes.forEach((node) => {
    if (node.overallRisk > maxRiskValue) {
      maxRiskValue = node.overallRisk
      maxRiskNodeId = node.id
    }
  })

  if (!maxRiskNodeId) {
    return { path: [], maxRisk: 0 }
  }

  // Find a path to this node using BFS from any starting point
  for (const [startId] of graph) {
    const queue: string[][] = [[startId]]
    const visited = new Set<string>([startId])

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]

      if (current === maxRiskNodeId) {
        return { path, maxRisk: maxRiskValue }
      }

      const neighbors = graph.get(current) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          visited.add(neighbor.id)
          queue.push([...path, neighbor.id])
        }
      }
    }
  }

  return { path: [], maxRisk: 0 }
}

export function extractChokepointsFromPath(
  path: string[],
  riskMap: Map<string, CountryRisk>
): string[] {
  return path.filter((nodeId) => {
    const node = riskMap.get(nodeId)
    return node?.type === "chokepoint"
  })
}

export function traverseSupplyChainBFS(
  rootItem: SupplyChainItem,
  rootCountry: string,
  countryRisks: CountryRisk[]
): TraversalResult {
  const uniqueCountries = new Set<string>()
  const uniqueChokepoints = new Set<string>()

  const riskMap = new Map(countryRisks.map((r) => [r.id, r]))
  const nodeGraph = buildCountryGraph(countryRisks)

  const findShortestPath = (start: string, end: string): string[] => {
    if (start === end) return [start]
    if (!nodeGraph.has(start) || !nodeGraph.has(end)) return [start, end]

    const queue: string[][] = [[start]]
    const visited = new Set<string>([start])

    while (queue.length > 0) {
      const path = queue.shift()!
      const current = path[path.length - 1]
      const neighbors = nodeGraph.get(current) || []

      for (const neighbor of neighbors) {
        if (visited.has(neighbor.id)) continue

        const nextPath = [...path, neighbor.id]
        if (neighbor.id === end) return nextPath

        visited.add(neighbor.id)
        queue.push(nextPath)
      }
    }

    return [start, end]
  }

  const queue: Array<{ item: SupplyChainItem; parentCountry: string }> = [
    { item: rootItem, parentCountry: rootCountry },
  ]
  const visitedItems = new Set<string>()

  while (queue.length > 0) {
    const { item, parentCountry } = queue.shift()!

    if (visitedItems.has(item.id)) continue
    visitedItems.add(item.id)

    // Add both countries to unique set
    uniqueCountries.add(item.country)
    uniqueCountries.add(parentCountry)

    if (item.country !== parentCountry) {
      const path = findShortestPath(item.country, parentCountry)
      
      path.forEach((nodeId) => {
        const node = riskMap.get(nodeId)
        if (node?.type === "country") {
          uniqueCountries.add(nodeId)
        }
      })

      const chokepoints = extractChokepointsFromPath(path, riskMap)
      chokepoints.forEach((cp) => uniqueChokepoints.add(cp))
    }

    item.children.forEach((child) => {
      queue.push({ item: child, parentCountry: item.country })
    })
  }

  return {
    uniqueCountries: Array.from(uniqueCountries).sort(),
    uniqueChokepoints: Array.from(uniqueChokepoints).sort(),
  }
}
