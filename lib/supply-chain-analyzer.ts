/**
 * Supply Chain Analyzer
 * Core analysis engine for supply chain insights
 *
 * Consolidates analysis logic for supply chains including:
 * - Health scoring
 * - Risk breakdown
 * - Supplier alternatives
 * - Price impact estimation
 * - Actionable recommendations
 */

import type { CountryRiskData } from './route-types'
import { findRoutes } from './route-finder'
import { getRiskLevel } from './risk-calculator'
import { getLaborCostIndex, getMarketAccess, getInfrastructureRating } from './trade-agreements'

// ============= Types =============

export interface SupplyChainInsights {
  healthScore: number           // 0-100 overall health
  riskBreakdown: {
    geopolitical: number
    logistics: number
    priceVolatility: number
  }
  highRiskComponents: ComponentRisk[]
  criticalChokepoints: ChokepointExposure[]
  priceImpact: {
    estimated: string           // "+8%" or "-3%"
    factors: PriceFactor[]
  }
  recommendations: Recommendation[]
}

export interface ComponentRisk {
  componentId: string
  componentName: string
  country: string
  risk: number
  factors: string[]
  alternatives: SupplierAlternative[]
}

export interface SupplierAlternative {
  country: string
  risk: number
  costFactor: 'lower' | 'similar' | 'higher'
  advantages: string[]
  routeRisk: number
}

export interface ChokepointExposure {
  name: string
  risk: number
  affectedComponents: string[]
  alternativeRoutes: number
}

export interface PriceFactor {
  source: string
  impact: 'increase' | 'decrease' | 'neutral'
  magnitude: number // percentage
  description: string
}

export interface Recommendation {
  id: string
  type: 'critical' | 'warning' | 'info' | 'opportunity'
  title: string
  description: string
  action: string
  componentId?: string
  targetCountry?: string
  potentialSavings?: string
}

export interface SupplyChainItem {
  id: string
  name: string
  type: 'product' | 'component' | 'material' | 'resource'
  country: string
  parentDestination?: string
  children?: SupplyChainItem[]
}

export interface Product {
  id: string
  name: string
  country: string
  destinationCountry?: string // Optional destination for route calculations
  components: SupplyChainItem[]
}

// ============= Core Functions =============

/**
 * Calculate health score for a supply chain
 */
function calculateHealthScore(
  components: SupplyChainItem[],
  countryRisks: CountryRiskData[]
): number {
  if (components.length === 0) return 100

  let totalRisk = 0
  let componentCount = 0

  const processItem = (item: SupplyChainItem) => {
    const countryRisk = countryRisks.find(c => c.id === item.country || c.name === item.country)
    if (countryRisk) {
      totalRisk += countryRisk.overallRisk
      componentCount++
    }
    if (item.children) {
      item.children.forEach(processItem)
    }
  }

  components.forEach(processItem)

  if (componentCount === 0) return 100

  const avgRisk = totalRisk / componentCount
  return Math.round(100 - avgRisk)
}

/**
 * Calculate risk breakdown by category
 */
function calculateRiskBreakdown(
  components: SupplyChainItem[],
  countryRisks: CountryRiskData[]
): { geopolitical: number; logistics: number; priceVolatility: number } {
  if (components.length === 0) {
    return { geopolitical: 0, logistics: 0, priceVolatility: 0 }
  }

  let geopolitical = 0
  let logistics = 0
  let priceVolatility = 0
  let count = 0

  const processItem = (item: SupplyChainItem) => {
    const countryRisk = countryRisks.find(c => c.id === item.country || c.name === item.country)
    if (countryRisk) {
      // Geopolitical: based on overall risk and news mentions
      const hasConflictNews = countryRisk.newsHighlights.some(n =>
        n.toLowerCase().includes('conflict') ||
        n.toLowerCase().includes('sanction') ||
        n.toLowerCase().includes('tension')
      )
      geopolitical += hasConflictNews ? countryRisk.overallRisk * 1.2 : countryRisk.overallRisk * 0.8

      // Logistics: based on import/export risks
      logistics += (countryRisk.importRisk + countryRisk.exportRisk) / 2

      // Price volatility: based on labor cost index and infrastructure
      const laborCost = getLaborCostIndex(item.country)
      const infrastructure = getInfrastructureRating(item.country)
      const infraFactor = infrastructure === 'developing' ? 1.3 : infrastructure === 'moderate' ? 1.1 : 1.0
      priceVolatility += Math.min(100, (laborCost * 0.5 + 30) * infraFactor)

      count++
    }
    if (item.children) {
      item.children.forEach(processItem)
    }
  }

  components.forEach(processItem)

  if (count === 0) {
    return { geopolitical: 0, logistics: 0, priceVolatility: 0 }
  }

  return {
    geopolitical: Math.round(geopolitical / count),
    logistics: Math.round(logistics / count),
    priceVolatility: Math.round(priceVolatility / count)
  }
}

