import { NextRequest, NextResponse } from "next/server"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey || apiKey === "your-openrouter-api-key-here") {
    return NextResponse.json({ error: "OPENROUTER_API_KEY not configured" }, { status: 500 })
  }

  const body = await request.json()
  const { country, itemType, itemName, currentRisk } = body as {
    country: string
    itemType: string
    itemName: string
    currentRisk: number
  }

  if (!country) {
    return NextResponse.json({ error: "country is required" }, { status: 400 })
  }

  const systemPrompt = `You are a supply chain sourcing expert. The user has a supply chain item currently sourced from a high-risk country. Suggest 3-5 alternative countries to source from, considering:
- Lower geopolitical risk
- Strong manufacturing/resource capabilities for the item type
- Reasonable logistics and trade agreements
- Cost competitiveness

For each alternative, provide: country name, estimated risk level (low/medium/high), and a one-sentence reason.
Respond in JSON format: { "alternatives": [{ "country": "...", "risk": "low|medium|high", "reason": "..." }] }`

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

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return NextResponse.json(parsed)
      }
    } catch {
      // If JSON parsing fails, return raw text
    }

    return NextResponse.json({ alternatives: [], raw: content })
  } catch {
    return NextResponse.json({ error: "Failed to reach OpenRouter" }, { status: 502 })
  }
}
