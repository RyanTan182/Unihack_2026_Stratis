import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  CountryComparison,
  CountryComparisonData,
  RelocationCompareRequest,
} from "@/lib/relocation-types"
import {
  getTradeAgreements,
  getLaborCostIndex,
  getInfrastructureRating,
  getMarketAccess,
  MAJOR_PORTS,
} from "@/lib/trade-agreements"

// Validation schema
const CompareRequestSchema = z.object({
  countryIds: z.array(z.string().min(1)).min(2, "At least 2 countries required for comparison").max(4, "Maximum 4 countries can be compared"),
  targetMarkets: z.array(z.enum(['EU', 'US', 'Asia', 'Global'])).min(1, "At least one target market required"),
})

// Country risk data
const COUNTRY_RISKS: Array<{
  id: string
  name: string
  type: 'country' | 'chokepoint'
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}> = [
  { id: "China", name: "China", type: "country", connections: ["Strait of Malacca", "Singapore", "Vietnam", "Japan", "South Korea", "Taiwan"], importRisk: 72, exportRisk: 68, overallRisk: 70, newsHighlights: [] },
  { id: "United States", name: "United States", type: "country", connections: ["Canada", "Mexico", "Panama Canal"], importRisk: 35, exportRisk: 28, overallRisk: 32, newsHighlights: [] },
  { id: "Vietnam", name: "Vietnam", type: "country", connections: ["China", "Thailand", "Malaysia", "Singapore", "Strait of Malacca"], importRisk: 45, exportRisk: 42, overallRisk: 44, newsHighlights: [] },
  { id: "Malaysia", name: "Malaysia", type: "country", connections: ["Thailand", "Vietnam", "Singapore", "Indonesia", "Strait of Malacca"], importRisk: 35, exportRisk: 32, overallRisk: 34, newsHighlights: [] },
  { id: "Singapore", name: "Singapore", type: "country", connections: ["Malaysia", "Indonesia", "Vietnam", "Thailand", "India", "Strait of Malacca"], importRisk: 18, exportRisk: 15, overallRisk: 17, newsHighlights: [] },
  { id: "Thailand", name: "Thailand", type: "country", connections: ["Malaysia", "Vietnam", "China", "Strait of Malacca"], importRisk: 40, exportRisk: 38, overallRisk: 39, newsHighlights: [] },
  { id: "Indonesia", name: "Indonesia", type: "country", connections: ["Malaysia", "Singapore", "Australia", "Strait of Malacca"], importRisk: 48, exportRisk: 45, overallRisk: 47, newsHighlights: [] },
  { id: "Japan", name: "Japan", type: "country", connections: ["China", "South Korea", "Taiwan", "Strait of Malacca", "Panama Canal"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "South Korea", name: "South Korea", type: "country", connections: ["China", "Japan", "Taiwan", "Strait of Malacca"], importRisk: 30, exportRisk: 28, overallRisk: 29, newsHighlights: [] },
  { id: "Taiwan", name: "Taiwan", type: "country", connections: ["China", "Japan", "South Korea", "Strait of Malacca"], importRisk: 62, exportRisk: 58, overallRisk: 60, newsHighlights: [] },
  { id: "India", name: "India", type: "country", connections: ["Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Singapore", "Bangladesh", "Pakistan"], importRisk: 55, exportRisk: 48, overallRisk: 52, newsHighlights: [] },
  { id: "Mexico", name: "Mexico", type: "country", connections: ["United States", "Panama Canal"], importRisk: 42, exportRisk: 38, overallRisk: 40, newsHighlights: [] },
  { id: "Canada", name: "Canada", type: "country", connections: ["United States", "Panama Canal"], importRisk: 25, exportRisk: 22, overallRisk: 24, newsHighlights: [] },
  { id: "Brazil", name: "Brazil", type: "country", connections: ["Argentina", "Chile", "Panama Canal", "Peru"], importRisk: 58, exportRisk: 52, overallRisk: 55, newsHighlights: [] },
  { id: "Argentina", name: "Argentina", type: "country", connections: ["Brazil", "Chile", "Panama Canal"], importRisk: 72, exportRisk: 68, overallRisk: 70, newsHighlights: [] },
  { id: "Chile", name: "Chile", type: "country", connections: ["Peru", "Brazil", "Argentina", "Panama Canal"], importRisk: 35, exportRisk: 30, overallRisk: 33, newsHighlights: [] },
  { id: "Poland", name: "Poland", type: "country", connections: ["Germany", "Ukraine", "Romania"], importRisk: 38, exportRisk: 35, overallRisk: 37, newsHighlights: [] },
  { id: "Germany", name: "Germany", type: "country", connections: ["Netherlands", "France", "Poland"], importRisk: 20, exportRisk: 18, overallRisk: 19, newsHighlights: [] },
  { id: "Netherlands", name: "Netherlands", type: "country", connections: ["Germany", "France", "United Kingdom", "Suez Canal"], importRisk: 22, exportRisk: 20, overallRisk: 21, newsHighlights: [] },
  { id: "France", name: "France", type: "country", connections: ["Germany", "Netherlands", "United Kingdom", "Spain", "Italy"], importRisk: 22, exportRisk: 20, overallRisk: 21, newsHighlights: [] },
  { id: "United Kingdom", name: "United Kingdom", type: "country", connections: ["Netherlands", "France"], importRisk: 25, exportRisk: 22, overallRisk: 24, newsHighlights: [] },
  { id: "Spain", name: "Spain", type: "country", connections: ["France", "Portugal", "Morocco"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Italy", name: "Italy", type: "country", connections: ["France", "Austria", "Suez Canal"], importRisk: 30, exportRisk: 28, overallRisk: 29, newsHighlights: [] },
  { id: "Turkey", name: "Turkey", type: "country", connections: ["Bosphorus", "Greece", "Iran", "Suez Canal"], importRisk: 48, exportRisk: 45, overallRisk: 47, newsHighlights: [] },
  { id: "Iran", name: "Iran", type: "country", connections: ["Strait of Hormuz", "Turkey", "Pakistan", "United Arab Emirates"], importRisk: 88, exportRisk: 85, overallRisk: 87, newsHighlights: [] },
  { id: "Saudi Arabia", name: "Saudi Arabia", type: "country", connections: ["Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Qatar", "Egypt"], importRisk: 38, exportRisk: 35, overallRisk: 37, newsHighlights: [] },
  { id: "United Arab Emirates", name: "United Arab Emirates", type: "country", connections: ["Strait of Hormuz", "Saudi Arabia", "Iran", "India"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Egypt", name: "Egypt", type: "country", connections: ["Suez Canal", "Bab-el-Mandeb", "Saudi Arabia", "Greece"], importRisk: 55, exportRisk: 50, overallRisk: 53, newsHighlights: [] },
  { id: "South Africa", name: "South Africa", type: "country", connections: ["Bab-el-Mandeb"], importRisk: 45, exportRisk: 42, overallRisk: 44, newsHighlights: [] },
  { id: "Australia", name: "Australia", type: "country", connections: ["Indonesia", "Strait of Malacca"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Russia", name: "Russia", type: "country", connections: ["Georgia", "Bosphorus", "China", "Iran"], importRisk: 92, exportRisk: 88, overallRisk: 90, newsHighlights: [] },
  { id: "Ukraine", name: "Ukraine", type: "country", connections: ["Romania", "Bosphorus", "Poland"], importRisk: 95, exportRisk: 90, overallRisk: 93, newsHighlights: [] },
]

// Flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  'China': '🇨🇳',
  'United States': '🇺🇸',
  'Vietnam': '🇻🇳',
  'Malaysia': '🇲🇾',
  'Singapore': '🇸🇬',
  'Thailand': '🇹🇭',
  'Indonesia': '🇮🇩',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'Taiwan': '🇹🇼',
  'India': '🇮🇳',
  'Mexico': '🇲🇽',
  'Canada': '🇨🇦',
  'Brazil': '🇧🇷',
  'Argentina': '🇦🇷',
  'Chile': '🇨🇱',
  'Poland': '🇵🇱',
  'Germany': '🇩🇪',
  'Netherlands': '🇳🇱',
  'France': '🇫🇷',
  'United Kingdom': '🇬🇧',
  'Spain': '🇪🇸',
  'Italy': '🇮🇹',
  'Turkey': '🇹🇷',
  'Iran': '🇮🇷',
  'Saudi Arabia': '🇸🇦',
  'United Arab Emirates': '🇦🇪',
  'Egypt': '🇪🇬',
  'South Africa': '🇿🇦',
  'Australia': '🇦🇺',
  'Russia': '🇷🇺',
  'Ukraine': '🇺🇦',
}

function getCountryData(countryId: string) {
  return COUNTRY_RISKS.find(c => c.id === countryId || c.name === countryId)
}

function estimateShippingTime(country: string, destination: 'eu' | 'us' | 'asia'): string {
  // Simplified shipping time estimation based on region
  const euCountries = ['Germany', 'Netherlands', 'France', 'Poland', 'United Kingdom', 'Spain', 'Italy', 'Belgium']
  const usNeighbors = ['Canada', 'Mexico']
  const asiaCountries = ['China', 'Japan', 'South Korea', 'Taiwan', 'Vietnam', 'Malaysia', 'Thailand', 'Indonesia', 'Singapore', 'India']

  if (destination === 'eu') {
    if (euCountries.includes(country)) return '1-3 days (direct)'
    if (usNeighbors.includes(country)) return '15-20 days'
    if (asiaCountries.includes(country)) return '25-35 days'
    return '20-40 days'
  } else if (destination === 'us') {
    if (country === 'United States') return 'Domestic'
    if (usNeighbors.includes(country)) return '2-5 days'
    if (asiaCountries.includes(country)) return '15-25 days'
    if (euCountries.includes(country)) return '10-15 days'
    return '15-30 days'
  } else { // asia
    if (asiaCountries.includes(country)) return '3-10 days'
    if (usNeighbors.includes(country) || country === 'United States') return '15-25 days'
    if (euCountries.includes(country)) return '25-35 days'
    return '20-40 days'
  }
}

function calculateOverallScore(country: typeof COUNTRY_RISKS[0], targetMarkets: string[]): number {
  const geopoliticalScore = 100 - country.overallRisk
  const exportScore = 100 - country.exportRisk
  const infrastructureScore = {
    'excellent': 100,
    'good': 75,
    'moderate': 50,
    'developing': 25,
  }[getInfrastructureRating(country.name)] ?? 50

  const laborCost = getLaborCostIndex(country.name)
  const costScore = 100 - laborCost

  // Market access score
  let marketAccessScore = 0
  for (const market of targetMarkets) {
    const marketKey = market.toLowerCase() as 'eu' | 'us' | 'asia'
    const access = getMarketAccess(country.name, marketKey)
    const accessScore = access === 'excellent' ? 100 : access === 'good' ? 75 : access === 'moderate' ? 50 : 25
    marketAccessScore += accessScore
  }
  marketAccessScore = marketAccessScore / Math.max(targetMarkets.length, 1)

  // Weighted average
  return Math.round(
    geopoliticalScore * 0.35 +
    exportScore * 0.25 +
    infrastructureScore * 0.15 +
    costScore * 0.10 +
    marketAccessScore * 0.15
  )
}

export async function POST(request: NextRequest) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parseResult = CompareRequestSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { countryIds, targetMarkets } = parseResult.data as RelocationCompareRequest

  // Get data for each country
  const countriesData: CountryComparisonData[] = []

  for (const countryId of countryIds) {
    const countryData = getCountryData(countryId)

    if (!countryData) {
      return NextResponse.json(
        { error: "Invalid country", detail: `Country "${countryId}" not found` },
        { status: 400 }
      )
    }

    const laborCost = getLaborCostIndex(countryData.name)
    const infrastructure = getInfrastructureRating(countryData.name)

    countriesData.push({
      name: countryData.name,
      countryId: countryData.id,
      flag: COUNTRY_FLAGS[countryData.name] || '🏳️',
      scores: {
        overall: calculateOverallScore(countryData, targetMarkets),
        geopolitical: 100 - countryData.overallRisk,
        export: 100 - countryData.exportRisk,
        infrastructure: {
          'excellent': 100,
          'good': 75,
          'moderate': 50,
          'developing': 25,
        }[infrastructure] ?? 50,
        cost: 100 - laborCost,
      },
      tradeAgreements: [
        ...getTradeAgreements(countryData.name, 'eu'),
        ...getTradeAgreements(countryData.name, 'us'),
        ...getTradeAgreements(countryData.name, 'asia'),
      ],
      majorPorts: MAJOR_PORTS[countryData.name] || ['Various ports'],
      averageShippingTime: {
        toEU: estimateShippingTime(countryData.name, 'eu'),
        toUS: estimateShippingTime(countryData.name, 'us'),
        toAsia: estimateShippingTime(countryData.name, 'asia'),
      },
      laborCostIndex: laborCost,
      infrastructureRating: infrastructure,
      targetMarketAccess: {
        eu: getMarketAccess(countryData.name, 'eu'),
        us: getMarketAccess(countryData.name, 'us'),
        asia: getMarketAccess(countryData.name, 'asia'),
      },
    })
  }

  // Determine winners for each category
  const findWinner = (metric: keyof CountryComparisonData['scores']): string => {
    const sorted = [...countriesData].sort((a, b) => b.scores[metric] - a.scores[metric])
    return sorted[0]?.name || ''
  }

  const response: CountryComparison = {
    countries: countriesData,
    winner: {
      overall: findWinner('overall'),
      geopolitical: findWinner('geopolitical'),
      export: findWinner('export'),
      cost: findWinner('cost'),
    },
  }

  return NextResponse.json(response)
}
