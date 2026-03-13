import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  RelocationRequest,
  RelocationRecommendation,
  RelocationAnalyzeResponse,
  IndustryType,
  RiskConcern,
  Priority,
  TargetMarket,
} from "@/lib/relocation-types"
import { generateRecommendations } from "@/lib/relocation-engine"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Validation schema
const RelocationRequestSchema = z.object({
  currentCountry: z.string().min(1),
  industryType: z.enum(['electronics', 'textiles', 'automotive', 'food', 'pharmaceuticals', 'general']),
  riskConcerns: z.array(z.enum(['geopolitical', 'natural_disaster', 'trade_barriers', 'labor'])),
  priorities: z.array(z.enum(['cost', 'stability', 'infrastructure', 'market_access'])),
  targetMarkets: z.array(z.enum(['EU', 'US', 'Asia', 'Global'])).min(1, "At least one target market required"),
})

// Country risk data - simplified version for API
// In production, this would come from a shared data source
const COUNTRY_RISKS = [
  { id: "China", name: "China", type: "country" as const, connections: ["Strait of Malacca", "Singapore", "Vietnam", "Japan", "South Korea", "Taiwan"], importRisk: 72, exportRisk: 68, overallRisk: 70, newsHighlights: [] },
  { id: "United States", name: "United States", type: "country" as const, connections: ["Canada", "Mexico", "Panama Canal"], importRisk: 35, exportRisk: 28, overallRisk: 32, newsHighlights: [] },
  { id: "Vietnam", name: "Vietnam", type: "country" as const, connections: ["China", "Thailand", "Malaysia", "Singapore", "Strait of Malacca"], importRisk: 45, exportRisk: 42, overallRisk: 44, newsHighlights: [] },
  { id: "Malaysia", name: "Malaysia", type: "country" as const, connections: ["Thailand", "Vietnam", "Singapore", "Indonesia", "Strait of Malacca"], importRisk: 35, exportRisk: 32, overallRisk: 34, newsHighlights: [] },
  { id: "Singapore", name: "Singapore", type: "country" as const, connections: ["Malaysia", "Indonesia", "Vietnam", "Thailand", "India", "Strait of Malacca"], importRisk: 18, exportRisk: 15, overallRisk: 17, newsHighlights: [] },
  { id: "Thailand", name: "Thailand", type: "country" as const, connections: ["Malaysia", "Vietnam", "China", "Strait of Malacca"], importRisk: 40, exportRisk: 38, overallRisk: 39, newsHighlights: [] },
  { id: "Indonesia", name: "Indonesia", type: "country" as const, connections: ["Malaysia", "Singapore", "Australia", "Strait of Malacca"], importRisk: 48, exportRisk: 45, overallRisk: 47, newsHighlights: [] },
  { id: "Japan", name: "Japan", type: "country" as const, connections: ["China", "South Korea", "Taiwan", "Strait of Malacca", "Panama Canal"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "South Korea", name: "South Korea", type: "country" as const, connections: ["China", "Japan", "Taiwan", "Strait of Malacca"], importRisk: 30, exportRisk: 28, overallRisk: 29, newsHighlights: [] },
  { id: "Taiwan", name: "Taiwan", type: "country" as const, connections: ["China", "Japan", "South Korea", "Strait of Malacca"], importRisk: 62, exportRisk: 58, overallRisk: 60, newsHighlights: [] },
  { id: "India", name: "India", type: "country" as const, connections: ["Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Singapore", "Bangladesh", "Pakistan"], importRisk: 55, exportRisk: 48, overallRisk: 52, newsHighlights: [] },
  { id: "Mexico", name: "Mexico", type: "country" as const, connections: ["United States", "Panama Canal"], importRisk: 42, exportRisk: 38, overallRisk: 40, newsHighlights: [] },
  { id: "Canada", name: "Canada", type: "country" as const, connections: ["United States", "Panama Canal"], importRisk: 25, exportRisk: 22, overallRisk: 24, newsHighlights: [] },
  { id: "Brazil", name: "Brazil", type: "country" as const, connections: ["Argentina", "Chile", "Panama Canal", "Peru"], importRisk: 58, exportRisk: 52, overallRisk: 55, newsHighlights: [] },
  { id: "Argentina", name: "Argentina", type: "country" as const, connections: ["Brazil", "Chile", "Panama Canal"], importRisk: 72, exportRisk: 68, overallRisk: 70, newsHighlights: [] },
  { id: "Chile", name: "Chile", type: "country" as const, connections: ["Peru", "Brazil", "Argentina", "Panama Canal"], importRisk: 35, exportRisk: 30, overallRisk: 33, newsHighlights: [] },
  { id: "Poland", name: "Poland", type: "country" as const, connections: ["Germany", "Ukraine", "Romania"], importRisk: 38, exportRisk: 35, overallRisk: 37, newsHighlights: [] },
  { id: "Germany", name: "Germany", type: "country" as const, connections: ["Netherlands", "France", "Poland"], importRisk: 20, exportRisk: 18, overallRisk: 19, newsHighlights: [] },
  { id: "Netherlands", name: "Netherlands", type: "country" as const, connections: ["Germany", "France", "United Kingdom", "Suez Canal"], importRisk: 22, exportRisk: 20, overallRisk: 21, newsHighlights: [] },
  { id: "France", name: "France", type: "country" as const, connections: ["Germany", "Netherlands", "United Kingdom", "Spain", "Italy"], importRisk: 22, exportRisk: 20, overallRisk: 21, newsHighlights: [] },
  { id: "United Kingdom", name: "United Kingdom", type: "country" as const, connections: ["Netherlands", "France"], importRisk: 25, exportRisk: 22, overallRisk: 24, newsHighlights: [] },
  { id: "Spain", name: "Spain", type: "country" as const, connections: ["France", "Portugal", "Morocco"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Italy", name: "Italy", type: "country" as const, connections: ["France", "Austria", "Suez Canal"], importRisk: 30, exportRisk: 28, overallRisk: 29, newsHighlights: [] },
  { id: "Turkey", name: "Turkey", type: "country" as const, connections: ["Bosphorus", "Greece", "Iran", "Suez Canal"], importRisk: 48, exportRisk: 45, overallRisk: 47, newsHighlights: [] },
  { id: "Iran", name: "Iran", type: "country" as const, connections: ["Strait of Hormuz", "Turkey", "Pakistan", "United Arab Emirates"], importRisk: 88, exportRisk: 85, overallRisk: 87, newsHighlights: [] },
  { id: "Saudi Arabia", name: "Saudi Arabia", type: "country" as const, connections: ["Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Qatar", "Egypt"], importRisk: 38, exportRisk: 35, overallRisk: 37, newsHighlights: [] },
  { id: "United Arab Emirates", name: "United Arab Emirates", type: "country" as const, connections: ["Strait of Hormuz", "Saudi Arabia", "Iran", "India"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Egypt", name: "Egypt", type: "country" as const, connections: ["Suez Canal", "Bab-el-Mandeb", "Saudi Arabia", "Greece"], importRisk: 55, exportRisk: 50, overallRisk: 53, newsHighlights: [] },
  { id: "South Africa", name: "South Africa", type: "country" as const, connections: ["Bab-el-Mandeb"], importRisk: 45, exportRisk: 42, overallRisk: 44, newsHighlights: [] },
  { id: "Australia", name: "Australia", type: "country" as const, connections: ["Indonesia", "Strait of Malacca"], importRisk: 28, exportRisk: 25, overallRisk: 27, newsHighlights: [] },
  { id: "Russia", name: "Russia", type: "country" as const, connections: ["Georgia", "Bosphorus", "China", "Iran"], importRisk: 92, exportRisk: 88, overallRisk: 90, newsHighlights: [] },
  { id: "Ukraine", name: "Ukraine", type: "country" as const, connections: ["Romania", "Bosphorus", "Poland"], importRisk: 95, exportRisk: 90, overallRisk: 93, newsHighlights: [] },
]

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parseResult = RelocationRequestSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parseResult.error.issues },
      { status: 400 }
    )
  }

  const relocationRequest = parseResult.data as RelocationRequest

  try {
    // 1. Generate initial recommendations using the engine
    const recommendations = generateRecommendations(relocationRequest, COUNTRY_RISKS)

    if (recommendations.length === 0) {
      return NextResponse.json({
        recommendations: [],
        currentCountry: {
          name: relocationRequest.currentCountry,
          overallRisk: 0,
        },
        analysisTimestamp: new Date().toISOString(),
        warning: "No suitable relocation alternatives found. Consider risk mitigation strategies.",
      })
    }

    // 2. Enhance with AI analysis if API key available
    if (apiKey && apiKey !== "your-openrouter-api-key-here") {
      try {
        const aiEnhancedRecommendations = await enhanceWithAI(
          relocationRequest,
          recommendations,
          apiKey
        )

        return NextResponse.json({
          recommendations: aiEnhancedRecommendations,
          currentCountry: {
            name: relocationRequest.currentCountry,
            overallRisk: COUNTRY_RISKS.find(c => c.id === relocationRequest.currentCountry)?.overallRisk ?? 0,
          },
          analysisTimestamp: new Date().toISOString(),
        })
      } catch (aiError) {
        console.error("AI enhancement failed, returning basic recommendations:", aiError)
        // Fall back to basic recommendations
      }
    }

    // Return basic recommendations without AI enhancement
    return NextResponse.json({
      recommendations,
      currentCountry: {
        name: relocationRequest.currentCountry,
        overallRisk: COUNTRY_RISKS.find(c => c.id === relocationRequest.currentCountry)?.overallRisk ?? 0,
      },
      analysisTimestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Relocation analysis error:", error)
    return NextResponse.json(
      { error: "Analysis failed", detail: String(error) },
      { status: 500 }
    )
  }
}

async function enhanceWithAI(
  request: RelocationRequest,
  recommendations: RelocationRecommendation[],
  apiKey: string
): Promise<RelocationRecommendation[]> {
  const systemPrompt = `You are a supply chain relocation expert. Analyze the user's request and enhance the recommendations with qualitative insights.

Consider:
1. Geopolitical stability (distance from conflict zones like Iran, Ukraine, Yemen)
2. Export route safety (avoid high-risk chokepoints like Hormuz, Bab-el-Mandeb, Suez)
3. Trade agreements with target markets (EU, US, Asia, or global - based on user's specified markets)
4. Infrastructure quality (ports, roads, logistics)
5. Industry-specific factors
6. Global supply chain resilience

For each recommendation, provide enhanced advantages and challenges.
Format as JSON: { enhancedRecommendations: [{ country, enhancedAdvantages, enhancedChallenges, aiInsight }] }`

  const userPrompt = `Enhance these relocation recommendations:

Current Country: ${request.currentCountry}
Industry: ${request.industryType}
Risk Concerns: ${request.riskConcerns.join(', ')}
Priorities: ${request.priorities.join(', ')}
Target Markets: ${request.targetMarkets.join(', ')}

Top Recommendations:
${recommendations.map(r => `- ${r.country} (Score: ${r.overallScore}, Infrastructure: ${r.infrastructure})`).join('\n')}

Provide enhanced insights for each country.`

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
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    throw new Error(`AI API error: ${res.status}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ""

  // Try to parse AI response and merge with recommendations
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const aiResponse = JSON.parse(jsonMatch[0])

      if (aiResponse.enhancedRecommendations) {
        return recommendations.map(rec => {
          const enhanced = aiResponse.enhancedRecommendations.find(
            (e: { country: string }) => e.country === rec.country
          )

          if (enhanced) {
            return {
              ...rec,
              advantages: enhanced.enhancedAdvantages || rec.advantages,
              challenges: enhanced.enhancedChallenges || rec.challenges,
              aiInsight: enhanced.aiInsight,
            }
          }
          return rec
        })
      }
    }
  } catch (parseError) {
    console.error("Failed to parse AI response:", parseError)
  }

  return recommendations
}
