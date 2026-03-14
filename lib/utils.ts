import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { SupplyChainItem, CountryRisk } from '@/components/supply-chain-map'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