/**
 * Find supplier alternatives for a component
 */
export function findSupplierAlternatives(
  currentCountry: string,
  destinationCountry: string,
  countryRisks: CountryRiskData[],
  maxAlternatives: number = 3
): SupplierAlternative[] {
  const currentRisk = countryRisks.find(c => c.id === currentCountry || c.name === currentCountry)
  if (!currentRisk) return []

  const currentLaborCost = getLaborCostIndex(currentCountry)
  const alternatives: SupplierAlternative[] = []

  // Get all countries with lower risk
  const candidateCountries = countryRisks.filter(c =>
    c.type === 'country' &&
    c.id !== currentCountry &&
    c.name !== currentCountry &&
    c.overallRisk < currentRisk.overallRisk &&
    c.overallRisk < 70 // Exclude very high risk countries
  )

  // Sort by risk (lowest first)
  candidateCountries.sort((a, b) => a.overallRisk - b.overallRisk)

  for (const country of candidateCountries.slice(0, 10)) {
    const laborCost = getLaborCostIndex(country.name)
    const infrastructure = getInfrastructureRating(country.name)

    // Calculate route risk to destination
    let routeRisk = 50 // Default
    try {
      const routeResult = findRoutes(country.id, destinationCountry, { maxRoutes: 1 })
      if (routeResult.success && routeResult.routes.length > 0) {
        routeRisk = routeResult.routes[0].totalRisk
      }
    } catch {
      // Route finding failed, use default
    }

    // Determine cost factor
    let costFactor: 'lower' | 'similar' | 'higher'
    if (laborCost < currentLaborCost * 0.8) {
      costFactor = 'lower'
    } else if (laborCost > currentLaborCost * 1.2) {
      costFactor = 'higher'
    } else {
      costFactor = 'similar'
    }

    // Generate advantages
    const advantages: string[] = []

    if (country.overallRisk < currentRisk.overallRisk * 0.7) {
      advantages.push(`${Math.round((1 - country.overallRisk / currentRisk.overallRisk) * 100)}% lower geopolitical risk`)
    }

    if (costFactor === 'lower') {
      advantages.push('Lower labor costs')
    }

    if (infrastructure === 'excellent' || infrastructure === 'good') {
      advantages.push(`${infrastructure} infrastructure`)
    }

    // Check market access
    const marketAccess = getMarketAccess(country.name, 'us')
    if (marketAccess === 'excellent' || marketAccess === 'good') {
      advantages.push('Good US market access')
    }

    if (advantages.length === 0) {
      advantages.push('Diversified supply chain')
    }

    alternatives.push({
      country: country.name,
      risk: country.overallRisk,
      costFactor,
      advantages: advantages.slice(0, 3),
      routeRisk
    })

    if (alternatives.length >= maxAlternatives) break
  }

  return alternatives
}

/**
 * Calculate price impact for a component
 */
function calculatePriceImpact(
  item: SupplyChainItem,
  countryRisks: CountryRiskData[]
): PriceFactor[] {
  const factors: PriceFactor[] = []
  const countryRisk = countryRisks.find(c => c.id === item.country || c.name === item.country)

  if (!countryRisk) return factors

  // Check for tariff-related news
  const tariffNews = countryRisk.newsHighlights.find(n =>
    n.toLowerCase().includes('tariff') ||
    n.toLowerCase().includes('duty')
  )
  if (tariffNews) {
    factors.push({
      source: 'Tariff Risk',
      impact: 'increase',
      magnitude: 5,
      description: tariffNews
    })
  }

  // Check for sanctions
  const sanctionNews = countryRisk.newsHighlights.find(n =>
    n.toLowerCase().includes('sanction')
  )
  if (sanctionNews) {
    factors.push({
      source: 'Sanctions',
      impact: 'increase',
      magnitude: 15,
      description: sanctionNews
    })
  }

  // Check for logistics issues
  const logisticsNews = countryRisk.newsHighlights.find(n =>
    n.toLowerCase().includes('congestion') ||
    n.toLowerCase().includes('delay') ||
    n.toLowerCase().includes('disruption')
  )
  if (logisticsNews) {
    factors.push({
      source: 'Logistics',
      impact: 'increase',
      magnitude: 3,
      description: logisticsNews
    })
  }

  // Risk-based price impact
  if (countryRisk.overallRisk > 60) {
    factors.push({
      source: 'Risk Premium',
      impact: 'increase',
      magnitude: Math.round((countryRisk.overallRisk - 50) / 5),
      description: `High geopolitical risk (${countryRisk.overallRisk}%) affecting pricing`
    })
  }

  return factors
}

