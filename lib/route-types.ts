/**
 * Route Types for Safe Route Finder
 * Core type definitions for the BFS-based route finding system
 */

export type NodeType = 'country' | 'chokepoint'

/**
 * Represents a node in the routing graph (country or chokepoint)
 */
export interface RouteNode {
  id: string
  name: string
  type: NodeType
  risk: number           // Overall risk score (0-100)
  importRisk: number     // Import-side risk (0-100)
  exportRisk: number     // Export-side risk (0-100)
  connections: string[]  // IDs of connected nodes
  newsHighlights: string[]
  coordinates?: [number, number] // [longitude, latitude]
}

/**
 * A segment between two connected nodes
 */
export interface RouteSegment {
  from: string
  to: string
  risk: number
  distance?: number // Estimated distance in km
}

/**
 * A complete route from origin to destination
 */
export interface FoundRoute {
  id: string
  nodes: RouteNode[]
  totalRisk: number
  segmentRisks: number[]
  segments: RouteSegment[]
  chokepointsUsed: string[]
  countriesUsed: string[]
  isRecommended: boolean
  distanceKm?: number
  estimatedDays?: string
}

/**
 * Options for route finding
 */
export interface FindOptions {
  excludeChokepoints?: string[]  // Chokepoints to avoid
  maxWaypoints?: number          // Maximum nodes in a route (default: 6)
  maxRoutes?: number             // Maximum routes to return (default: 3)
  preferShorterRoutes?: boolean  // Prefer shorter routes over safer
}

/**
 * Risk factor breakdown for a segment
 */
export interface RiskFactors {
  baseRisk: number
  chokepointPenalty: number
  distanceFactor: number
  historicalRisk: number
}

/**
 * Result of route finding operation
 */
export interface RouteFindResult {
  success: boolean
  routes: FoundRoute[]
  origin: string
  destination: string
  options: FindOptions
  error?: string
  searchTime?: number // milliseconds
}

/**
 * Preset crisis scenario
 */
export interface ChokepointScenario {
  id: string
  name: string
  description: string
  closedChokepoints: string[]
  riskMultiplier: number
  icon?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

/**
 * Impact analysis for scenario simulation
 */
export interface ImpactAnalysis {
  normalRoutes: FoundRoute[]
  alternateRoutes: FoundRoute[]
  impact: {
    additionalRisk: number
    additionalWaypoints: number
    reroutingRequired: boolean
    affectedCountries: string[]
    estimatedDelay: string
    riskIncrease: number // percentage
  }
  recommendations: string[]
}

/**
 * Segment-level risk analysis
 */
export interface SegmentAnalysis {
  from: string
  to: string
  risk: number
  riskContribution: number // Percentage of total route risk
  riskFactors: RiskFactors
  newsImpact: string[]
  mitigationOptions: string[]
}

/**
 * Complete route analysis with insights
 */
export interface RouteAnalysis {
  route: FoundRoute
  segments: SegmentAnalysis[]
  summary: {
    totalRisk: number
    highestRiskSegment: SegmentAnalysis
    safestSegment: SegmentAnalysis
    chokepointExposure: { name: string; risk: number }[]
    recommendations: string[]
    riskTrend: 'increasing' | 'stable' | 'decreasing'
  }
}

/**
 * Graph edge with risk weight
 */
export interface GraphEdge {
  from: string
  to: string
  weight: number // Risk-based weight for pathfinding
}

/**
 * Country data as defined in app/page.tsx
 * Used to build the route graph
 */
export interface CountryRiskData {
  id: string
  name: string
  type: 'country' | 'chokepoint'
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}
