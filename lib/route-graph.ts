/**
 * Route Graph Builder
 * Builds a graph data structure from existing countryRisks data
 */

import type { RouteNode, CountryRiskData, GraphEdge } from './route-types'
import { calculateDistance } from './risk-calculator'

// Country coordinates for distance calculations
const COUNTRY_COORDINATES: Record<string, [number, number]> = {
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
  "Panama": [-79.52, 8.98],
  "United Arab Emirates": [53.85, 23.42],
  "Oman": [55.98, 21.47],
  "Qatar": [51.18, 25.35],
  "Yemen": [48.52, 15.55],
  "Djibouti": [42.59, 11.83],
  "Greece": [21.82, 39.07],
  "Romania": [24.97, 45.94],
  "Bulgaria": [25.49, 42.73],
  "Georgia": [43.36, 42.63],
  "Peru": [-75.02, -9.19],
  "Ethiopia": [40.49, 9.15],
  // Chokepoints - approximate coordinates
  "Suez Canal": [32.52, 30.00],
  "Panama Canal": [-79.77, 9.08],
  "Strait of Hormuz": [56.25, 26.50],
  "Strait of Malacca": [100.00, 3.00],
  "Bab-el-Mandeb": [43.42, 12.50],
  "Bosphorus": [29.00, 41.00],
}

/**
 * Route Graph class for managing the routing network
 */
export class RouteGraph {
  private nodes: Map<string, RouteNode>
  private adjacencyList: Map<string, Set<string>>

  constructor() {
    this.nodes = new Map()
    this.adjacencyList = new Map()
  }

  /**
   * Build graph from CountryRiskData array
   */
  static fromCountryRisks(data: CountryRiskData[]): RouteGraph {
    const graph = new RouteGraph()

    for (const item of data) {
      const node: RouteNode = {
        id: item.id,
        name: item.name,
        type: item.type,
        risk: item.overallRisk,
        importRisk: item.importRisk,
        exportRisk: item.exportRisk,
        connections: item.connections,
        newsHighlights: item.newsHighlights,
        coordinates: COUNTRY_COORDINATES[item.id] || [0, 0],
      }

      graph.addNode(node)
    }

    return graph
  }

  /**
   * Add a node to the graph
   */
  addNode(node: RouteNode): void {
    this.nodes.set(node.id, node)

    // Initialize adjacency list if not exists
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set())
    }

    // Add connections
    for (const connectedId of node.connections) {
      this.addEdge(node.id, connectedId)
    }
  }

  /**
   * Add an edge between two nodes (bidirectional)
   */
  addEdge(from: string, to: string): void {
    if (!this.adjacencyList.has(from)) {
      this.adjacencyList.set(from, new Set())
    }
    if (!this.adjacencyList.has(to)) {
      this.adjacencyList.set(to, new Set())
    }

    this.adjacencyList.get(from)!.add(to)
    this.adjacencyList.get(to)!.add(from)
  }

  /**
   * Get a node by ID
   */
  getNode(id: string): RouteNode | undefined {
    return this.nodes.get(id)
  }

  /**
   * Get all neighbors of a node
   */
  getNeighbors(nodeId: string): string[] {
    return Array.from(this.adjacencyList.get(nodeId) || [])
  }

  /**
   * Get all nodes
   */
  getAllNodes(): RouteNode[] {
    return Array.from(this.nodes.values())
  }

  /**
   * Get all country nodes (not chokepoints)
   */
  getCountryNodes(): RouteNode[] {
    return this.getAllNodes().filter(n => n.type === 'country')
  }

  /**
   * Get all chokepoint nodes
   */
  getChokepointNodes(): RouteNode[] {
    return this.getAllNodes().filter(n => n.type === 'chokepoint')
  }

  /**
   * Check if a node exists
   */
  hasNode(id: string): boolean {
    return this.nodes.has(id)
  }

  /**
   * Check if two nodes are connected
   */
  areConnected(from: string, to: string): boolean {
    return this.adjacencyList.get(from)?.has(to) || false
  }

  /**
   * Get distance between two nodes
   */
  getDistance(from: string, to: string): number {
    const fromNode = this.nodes.get(from)
    const toNode = this.nodes.get(to)

    if (!fromNode?.coordinates || !toNode?.coordinates) {
      return 0
    }

    return calculateDistance(fromNode.coordinates, toNode.coordinates)
  }

  /**
   * Get graph statistics
   */
  getStats(): {
    totalNodes: number
    countries: number
    chokepoints: number
    edges: number
    avgRisk: number
  } {
    const nodes = this.getAllNodes()
    const countries = nodes.filter(n => n.type === 'country').length
    const chokepoints = nodes.filter(n => n.type === 'chokepoint').length

    let edgeCount = 0
    for (const neighbors of this.adjacencyList.values()) {
      edgeCount += neighbors.size
    }
    // Each edge is counted twice (bidirectional)
    edgeCount = Math.floor(edgeCount / 2)

    const avgRisk = nodes.length > 0
      ? Math.round(nodes.reduce((sum, n) => sum + n.risk, 0) / nodes.length)
      : 0

    return {
      totalNodes: nodes.length,
      countries,
      chokepoints,
      edges: edgeCount,
      avgRisk,
    }
  }

  /**
   * Find nodes matching a search term
   */
  searchNodes(query: string): RouteNode[] {
    const lowerQuery = query.toLowerCase()
    return this.getAllNodes().filter(
      n => n.name.toLowerCase().includes(lowerQuery) ||
           n.id.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Check if graph is connected (all nodes reachable from any start)
   */
  isConnected(): boolean {
    const nodes = this.getAllNodes()
    if (nodes.length === 0) return true

    const visited = new Set<string>()
    const queue = [nodes[0].id]

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      for (const neighbor of this.getNeighbors(current)) {
        if (!visited.has(neighbor)) {
          queue.push(neighbor)
        }
      }
    }

    return visited.size === nodes.length
  }

  /**
   * Get nodes in different connected components
   */
  getDisconnectedComponents(): string[][] {
    const nodes = this.getAllNodes()
    const visited = new Set<string>()
    const components: string[][] = []

    for (const node of nodes) {
      if (visited.has(node.id)) continue

      const component: string[] = []
      const queue = [node.id]

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)
        component.push(current)

        for (const neighbor of this.getNeighbors(current)) {
          if (!visited.has(neighbor)) {
            queue.push(neighbor)
          }
        }
      }

      if (component.length > 0) {
        components.push(component)
      }
    }

    return components
  }
}

// Singleton instance
let _graphInstance: RouteGraph | null = null

/**
 * Get or create the global route graph instance
 * Returns null if not initialized and no data provided
 */
export function getRouteGraph(data?: CountryRiskData[]): RouteGraph | null {
  if (!_graphInstance && data) {
    _graphInstance = RouteGraph.fromCountryRisks(data)
  }
  return _graphInstance
}

/**
 * Reset the graph instance (useful for testing)
 */
export function resetRouteGraph(): void {
  _graphInstance = null
}

export { COUNTRY_COORDINATES }