/**
 * Find critical chokepoints affecting the supply chain
 */
function findCriticalChokepoints(
  components: SupplyChainItem[],
  countryRisks: CountryRiskData[]
): ChokepointExposure[] {
  const chokepointMap = new Map<string, { risk: number; components: Set<string> }>()

  const processItem = (item: SupplyChainItem, destination?: string) => {
    // Find routes from component to destination
    if (destination) {
      try {
        const routeResult = findRoutes(item.country, destination, { maxRoutes: 1 })
        if (routeResult.success && routeResult.routes.length > 0) {
          for (const chokepoint of routeResult.routes[0].chokepointsUsed) {
            const chokepointData = countryRisks.find(c => c.id === chokepoint)
            if (chokepointData) {
              if (!chokepointMap.has(chokepoint)) {
                chokepointMap.set(chokepoint, {
                  risk: chokepointData.overallRisk,
                  components: new Set()
                })
              }
              chokepointMap.get(chokepoint)!.components.add(item.name)
            }
          }
        }
      } catch {
        // Route finding failed
      }
    }

    // Process children
    if (item.children) {
      const childDestination = item.parentDestination || destination
      item.children.forEach(child => processItem(child, childDestination))
    }
  }

  components.forEach(item => processItem(item, undefined))

  // Convert to array and find alternatives
  const exposures: ChokepointExposure[] = []
  for (const [name, data] of chokepointMap) {
    let alternativeRoutes = 0
    try {
      const altResult = findRoutes('China', 'United States', {
        excludeChokepoints: [name],
        maxRoutes: 1
      })
      alternativeRoutes = altResult.success ? altResult.routes.length : 0
    } catch {
      alternativeRoutes = 0
    }

    exposures.push({
      name,
      risk: data.risk,
      affectedComponents: Array.from(data.components),
      alternativeRoutes
    })
  }

  // Sort by risk (highest first)
  exposures.sort((a, b) => b.risk - a.risk)

  return exposures
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(
  components: SupplyChainItem[],
  countryRisks: CountryRiskData[],
  highRiskComponents: ComponentRisk[],
  criticalChokepoints: ChokepointExposure[],
  priceImpact: PriceFactor[]
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // Critical: High risk components without alternatives
  for (const comp of highRiskComponents.filter(c => c.risk > 70)) {
    if (comp.alternatives.length === 0) {
      recommendations.push({
        id: `rec-critical-${comp.componentId}`,
        type: 'critical',
        title: `High-risk dependency: ${comp.componentName}`,
        description: `${comp.componentName} from ${comp.country} has no identified alternatives and ${comp.risk}% risk.`,
        action: 'Consider developing backup suppliers or building inventory buffer',
        componentId: comp.componentId
      })
    } else {
      const bestAlt = comp.alternatives[0]
      recommendations.push({
        id: `rec-alt-${comp.componentId}`,
        type: 'warning',
        title: `Alternative supplier available for ${comp.componentName}`,
        description: `${bestAlt.country} offers ${100 - Math.round(bestAlt.risk / comp.risk * 100)}% lower risk at ${bestAlt.costFactor} cost.`,
        action: `Evaluate ${bestAlt.country} as alternative supplier`,
        componentId: comp.componentId,
        targetCountry: bestAlt.country,
        potentialSavings: bestAlt.costFactor === 'lower' ? 'Potential cost savings' : undefined
      })
    }
  }

  // Chokepoint recommendations
  for (const chokepoint of criticalChokepoints.filter(c => c.risk > 70 && c.alternativeRoutes === 0)) {
    recommendations.push({
      id: `rec-choke-${chokepoint.name}`,
      type: 'critical',
      title: `Critical chokepoint: ${chokepoint.name}`,
      description: `${chokepoint.name} has ${chokepoint.risk}% risk and affects ${chokepoint.affectedComponents.length} components with no alternatives.`,
      action: 'Develop contingency routing or consider geographic diversification'
    })
  }

  // Price impact recommendations
  const totalImpact = priceImpact.reduce((sum, f) => sum + (f.impact === 'increase' ? f.magnitude : -f.magnitude), 0)
  if (totalImpact > 10) {
    recommendations.push({
      id: 'rec-price',
      type: 'warning',
      title: 'Significant price pressure detected',
      description: `Estimated ${totalImpact}% price increase due to ${priceImpact.length} factors.`,
      action: 'Review pricing strategy and consider hedging or long-term contracts'
    })
  }

  // Diversification opportunity
  const countryCounts = new Map<string, number>()
  const processItem = (item: SupplyChainItem) => {
    countryCounts.set(item.country, (countryCounts.get(item.country) || 0) + 1)
    if (item.children) item.children.forEach(processItem)
  }
  components.forEach(processItem)

  const dominantCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  if (dominantCountry && dominantCountry[1] > 2) {
    const risk = countryRisks.find(c => c.id === dominantCountry[0] || c.name === dominantCountry[0])
    if (risk && risk.overallRisk > 40) {
      recommendations.push({
        id: 'rec-diversify',
        type: 'info',
        title: 'Supply chain concentration risk',
        description: `${dominantCountry[1]} components sourced from ${dominantCountry[0]} (${risk.overallRisk}% risk).`,
        action: 'Consider diversifying suppliers across multiple countries'
      })
    }
  }

  return recommendations.slice(0, 5) // Limit to top 5 recommendations
}

/**
 * Main function: Analyze supply chain and return insights
 */
export function analyzeSupplyChain(
  products: Product[],
  countryRisks: CountryRiskData[]
): SupplyChainInsights {
  // Flatten all components from products
  const allComponents: SupplyChainItem[] = []
  for (const product of products) {
    allComponents.push(...product.components)
  }

  if (allComponents.length === 0) {
    return {
      healthScore: 100,
      riskBreakdown: { geopolitical: 0, logistics: 0, priceVolatility: 0 },
      highRiskComponents: [],
      criticalChokepoints: [],
      priceImpact: { estimated: '0%', factors: [] },
      recommendations: []
    }
  }

  // Calculate health score
  const healthScore = calculateHealthScore(allComponents, countryRisks)

  // Calculate risk breakdown
  const riskBreakdown = calculateRiskBreakdown(allComponents, countryRisks)

  // Find high-risk components
  const highRiskComponents: ComponentRisk[] = []
  const processItem = (item: SupplyChainItem, destination?: string) => {
    const countryRisk = countryRisks.find(c => c.id === item.country || c.name === item.country)
    if (countryRisk && countryRisk.overallRisk > 50) {
      const factors: string[] = []

      if (countryRisk.newsHighlights.some(n => n.toLowerCase().includes('sanction'))) {
        factors.push('Active sanctions')
      }
      if (countryRisk.newsHighlights.some(n => n.toLowerCase().includes('conflict'))) {
        factors.push('Regional conflict')
      }
      if (countryRisk.newsHighlights.some(n => n.toLowerCase().includes('tariff'))) {
        factors.push('Tariff exposure')
      }
      if (countryRisk.overallRisk > 70) {
        factors.push('High geopolitical risk')
      }

      // Find alternatives (using product country as destination)
      const destinationCountry = destination || 'United States'
      const alternatives = findSupplierAlternatives(item.country, destinationCountry, countryRisks, 3)

      highRiskComponents.push({
        componentId: item.id,
        componentName: item.name,
        country: item.country,
        risk: countryRisk.overallRisk,
        factors: factors.length > 0 ? factors : ['Elevated risk'],
        alternatives
      })
    }

    if (item.children) {
      item.children.forEach(child => processItem(child, item.parentDestination || destination))
    }
  }

  products.forEach(product => {
    const destination = product.destinationCountry || 'United States'
    product.components.forEach(comp => processItem(comp, destination))
  })

  // Sort by risk (highest first)
  highRiskComponents.sort((a, b) => b.risk - a.risk)

  // Find critical chokepoints
  const criticalChokepoints = findCriticalChokepoints(allComponents, countryRisks)

  // Calculate total price impact
  const allPriceFactors: PriceFactor[] = []
  const processPriceImpact = (item: SupplyChainItem) => {
    allPriceFactors.push(...calculatePriceImpact(item, countryRisks))
    if (item.children) item.children.forEach(processPriceImpact)
  }
  allComponents.forEach(processPriceImpact)

  const totalImpact = allPriceFactors.reduce((sum, f) => {
    return sum + (f.impact === 'increase' ? f.magnitude : -f.magnitude)
  }, 0)

  const priceImpact = {
    estimated: totalImpact >= 0 ? `+${totalImpact}%` : `${totalImpact}%`,
    factors: allPriceFactors.slice(0, 5)
  }

  // Generate recommendations
  const recommendations = generateRecommendations(
    allComponents,
    countryRisks,
    highRiskComponents,
    criticalChokepoints,
    allPriceFactors
  )

  return {
    healthScore,
    riskBreakdown,
    highRiskComponents: highRiskComponents.slice(0, 5),
    criticalChokepoints: criticalChokepoints.slice(0, 3),
    priceImpact,
    recommendations
  }
}

/**
 * Get risk level info for a score
 */
export { getRiskLevel }
