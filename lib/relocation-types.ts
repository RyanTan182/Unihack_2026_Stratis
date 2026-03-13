/**
 * AI Factory Relocation Advisor - Type Definitions
 *
 * This module contains all TypeScript interfaces for the relocation advisor feature.
 * Works globally for manufacturers targeting any market (EU, US, Asia, Global).
 */

// ============= Request Types =============

export type IndustryType = 'electronics' | 'textiles' | 'automotive' | 'food' | 'pharmaceuticals' | 'general'

export type RiskConcern = 'geopolitical' | 'natural_disaster' | 'trade_barriers' | 'labor'

export type Priority = 'cost' | 'stability' | 'infrastructure' | 'market_access'

export type TargetMarket = 'EU' | 'US' | 'Asia' | 'Global'

/**
 * Country risk data for simulation
 */
export interface CountryRiskData {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

/**
 * User input for relocation analysis
 */
export interface RelocationRequest {
  currentCountry: string
  industryType: IndustryType
  riskConcerns: RiskConcern[]
  priorities: Priority[]
  targetMarkets: TargetMarket[] // Required - determines trade agreement relevance
}

// ============= Response Types =============

export type InfrastructureRating = 'excellent' | 'good' | 'moderate' | 'developing'

export type CostFactor = 'low' | 'medium' | 'high'

export interface ExportRouteInfo {
  via: string[]
  chokepoints: string[]
  risk: number
}

export interface RiskAnalysis {
  geopolitical: number
  naturalDisaster: number
  tradeBarriers: number
  labor: number
}

/**
 * AI-generated country recommendation with scores and analysis
 */
export interface RelocationRecommendation {
  country: string
  countryId: string // Normalized ID for matching with countryRisks
  overallScore: number // 0-100, higher is better
  riskAnalysis: RiskAnalysis
  advantages: string[]
  challenges: string[]
  estimatedCostFactor: CostFactor
  exportRoutes: {
    toEU: ExportRouteInfo
    toUS: ExportRouteInfo
    toAsia: ExportRouteInfo
  }
  tradeAgreements: string[]
  infrastructure: InfrastructureRating
  targetMarketAccess: {
    eu: 'excellent' | 'good' | 'moderate' | 'limited'
    us: 'excellent' | 'good' | 'moderate' | 'limited'
    asia: 'excellent' | 'good' | 'moderate' | 'limited'
  }
}

// ============= Comparison Types =============

export interface CountryComparisonData {
  name: string
  countryId: string
  flag: string
  scores: {
    overall: number
    geopolitical: number
    export: number
    infrastructure: number
    cost: number
  }
  tradeAgreements: string[]
  majorPorts: string[]
  averageShippingTime: {
    toEU: string
    toUS: string
    toAsia: string
  }
  laborCostIndex: number
  infrastructureRating: InfrastructureRating
  targetMarketAccess: {
    eu: 'excellent' | 'good' | 'moderate' | 'limited'
    us: 'excellent' | 'good' | 'moderate' | 'limited'
    asia: 'excellent' | 'good' | 'moderate' | 'limited'
  }
}

/**
 * Side-by-side comparison data for multiple candidates
 */
export interface CountryComparison {
  countries: CountryComparisonData[]
  winner: {
    overall: string
    geopolitical: string
    export: string
    cost: string
  }
}

// ============= Simulation Types =============

export interface RouteInfo {
  destination: string
  path: string[]
  chokepoints: string[]
  riskScore: number
  transitDays: string
}

export interface RelocationSimulationCurrent {
  country: string
  countryId: string
  overallRisk: number
  exportRoutes: RouteInfo[]
  affectedProducts: string[]
}

export interface RelocationSimulationProposed {
  country: string
  countryId: string
  overallRisk: number
  exportRoutes: RouteInfo[]
  riskReduction: number // percentage
}

export interface RelocationSimulationImpact {
  riskReduction: string // "X% lower risk"
  newChokepointExposure: string[] // chokepoints no longer used
  avoidedChokepoints: string[] // chokepoints avoided by relocation
  estimatedCost: string // "Medium - $X-XX million"
  timeline: string // "12-18 months"
  recommendations: string[]
}

/**
 * Before/after analysis of relocation impact
 */
export interface RelocationSimulation {
  current: RelocationSimulationCurrent
  proposed: RelocationSimulationProposed
  impact: RelocationSimulationImpact
}

// ============= Scoring Types =============

export interface IndustryWeights {
  infrastructure?: number
  geopolitical?: number
  cost?: number
  labor?: number
  tradeAgreements?: number
  naturalDisaster?: number
  export?: number
}

/**
 * Industry-specific scoring weights
 * Different industries prioritize different factors
 */
export const INDUSTRY_WEIGHTS: Record<IndustryType, IndustryWeights> = {
  electronics: { infrastructure: 0.25, geopolitical: 0.30, tradeAgreements: 0.15, export: 0.20 },
  textiles: { cost: 0.25, labor: 0.20, infrastructure: 0.20, geopolitical: 0.15 },
  automotive: { infrastructure: 0.30, tradeAgreements: 0.20, geopolitical: 0.20, export: 0.15 },
  pharmaceuticals: { infrastructure: 0.35, geopolitical: 0.25, tradeAgreements: 0.15 },
  food: { naturalDisaster: 0.25, infrastructure: 0.20, export: 0.20, geopolitical: 0.15 },
  general: { geopolitical: 0.40, export: 0.30, infrastructure: 0.15, tradeAgreements: 0.15 },
}

// ============= API Response Types =============

export interface RelocationAnalyzeResponse {
  recommendations: RelocationRecommendation[]
  currentCountry: {
    name: string
    overallRisk: number
  }
  analysisTimestamp: string
}

export interface RelocationCompareRequest {
  countryIds: string[]
  targetMarkets: TargetMarket[]
}

export interface RelocationSimulateRequest {
  currentCountryId: string
  targetCountryId: string
  industryType: IndustryType
}
