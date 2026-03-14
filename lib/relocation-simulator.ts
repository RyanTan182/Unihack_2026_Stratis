/**
 * AI Factory Relocation Simulator - Simulation Logic
 *
 * Calculates the impact of relocating a factory from one country to another,
 * including risk reduction, cost estimates, and timeline projections.
 */

import type { InfrastructureRating } from "@/lib/relocation-types"

export interface SimulationInput {
  currentCountry: string
  targetCountry: string
  currentRisk: number
  targetRisk: number
  industry: string
  infrastructure: InfrastructureRating
  laborCostIndex: number
}

export interface SimulationResult {
  riskReduction: number
  costEstimate: {
    level: "low" | "medium" | "high"
    range: string
    breakdown: {
      equipment: string
      labor: string
      logistics: string
      permits: string
      contingency: string
    }
  }
  timeline: {
    totalMonths: string
    phases: {
      name: string
      duration: string
      description: string
    }[]
  }
  avoidedChokepoints: string[]
  newExposure: string[]
  recommendations: string[]
}

// Industry-specific base costs (in millions USD)
const INDUSTRY_BASE_COSTS: Record<string, number> = {
  electronics: 15,
  textiles: 8,
  automotive: 25,
  food: 12,
  pharmaceuticals: 20,
  general: 10,
}

// Infrastructure multipliers
const INFRA_MULTIPLIERS: Record<InfrastructureRating, number> = {
  excellent: 0.8,
  good: 1.0,
  moderate: 1.3,
  developing: 1.6,
}

// Industry-specific base timelines (in months)
const INDUSTRY_BASE_TIMELINES: Record<string, number> = {
  electronics: 12,
  textiles: 8,
  automotive: 18,
  food: 10,
  pharmaceuticals: 15,
  general: 10,
}

// High-risk chokepoints to check
const HIGH_RISK_CHOKEPOINTS = [
  "Strait of Hormuz",
  "Bab-el-Mandeb",
  "Suez Canal",
  "Strait of Malacca",
  "Panama Canal",
  "Bosphorus",
  "Taiwan Strait",
]

/**
 * Calculate risk reduction percentage
 */
export function calculateRiskReduction(currentRisk: number, targetRisk: number): number {
  if (currentRisk === 0) return 0
  const reduction = ((currentRisk - targetRisk) / currentRisk) * 100
  return Math.round(Math.max(0, reduction))
}

/**
 * Estimate relocation cost based on industry and infrastructure
 */
export function estimateRelocationCost(
  industry: string,
  infrastructure: InfrastructureRating,
  laborCostIndex: number
): { level: "low" | "medium" | "high"; range: string } {
  const baseCost = INDUSTRY_BASE_COSTS[industry] || 10
  const infraMultiplier = INFRA_MULTIPLIERS[infrastructure] || 1.0

  // Labor cost adjustment (lower is better for cost savings)
  const laborMultiplier = Math.max(0.5, laborCostIndex / 50)

  const totalCost = baseCost * infraMultiplier * laborMultiplier

  if (totalCost < 10) {
    return { level: "low", range: "$5-10 million" }
  } else if (totalCost < 20) {
    return { level: "medium", range: "$10-25 million" }
  } else {
    return { level: "high", range: "$25-50 million" }
  }
}

/**
 * Estimate relocation timeline based on industry and infrastructure
 */
export function estimateRelocationTimeline(
  industry: string,
  infrastructure: InfrastructureRating
): string {
  const baseMonths = INDUSTRY_BASE_TIMELINES[industry] || 10
  const infraMultiplier = INFRA_MULTIPLIERS[infrastructure] || 1.0

  const totalMonths = Math.round(baseMonths * infraMultiplier)
  const variance = 2

  return `${totalMonths - variance}-${totalMonths + variance} months`
}

/**
 * Generate timeline phases for relocation
 */
export function generateTimelinePhases(
  industry: string,
  infrastructure: InfrastructureRating
): { name: string; duration: string; description: string }[] {
  const baseMonths = INDUSTRY_BASE_TIMELINES[industry] || 10
  const infraMultiplier = INFRA_MULTIPLIERS[infrastructure] || 1.0

  // Calculate phase durations based on total timeline
  const totalMonths = Math.round(baseMonths * infraMultiplier)

  return [
    {
      name: "Planning & Assessment",
      duration: `${Math.round(totalMonths * 0.15)} months`,
      description: "Site selection, regulatory review, and feasibility studies",
    },
    {
      name: "Permits & Legal",
      duration: `${Math.round(totalMonths * 0.2)} months`,
      description: "Obtain necessary permits, licenses, and legal clearances",
    },
    {
      name: "Facility Setup",
      duration: `${Math.round(totalMonths * 0.35)} months`,
      description: "Construction or renovation, equipment installation",
    },
    {
      name: "Equipment Transfer",
      duration: `${Math.round(totalMonths * 0.15)} months`,
      description: "Move and install production equipment from current facility",
    },
    {
      name: "Testing & Certification",
      duration: `${Math.round(totalMonths * 0.15)} months`,
      description: "Quality assurance, certifications, and production trials",
    },
  ]
}

