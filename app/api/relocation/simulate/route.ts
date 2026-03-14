import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  RelocationSimulation,
  CountryRiskData,
} from "@/lib/relocation-types"
import {
  getMarketAccess,
  getTradeAgreements,
  getLaborCostIndex,
  getInfrastructureRating,
  MAJOR_PORTS,
} from "@/lib/trade-agreements"
import { calculateRiskReduction } from "@/lib/relocation-engine"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Validation schema
const RelocationSimulateSchema = z.object({
  currentCountryId: z.string().min(1),
  targetCountryId: z.string().min(1),
  industryType: z.enum(['electronics', 'textiles', 'automotive', 'food', 'pharmaceuticals', 'general']),
})

// Country risk data
const COUNTRY_RISKS: CountryRiskData[] = [
  { id: "China", name: "China", type: "country", connections: ["Strait of Malacca", "Singapore", "Vietnam", "Japan", "South Korea", "Taiwan"], importRisk: 72, exportRisk: 68, overallRisk: 70, newsHighlights: [] },
  { id: "United States", name: "United States", type: "country", connections: ["Canada", "Mexico", "Panama Canal"], importRisk: 35, exportRisk: 28, overallRisk: 32, newsHighlights: [] },
  { id: "Vietnam", name: "Vietnam", type: "country", connections: ["China", "Thailand", "Malaysia", "Singapore", "Strait of Malacca"], importRisk: 45, exportRisk: 42, overallRisk: 44, newsHighlights: [] },
  { id: "Mexico", name: "Mexico", type: "country", connections: ["United States", "Panama Canal"], importRisk: 42, exportRisk: 38, overallRisk: 40, newsHighlights: [] },
  { id: "Poland", name: "Poland", type: "country", connections: ["Germany", "Ukraine", "Romania"], importRisk: 38, exportRisk: 35, overallRisk: 37, newsHighlights: [] },
  { id: "Turkey", name: "Turkey", type: "country", connections: ["Bosphorus", "Georgia", "Iran", "Syria", "Egypt"], importRisk: 45, exportRisk: 40, overallRisk: 43, newsHighlights: [] },
  { id: "India", name: "India", type: "country", connections: ["Pakistan", "Bangladesh", "Suez Canal", "Strait of Malacca"], importRisk: 55, exportRisk: 50, overallRisk: 53, newsHighlights: [] },
  { id: "Iran", name: "Iran", type: "country", connections: ["Turkey", "United Arab Emirates", "Strait of Hormuz", "Pakistan", "India"], importRisk: 85, exportRisk: 80, overallRisk: 83, newsHighlights: ["High tension in region", "Sanctions affecting trade"] },
  { id: "Germany", name: "Germany", type: "country", connections: ["Poland", "France", "Netherlands", "Belgium", "Czech Republic"], importRisk: 25, exportRisk: 22, overallRisk: 24, newsHighlights: [] },
  { id: "Netherlands", name: "Netherlands", type: "country", connections: ["Germany", "France", "United Kingdom", "Suez Canal"], importRisk: 22, exportRisk: 20, overallRisk: 21, newsHighlights: [] },
  { id: "Japan", name: "Japan", type: "country", connections: ["China", "South Korea", "Taiwan", "Strait of Malacca", "Panama Canal"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "South Korea", name: "South Korea", type: "country", connections: ["China", "Japan", "Taiwan", "North Korea"], importRisk: 30, exportRisk: 25, overallRisk: 28, newsHighlights: [] },
  { id: "Taiwan", name: "Taiwan", type: "country", connections: ["China", "Japan", "South Korea", "Strait of Malacca"], importRisk: 62, exportRisk: 58, overallRisk: 60, newsHighlights: [] },
  { id: "Indonesia", name: "Indonesia", type: "country", connections: ["Malaysia", "Singapore", "Australia", "Strait of Malacca"], importRisk: 48, exportRisk: 45, overallRisk: 47, newsHighlights: [] },
  { id: "Malaysia", name: "Malaysia", type: "country", connections: ["Thailand", "Vietnam", "Singapore", "Indonesia", "Strait of Malacca"], importRisk: 35, exportRisk: 32, overallRisk: 34, newsHighlights: [] },
  { id: "Thailand", name: "Thailand", type: "country", connections: ["Vietnam", "Malaysia", "China", "India", "Strait of Malacca"], importRisk: 40, exportRisk: 38, overallRisk: 39, newsHighlights: [] },
  { id: "Australia", name: "Australia", type: "country", connections: ["Indonesia", "Strait of Malacca"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Canada", name: "Canada", type: "country", connections: ["United States", "Panama Canal"], importRisk: 25, exportRisk: 22, overallRisk: 24, newsHighlights: [] },
  { id: "United Kingdom", name: "United Kingdom", type: "country", connections: ["Netherlands", "France", "Belgium", "Suez Canal"], importRisk: 35, exportRisk: 30, overallRisk: 33, newsHighlights: [] },
  { id: "France", name: "France", type: "country", connections: ["Germany", "Spain", "Italy", "Belgium", "Suez Canal"], importRisk: 30, exportRisk: 25, overallRisk: 28, newsHighlights: [] },
  { id: "Spain", name: "Spain", type: "country", connections: ["France", "Portugal", "Morocco", "Suez Canal"], importRisk: 32, exportRisk: 28, overallRisk: 30, newsHighlights: [] },
  { id: "Italy", name: "Italy", type: "country", connections: ["France", "Austria", "Suez Canal", "Bosphorus"], importRisk: 32, exportRisk: 28, overallRisk: 30, newsHighlights: [] },
  { id: "Singapore", name: "Singapore", type: "country", connections: ["Malaysia", "Indonesia", "Vietnam", "Thailand", "India", "Strait of Malacca"], importRisk: 18, exportRisk: 15, overallRisk: 17, newsHighlights: [] },
  { id: "South Africa", name: "South Africa", type: "country", connections: ["Mozambique", "Namibia", "Mauritius"], importRisk: 55, exportRisk: 50, overallRisk: 53, newsHighlights: [] },
  { id: "Brazil", name: "Brazil", type: "country", connections: ["Argentina", "Chile", "Peru", "Panama Canal"], importRisk: 58, exportRisk: 52, overallRisk: 55, newsHighlights: [] },
  { id: "Argentina", name: "Argentina", type: "country", connections: ["Brazil", "Chile", "Paraguay", "Uruguay", "Panama Canal"], importRisk: 72, exportRisk: 68, overallRisk: 70, newsHighlights: [] },
  { id: "Chile", name: "Chile", type: "country", connections: ["Peru", "Bolivia", "Argentina", "Panama Canal"], importRisk: 35, exportRisk: 30, overallRisk: 33, newsHighlights: [] },
  { id: "Russia", name: "Russia", type: "country", connections: ["Georgia", "Bosphorus", "China", "Iran"], importRisk: 92, exportRisk: 88, overallRisk: 90, newsHighlights: [] },
  { id: "Ukraine", name: "Ukraine", type: "country", connections: ["Romania", "Bosphorus", "Poland"], importRisk: 95, exportRisk: 90, overallRisk: 93, newsHighlights: [] },
  { id: "Egypt", name: "Egypt", type: "country", connections: ["Suez Canal", "Bab-el-Mandeb", "Saudi Arabia", "Greece", "Turkey"], importRisk: 55, exportRisk: 50, overallRisk: 53, newsHighlights: [] },
  { id: "Saudi Arabia", name: "Saudi Arabia", type: "country", connections: ["Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Qatar", "Egypt"], importRisk: 38, exportRisk: 35, overallRisk: 37, newsHighlights: [] },
  { id: "Bangladesh", name: "Bangladesh", type: "country", connections: ["India", "Strait of Malacca"], importRisk: 55, exportRisk: 50, overallRisk: 53, newsHighlights: [] },
  { id: "Pakistan", name: "Pakistan", type: "country", connections: ["India", "Iran", "China", "Strait of Hormuz"], importRisk: 65, exportRisk: 60, overallRisk: 63, newsHighlights: [] },
]

function getRiskForCountry(name: string): number {
  const country = COUNTRY_RISKS.find(c => c.name === name || c.id === name)
  return country?.overallRisk ?? 50
}

function getCountryData(name: string): CountryRiskData | undefined {
  return COUNTRY_RISKS.find(c => c.name === name || c.id === name)
}

function identifyAvoidedChokepoints(current: CountryRiskData | undefined, target: CountryRiskData | undefined): string[] {
  if (!current || !target) return []

  const highRiskChokepoints = ['Strait of Hormuz', 'Bab-el-Mandeb', 'Suez Canal', 'Strait of Malacca', 'Panama Canal']

  const currentChokepoints = current.connections.filter((c: string) =>
    highRiskChokepoints.includes(c)
  )

  const targetChokepoints = target.connections.filter((c: string) =>
    highRiskChokepoints.includes(c)
  )

  return currentChokepoints.filter((c: string) => !targetChokepoints.includes(c))
}

function estimateCost(laborCost: number, infrastructure: 'excellent' | 'good' | 'moderate' | 'developing'): string {
  const infraMultiplier: Record<string, number> = {
    'excellent': 1.0,
    'good': 1.2,
    'moderate': 1.5,
    'developing': 2.0,
  }

  const baseCost = Math.max(laborCost, 20)
  const totalCost = baseCost * (infraMultiplier[infrastructure] ?? 1.5)

  if (totalCost < 30) return "Low - $1-5 million"
  if (totalCost < 60) return "Medium - $5-20 million"
  return "High - $20-50 million"
}

function estimateTimeline(infrastructure: 'excellent' | 'good' | 'moderate' | 'developing', industry: string): string {
  const baseMonths: Record<string, number> = {
    electronics: 12,
    textiles: 8,
    automotive: 18,
    food: 10,
    pharmaceuticals: 15,
    general: 10,
  }

  const infraMultiplier: Record<string, number> = {
    'excellent': 1.0,
    'good': 1.2,
    'moderate': 1.5,
    'developing': 2.0,
  }

  const months = (baseMonths[industry] ?? 10) * (infraMultiplier[infrastructure] ?? 1.5)
  return `${Math.round(months - 2)}-${Math.round(months + 2)} months`
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parseResult = RelocationSimulateSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { currentCountryId, targetCountryId, industryType } = parseResult.data

  // Get country data
  const currentCountryData = getCountryData(currentCountryId)
  const targetCountryData = getCountryData(targetCountryId)

  if (!currentCountryData || !targetCountryData) {
    return NextResponse.json(
      { error: "Invalid country specified", detail: "Could not find country data for the request." },
      { status: 400 }
    )
  }

  const currentRisk = currentCountryData.overallRisk
  const targetRisk = targetCountryData.overallRisk

  // Calculate risk reduction
  const riskReduction = calculateRiskReduction(currentRisk, targetRisk)

  // Get trade agreements for target
  const tradeAgreements = [
    ...getTradeAgreements(targetCountryData.name, 'eu'),
    ...getTradeAgreements(targetCountryData.name, 'us'),
    ...getTradeAgreements(targetCountryData.name, 'asia'),
  ].filter(v => v.length > 0)

  // Get labor cost and infrastructure
  const laborCost = getLaborCostIndex(targetCountryData.name)
  const infrastructure = getInfrastructureRating(targetCountryData.name)

  // Get major ports
  const ports = MAJOR_PORTS[targetCountryData.name] || ['Various ports']

  // Generate AI analysis if API key available
  let aiAnalysis = "AI analysis not available (no API key configured)."

  if (apiKey && apiKey !== "your-openrouter-api-key-here") {
    try {
      const systemPrompt = `You are a supply chain relocation expert. The user is considering relocating from ${currentCountryData.name} to ${targetCountryData.name}. Provide a detailed analysis.

Consider:
1. Risk reduction analysis - quantify the improvement
2. Chokepoint changes - what routes are avoided
3. Trade agreement benefits
4. Labor and infrastructure factors
5. Key challenges to consider
6. Recommendations for successful relocation

Provide a detailed, practical analysis with specific numbers where possible. Do not use markdown in the response.`

      const userPrompt = `Analyze the relocation from ${currentCountryData.name} to ${targetCountryData.name}.

Current: ${currentCountryData.name}, Risk: ${currentRisk}
Target: ${targetCountryData.name}, Risk: ${targetRisk}
Risk Reduction: ${riskReduction}%

Industry: ${industryType}

Current trade agreements in target: ${tradeAgreements.join(', ')}

Labor cost index: ${laborCost} (lower is better for cost savings)
Infrastructure: ${infrastructure}
Major ports: ${ports.join(', ')}

Provide detailed, practical analysis.`

      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://supply-chain-crisis.app",
        },
        body: JSON.stringify({
          model: "moonshotai/kimi-k2.5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 1024,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        aiAnalysis = data.choices?.[0]?.message?.content ?? aiAnalysis
      }
    } catch (error) {
      console.error("AI analysis failed:", error)
    }
  }

  // Build response
  const response: RelocationSimulation = {
    current: {
      country: currentCountryData.name,
      countryId: currentCountryId,
      overallRisk: currentRisk,
      exportRoutes: currentCountryData.connections.map((c: string) => ({
        destination: c,
        path: [currentCountryData.name, c],
        chokepoints: [],
        riskScore: Math.round(currentRisk * 0.5),
        transitDays: "Varies",
      })),
      affectedProducts: [],
    },
    proposed: {
      country: targetCountryData.name,
      countryId: targetCountryId,
      overallRisk: targetRisk,
      exportRoutes: targetCountryData.connections.map((c: string) => ({
        destination: c,
        path: [targetCountryData.name, c],
        chokepoints: [],
        riskScore: Math.round(targetRisk * 0.5),
        transitDays: "Varies",
      })),
      riskReduction,
    },
    impact: {
      riskReduction: `${riskReduction}% lower risk`,
      newChokepointExposure: [],
      avoidedChokepoints: identifyAvoidedChokepoints(currentCountryData, targetCountryData),
      estimatedCost: estimateCost(laborCost, infrastructure),
      timeline: estimateTimeline(infrastructure, industryType),
      recommendations: [aiAnalysis],
    },
  }

  return NextResponse.json(response)
}
