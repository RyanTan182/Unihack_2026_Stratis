import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Types for supply chain traversal
interface CountryRiskForTraversal {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
}

interface SupplyChainItemForTraversal {
  id: string
  country: string
  children: SupplyChainItemForTraversal[]
}

interface TraversalResult {
  uniqueCountries: string[]
  uniqueChokepoints: string[]
}

export function extractChokepointsFromPath(
  path: string[],
  riskMap: Map<string, CountryRiskForTraversal>
): string[] {
  return path.filter((nodeId) => {
    const node = riskMap.get(nodeId)
    return node?.type === "chokepoint"
  })
}

export function traverseSupplyChainBFS(
  rootItem: SupplyChainItemForTraversal,
  rootCountry: string,
  countryRisks: CountryRiskForTraversal[]
): TraversalResult {
  const uniqueCountries = new Set<string>()
  const uniqueChokepoints = new Set<string>()

  const riskMap = new Map(countryRisks.map((r) => [r.id, r]))

  const graph = new Map<string, string[]>()
  countryRisks.forEach((node) => {
    if (!graph.has(node.id)) graph.set(node.id, [])
    node.connections?.forEach((conn) => {
      if (!graph.has(conn)) graph.set(conn, [])
      graph.get(node.id)!.push(conn)
      graph.get(conn)!.push(node.id)
    })
  })

  graph.forEach((connections) => {
    const unique = Array.from(new Set(connections))
    connections.length = 0
    connections.push(...unique)
  })

  const findShortestPath = (start: string, end: string): string[] => {
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

  const queue: Array<{ item: SupplyChainItemForTraversal; parentCountry: string }> = [
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
