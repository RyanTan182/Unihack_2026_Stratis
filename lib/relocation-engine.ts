/**
 * AI Factory Relocation Advisor - Recommendation Engine
 *
 * Core logic for scoring and filtering countries for relocation recommendations.
 * Works globally for manufacturers targeting any market (EU, US, Asia, Global).
 */

import {
  RelocationRequest,
  RelocationRecommendation,
  IndustryType,
  TargetMarket,
  IndustryWeights,
  INDUSTRY_WEIGHTS,
  InfrastructureRating,
  CostFactor,
} from './relocation-types'
import {
  getTradeAgreements,
  getAllTradeAgreements,
  getLaborCostIndex,
  getInfrastructureRating,
  getMarketAccess,
  MAJOR_PORTS,
} from './trade-agreements'

// ============= Types =============

interface CountryRiskData {
  id: string
  name: string
  type: 'country' | 'chokepoint'
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

interface ScoringFactors {
  geopolitical: number
  export: number
  infrastructure: number
  tradeAgreements: number
  cost: number
}

// ============= Core Functions =============

/**
 * Filter countries based on risk threshold
 * Only recommend countries with lower risk than current location
 */
export function filterCountriesByRisk(
  countries: CountryRiskData[],
  currentCountryRisk: number,
  thresholdPercent: number = 20
): CountryRiskData[] {
  const maxAcceptableRisk = currentCountryRisk * (1 + thresholdPercent / 100)

  return countries.filter(country => {
    // Only include actual countries, not chokepoints
    if (country.type !== 'country') return false
    // Skip sanctioned or extremely high-risk countries
    if (country.overallRisk > 85) return false
    // Must be better than current location
    return country.overallRisk <= maxAcceptableRisk
  })
}

/**
 * Calculate composite score for a country
 */
export function calculateScore(
  country: CountryRiskData,
  request: RelocationRequest,
  weights: IndustryWeights
): number {
  // 1. Geopolitical risk score (inverse - lower risk = higher score)
  const geopoliticalScore = 100 - country.overallRisk

  // 2. Export stability score (inverse - lower export risk = higher score)
  const exportScore = 100 - country.exportRisk

  // 3. Infrastructure score
  const infrastructureMap: Record<InfrastructureRating, number> = {
    'excellent': 100,
    'good': 75,
    'moderate': 50,
    'developing': 25,
  }
  const infrastructureScore = infrastructureMap[getInfrastructureRating(country.name)]

  // 4. Trade agreement score based on target markets
  let tradeAgreementScore = 0
  const targetMarkets = request.targetMarkets
  const maxMarkets = Math.max(targetMarkets.length, 1)

  for (const market of targetMarkets) {
    const marketKey = market.toLowerCase() as 'eu' | 'us' | 'asia'
    const access = getMarketAccess(country.name, marketKey)
    const accessScore = access === 'excellent' ? 100 : access === 'good' ? 75 : access === 'moderate' ? 50 : 25
    tradeAgreementScore += accessScore
  }
  tradeAgreementScore = tradeAgreementScore / maxMarkets

  // 5. Cost score (inverse - lower labor cost = higher score for cost savings)
  const laborCost = getLaborCostIndex(country.name)
  const costScore = 100 - laborCost

  // Calculate weighted composite score
  const factors: ScoringFactors = {
    geopolitical: geopoliticalScore,
    export: exportScore,
    infrastructure: infrastructureScore,
    tradeAgreements: tradeAgreementScore,
    cost: costScore,
  }

  let compositeScore = 0
  let totalWeight = 0

  for (const [key, weight] of Object.entries(weights)) {
    if (weight && factors[key as keyof ScoringFactors] !== undefined) {
      compositeScore += factors[key as keyof ScoringFactors] * weight
      totalWeight += weight
    }
  }

  // Normalize to 0-100 scale
  return totalWeight > 0 ? Math.round(compositeScore / totalWeight) : 0
}

/**
 * Estimate cost factor based on country development level
 */
function estimateCostFactor(country: string): CostFactor {
  const laborCost = getLaborCostIndex(country)
  const infrastructure = getInfrastructureRating(country)

  // Low cost: low labor cost + at least moderate infrastructure
  if (laborCost < 25 && (infrastructure === 'good' || infrastructure === 'excellent')) {
    return 'low'
  }
  // High cost: high labor cost OR poor infrastructure
  if (laborCost > 70 || infrastructure === 'developing') {
    return 'high'
  }
  return 'medium'
}

/**
 * Generate advantages for a country recommendation
 */
function generateAdvantages(
  country: CountryRiskData,
  request: RelocationRequest
): string[] {
  const advantages: string[] = []

  // Risk reduction
  if (country.overallRisk < 30) {
    advantages.push('Very low geopolitical risk')
  } else if (country.overallRisk < 50) {
    advantages.push('Moderate geopolitical risk')
  }

  // Trade agreements
  for (const market of request.targetMarkets) {
    const marketKey = market.toLowerCase() as 'eu' | 'us' | 'asia'
    const agreements = getTradeAgreements(country.name, marketKey)
    if (agreements.length > 0) {
      advantages.push(`${market} market access via ${agreements[0]}`)
    }
  }

  // Infrastructure
  const infra = getInfrastructureRating(country.name)
  if (infra === 'excellent') {
    advantages.push('Excellent port and logistics infrastructure')
  } else if (infra === 'good') {
    advantages.push('Good infrastructure with modern ports')
  }

  // Cost
  const laborCost = getLaborCostIndex(country.name)
  if (laborCost < 20) {
    advantages.push('Very competitive labor costs')
  } else if (laborCost < 35) {
    advantages.push('Competitive labor costs')
  }

  // Industry-specific
  if (request.industryType === 'electronics') {
    if (['Vietnam', 'Malaysia', 'China', 'South Korea', 'Japan', 'Taiwan'].includes(country.name)) {
      advantages.push('Strong electronics manufacturing ecosystem')
    }
  } else if (request.industryType === 'textiles') {
    if (['Bangladesh', 'Vietnam', 'India', 'Turkey'].includes(country.name)) {
      advantages.push('Established textile manufacturing hub')
    }
  } else if (request.industryType === 'automotive') {
    if (['Mexico', 'Germany', 'Japan', 'South Korea', 'Thailand'].includes(country.name)) {
      advantages.push('Strong automotive supply chain')
    }
  }

  return advantages.slice(0, 4) // Limit to 4 advantages
}

/**
 * Generate challenges for a country recommendation
 */
function generateChallenges(
  country: CountryRiskData,
  request: RelocationRequest
): string[] {
  const challenges: string[] = []

  // Risk concerns
  if (country.overallRisk > 50) {
    challenges.push('Elevated geopolitical risk')
  }

  // Trade barriers
  const hasSanctions = country.newsHighlights.some(h =>
    h.toLowerCase().includes('sanction') || h.toLowerCase().includes('tariff')
  )
  if (hasSanctions) {
    challenges.push('Trade restrictions may apply')
  }

  // Infrastructure
  const infra = getInfrastructureRating(country.name)
  if (infra === 'developing') {
    challenges.push('Infrastructure development needed')
  } else if (infra === 'moderate') {
    challenges.push('Infrastructure limitations in some regions')
  }

  // Cost
  const laborCost = getLaborCostIndex(country.name)
  if (laborCost > 70) {
    challenges.push('High labor costs')
  }

  // Market access gaps
  for (const market of request.targetMarkets) {
    const marketKey = market.toLowerCase() as 'eu' | 'us' | 'asia'
    const access = getMarketAccess(country.name, marketKey)
    if (access === 'limited') {
      challenges.push(`Limited ${market} market access`)
    }
  }

  return challenges.slice(0, 3) // Limit to 3 challenges
}

/**
 * Generate export route information (simplified)
 */
function generateExportRoutes(country: CountryRiskData, countries: CountryRiskData[]) {
  // This is a simplified version - in production, would use BFS algorithm
  const chokepointConnections = country.connections.filter(c => {
    const node = countries.find(n => n.id === c)
    return node?.type === 'chokepoint'
  })

  return {
    toEU: {
      via: chokepointConnections.includes('Suez Canal') ? ['Suez Canal'] :
           chokepointConnections.includes('Bosphorus') ? ['Bosphorus'] : ['Various routes'],
      chokepoints: chokepointConnections.filter(c =>
        ['Suez Canal', 'Bosphorus', 'Strait of Gibraltar'].includes(c)
      ),
      risk: country.exportRisk + 10, // Add transit risk
    },
    toUS: {
      via: chokepointConnections.includes('Panama Canal') ? ['Panama Canal'] :
           country.connections.includes('United States') ? ['Direct'] : ['Pacific/Atlantic routes'],
      chokepoints: chokepointConnections.filter(c =>
        ['Panama Canal', 'Strait of Malacca'].includes(c)
      ),
      risk: country.exportRisk + 15,
    },
    toAsia: {
      via: chokepointConnections.includes('Strait of Malacca') ? ['Strait of Malacca'] :
           ['Direct routes'],
      chokepoints: chokepointConnections.filter(c =>
        ['Strait of Malacca', 'Strait of Hormuz'].includes(c)
      ),
      risk: country.exportRisk + 8,
    },
  }
}

/**
 * Main function: Generate relocation recommendations
 */
export function generateRecommendations(
  request: RelocationRequest,
  countries: CountryRiskData[]
): RelocationRecommendation[] {
  // 1. Find current country risk
  const currentCountry = countries.find(c =>
    c.id === request.currentCountry || c.name === request.currentCountry
  )

  if (!currentCountry) {
    console.warn(`Current country "${request.currentCountry}" not found in data`)
    return []
  }

  // 2. Get industry-specific weights
  const weights = INDUSTRY_WEIGHTS[request.industryType] || INDUSTRY_WEIGHTS.general

  // 3. Filter countries
  const candidateCountries = filterCountriesByRisk(
    countries,
    currentCountry.overallRisk,
    20 // Allow 20% higher risk as threshold
  )

  // 4. Score and rank
  const scoredCountries = candidateCountries
    .filter(c => c.id !== currentCountry.id) // Exclude current location
    .map(country => ({
      country,
      score: calculateScore(country, request, weights),
    }))
    .sort((a, b) => b.score - a.score)

  // 5. Build recommendations (top 5)
  const recommendations: RelocationRecommendation[] = scoredCountries
    .slice(0, 5)
    .map(({ country, score }) => ({
      country: country.name,
      countryId: country.id,
      overallScore: score,
      riskAnalysis: {
        geopolitical: country.overallRisk,
        naturalDisaster: Math.round(country.overallRisk * 0.3), // Estimated
        tradeBarriers: Math.round((100 - score) * 0.4), // Inverse of score
        labor: Math.round(getLaborCostIndex(country.name) * 0.5),
      },
      advantages: generateAdvantages(country, request),
      challenges: generateChallenges(country, request),
      estimatedCostFactor: estimateCostFactor(country.name),
      exportRoutes: generateExportRoutes(country, countries),
      tradeAgreements: [
        ...getTradeAgreements(country.name, 'eu'),
        ...getTradeAgreements(country.name, 'us'),
        ...getTradeAgreements(country.name, 'asia'),
      ].slice(0, 3),
      infrastructure: getInfrastructureRating(country.name),
      targetMarketAccess: {
        eu: getMarketAccess(country.name, 'eu'),
        us: getMarketAccess(country.name, 'us'),
        asia: getMarketAccess(country.name, 'asia'),
      },
    }))

  return recommendations
}

/**
 * Calculate risk reduction percentage when relocating
 */
export function calculateRiskReduction(
  currentRisk: number,
  targetRisk: number
): number {
  if (currentRisk === 0) return 0
  return Math.round(((currentRisk - targetRisk) / currentRisk) * 100)
}

/**
 * Get countries suitable for specific target markets
 */
export function getCountriesForMarket(
  countries: CountryRiskData[],
  targetMarket: TargetMarket
): CountryRiskData[] {
  const marketKey = targetMarket.toLowerCase() as 'eu' | 'us' | 'asia'

  return countries
    .filter(c => c.type === 'country')
    .filter(c => getMarketAccess(c.name, marketKey) !== 'limited')
    .sort((a, b) => {
      const accessA = getMarketAccess(a.name, marketKey)
      const accessB = getMarketAccess(b.name, marketKey)
      const accessOrder = { excellent: 0, good: 1, moderate: 2, limited: 3 }
      return accessOrder[accessA] - accessOrder[accessB]
    })
}

/**
 * Check if a country is in a conflict zone
 */
export function isInConflictZone(country: string): boolean {
  const conflictCountries = ['Ukraine', 'Russia', 'Iran', 'Yemen', 'Syria', 'Israel', 'Gaza']
  return conflictCountries.includes(country)
}

/**
 * Check if a country uses high-risk chokepoints
 */
export function usesHighRiskChokepoints(
  country: CountryRiskData,
  countries: CountryRiskData[]
): boolean {
  const highRiskChokepoints = ['Strait of Hormuz', 'Bab-el-Mandeb']

  return country.connections.some(conn => {
    const node = countries.find(c => c.id === conn)
    return node?.type === 'chokepoint' && highRiskChokepoints.includes(conn)
  })
}
