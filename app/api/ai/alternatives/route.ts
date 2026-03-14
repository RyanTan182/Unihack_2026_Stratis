import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Validation schema
const RequestSchema = z.object({
  country: z.string().min(1),
  itemType: z.string().optional(),
  itemName: z.string().optional(),
  currentRisk: z.number().min(0).max(100).optional(),
})

// Simple risk lookup so we can post-process LLM suggestions and avoid obviously high-risk alternatives.
// Values are aligned with the mock data in app/page.tsx (overallRisk).
const COUNTRY_RISK_SCORES: Record<string, number> = {
  China: 70,
  "United States": 32,
  Germany: 24,
  India: 52,
  Vietnam: 44,
  Brazil: 55,
  Indonesia: 47,
  Japan: 27,
  "South Korea": 30,
  Mexico: 40,
  Russia: 90,
  Ukraine: 93,
  Taiwan: 60,
  "Saudi Arabia": 37,
  "South Africa": 50,
  Turkey: 63,
  Thailand: 39,
  Malaysia: 34,
  Singapore: 17,
  Netherlands: 21,
  "United Kingdom": 34,
  France: 29,
  Italy: 34,
  Spain: 31,
  Australia: 27,
  Canada: 24,
  Egypt: 53,
  Nigeria: 65,
  Argentina: 70,
  Chile: 33,
  Poland: 37,
  Bangladesh: 53,
  Pakistan: 70,
  Philippines: 44,
  Iran: 87,
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === "your-openrouter-api-key-here") {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parseResult = RequestSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parseResult.error.issues },
      { status: 400 }
    )
  }

  const { country, itemType, itemName, currentRisk } = parseResult.data

  const systemPrompt = `You are a supply chain sourcing expert. The user has a supply chain item currently sourced from a high-risk country.

Suggest 3-5 alternative countries to source from, **all of which must be meaningfully lower risk than the current country**. The high-risk threshold is 60 on a 0-100 scale.

Rules:
- Do NOT suggest the original country again as an alternative.
- Avoid countries whose risk score is 60 or higher when known (China, Russia, Iran, Pakistan, Argentina, Nigeria, Ukraine, Taiwan, etc.).
- Prefer countries with strong manufacturing or resource capabilities for the given item type (e.g. semiconductors, metals, textiles, agriculture, energy).
- Prefer a mix of regions when possible so that not all alternatives are clustered in a single country like Vietnam.

When you don't know exact risk scores, still favor countries that are generally considered more stable and diversified for that sector.

You will receive the current risk score for the item as context.

Suggest alternatives considering:
- Lower geopolitical risk
- Strong manufacturing/resource capabilities for the item type
- Reasonable logistics and trade agreements
- Cost competitiveness

For each alternative, provide: country name, estimated risk level (low/medium/high), and a one-sentence reason.
You MUST respond ONLY with valid JSON in the exact format:
{ "alternatives": [{ "country": "...", "risk": "low|medium|high", "reason": "..." }] }`

  const userPrompt = `Current sourcing:
- Item: ${itemName || itemType} (${itemType})
- Country: ${country}
- Current risk score: ${currentRisk}%

Suggest alternative sourcing countries.`

  try {
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
        max_tokens: 512,
        response_format: { type: "json_object" },
      }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return NextResponse.json(
        { error: "OpenRouter API error", detail: errBody },
        { status: 502 },
      )
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content ?? ""

    // Try to parse as strict JSON first
    const parseContentToJson = (text: unknown): unknown => {
      if (typeof text === "object" && text !== null) return text
      if (typeof text === "string") {
        try {
          return JSON.parse(text)
        } catch {
          const jsonMatch = text.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
          }
        }
      }
      return null
    }

    let parsed = parseContentToJson(content) as { alternatives?: { country: string; risk: string; reason: string }[] } | null

    const HIGH_RISK_THRESHOLD = 60

    const normalizeRiskLabel = (score: number): "low" | "medium" | "high" => {
      if (score >= HIGH_RISK_THRESHOLD) return "high"
      if (score >= 40) return "medium"
      return "low"
    }

    const filterAndNormalizeAlternatives = (
      alts: { country: string; risk: string; reason: string }[],
    ): { country: string; risk: string; reason: string }[] => {
      const seen = new Set<string>()
      const results: { country: string; risk: string; reason: string }[] = []

      for (const alt of alts) {
        const trimmedCountry = alt.country.trim()
        if (!trimmedCountry || trimmedCountry.toLowerCase() === country.toLowerCase()) continue
        if (seen.has(trimmedCountry.toLowerCase())) continue

        const riskScore = COUNTRY_RISK_SCORES[trimmedCountry] ?? null

        // If we know the score, enforce lower risk and below high-risk threshold
        if (riskScore !== null) {
          if (riskScore >= HIGH_RISK_THRESHOLD) continue
          if (typeof currentRisk === "number" && riskScore >= currentRisk) continue

          results.push({
            country: trimmedCountry,
            risk: normalizeRiskLabel(riskScore),
            reason: alt.reason || "Lower geopolitical and supply chain risk than the current country.",
          })
        } else {
          // If unknown, keep but rely on the model's risk label
          results.push({
            country: trimmedCountry,
            risk: alt.risk as "low" | "medium" | "high",
            reason: alt.reason,
          })
        }

        seen.add(trimmedCountry.toLowerCase())
      }

      return results
    }

    let alternatives = parsed?.alternatives ?? []
    alternatives = filterAndNormalizeAlternatives(alternatives)

    // Fallback: ensure we always return at least some sensible, lower-risk alternatives
    if (!alternatives.length) {
      const safeCandidates = Object.entries(COUNTRY_RISK_SCORES)
        .filter(([name, score]) => {
          if (name.toLowerCase() === country.toLowerCase()) return false
          if (typeof currentRisk === "number") {
            return score < HIGH_RISK_THRESHOLD && score < currentRisk
          }
          return score < HIGH_RISK_THRESHOLD
        })
        .sort((a, b) => a[1] - b[1]) // favor lowest risk
        .slice(0, 5)

      const fallbackAlternatives = safeCandidates.map(([name, score]) => ({
        country: name,
        risk: normalizeRiskLabel(score),
        reason:
          score < 30
            ? "Very low geopolitical and logistics risk with strong trade connectivity."
            : "Moderate risk but significantly safer and more diversified than the current sourcing country.",
      }))

      // If still empty (e.g. currentRisk already very low), just pick a few globally stable hubs
      const defaultHubs =
        fallbackAlternatives.length > 0
          ? fallbackAlternatives
          : [
              {
                country: "Germany",
                risk: "low" as const,
                reason: "Highly reliable manufacturing base with strong logistics and rule-of-law.",
              },
              {
                country: "Singapore",
                risk: "low" as const,
                reason: "Premier logistics and distribution hub with very low political risk.",
              },
              {
                country: "Canada",
                risk: "low" as const,
                reason: "Stable trade environment and strong access to North American markets.",
              },
            ]

      alternatives = defaultHubs
    }

    return NextResponse.json({ alternatives })
  } catch {
    return NextResponse.json({ error: "Failed to reach OpenRouter" }, { status: 502 })
  }
}