/**
 * Generate cost breakdown
 */
export function generateCostBreakdown(
  industry: string,
  infrastructure: InfrastructureRating,
  laborCostIndex: number
): { equipment: string; labor: string; logistics: string; permits: string; contingency: string } {
  const baseCost = INDUSTRY_BASE_COSTS[industry] || 10
  const infraMultiplier = INFRA_MULTIPLIERS[infrastructure] || 1.0
  const total = baseCost * infraMultiplier

  return {
    equipment: `$${Math.round(total * 0.35)}M - Equipment purchase and installation`,
    labor: `$${Math.round(total * 0.25)}M - Labor and training costs`,
    logistics: `$${Math.round(total * 0.15)}M - Shipping and logistics`,
    permits: `$${Math.round(total * 0.1)}M - Permits and legal fees`,
    contingency: `$${Math.round(total * 0.15)}M - Contingency buffer`,
  }
}

/**
 * Identify chokepoints avoided by relocation
 */
export function identifyAvoidedChokepoints(
  currentConnections: string[],
  targetConnections: string[]
): string[] {
  const currentChokepoints = currentConnections.filter((c) =>
    HIGH_RISK_CHOKEPOINTS.some((h) => c.includes(h) || h.includes(c))
  )

  const targetChokepoints = targetConnections.filter((c) =>
    HIGH_RISK_CHOKEPOINTS.some((h) => c.includes(h) || h.includes(c))
  )

  return currentChokepoints.filter((c) => !targetChokepoints.includes(c))
}

/**
 * Identify new chokepoint exposure
 */
export function identifyNewExposure(
  currentConnections: string[],
  targetConnections: string[]
): string[] {
  const currentChokepoints = currentConnections.filter((c) =>
    HIGH_RISK_CHOKEPOINTS.some((h) => c.includes(h) || h.includes(c))
  )

  const targetChokepoints = targetConnections.filter((c) =>
    HIGH_RISK_CHOKEPOINTS.some((h) => c.includes(h) || h.includes(c))
  )

  return targetChokepoints.filter((c) => !currentChokepoints.includes(c))
}

/**
 * Generate relocation recommendations
 */
export function generateRelocationRecommendations(
  riskReduction: number,
  infrastructure: InfrastructureRating,
  laborCostIndex: number,
  avoidedChokepoints: string[]
): string[] {
  const recommendations: string[] = []

  if (riskReduction >= 40) {
    recommendations.push(
      "Excellent risk reduction opportunity. This relocation significantly improves supply chain resilience."
    )
  } else if (riskReduction >= 20) {
    recommendations.push(
      "Good risk reduction. Consider additional measures to maximize resilience benefits."
    )
  } else if (riskReduction >= 0) {
    recommendations.push(
      "Moderate risk improvement. Evaluate if other factors justify the relocation."
    )
  } else {
    recommendations.push(
      "Limited risk benefit. Ensure other strategic factors drive this decision."
    )
  }

  if (infrastructure === "developing" || infrastructure === "moderate") {
    recommendations.push(
      "Invest in infrastructure upgrades during setup to improve long-term efficiency."
    )
  }

  if (laborCostIndex > 60) {
    recommendations.push(
      "Higher labor costs expected. Consider automation to maintain cost competitiveness."
    )
  } else if (laborCostIndex < 40) {
    recommendations.push(
      "Labor cost advantage can offset initial relocation expenses."
    )
  }

  if (avoidedChokepoints.length > 0) {
    recommendations.push(
      `Avoiding ${avoidedChokepoints.length} high-risk chokepoint(s): ${avoidedChokepoints.join(", ")}.`
    )
  }

  recommendations.push(
    "Conduct detailed feasibility study before finalizing relocation decision."
  )

  return recommendations
}

/**
 * Run complete relocation simulation
 */
export function runRelocationSimulation(input: SimulationInput): SimulationResult {
  const riskReduction = calculateRiskReduction(input.currentRisk, input.targetRisk)
  const costEstimate = estimateRelocationCost(
    input.industry,
    input.infrastructure,
    input.laborCostIndex
  )
  const timeline = estimateRelocationTimeline(input.industry, input.infrastructure)

  return {
    riskReduction,
    costEstimate: {
      ...costEstimate,
      breakdown: generateCostBreakdown(
        input.industry,
        input.infrastructure,
        input.laborCostIndex
      ),
    },
    timeline: {
      totalMonths: timeline,
      phases: generateTimelinePhases(input.industry, input.infrastructure),
    },
    avoidedChokepoints: [], // To be populated with actual connection data
    newExposure: [], // To be populated with actual connection data
    recommendations: generateRelocationRecommendations(
      riskReduction,
      input.infrastructure,
      input.laborCostIndex,
      []
    ),
  }
}
