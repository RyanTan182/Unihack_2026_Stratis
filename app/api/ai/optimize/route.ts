import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Validation schema
const ComponentSchema = z.object({
  name: z.string(),
  type: z.string(),
  country: z.string(),
  children: z.array(z.unknown()).optional(),
})

const ProductSchema = z.object({
  name: z.string(),
  country: z.string(),
  components: z.array(ComponentSchema),
})

const RequestSchema = z.object({
  product: ProductSchema,
})

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

  const { product } = parseResult.data

  const systemPrompt = `You are a supply chain risk analyst. The user will provide a product's supply chain tree with country locations. Analyze the supply chain for geopolitical, logistics, and trade risks. Provide:
1. A brief overall risk summary (2-3 sentences)
2. Specific risk warnings for high-risk countries/routes
3. Concrete optimization suggestions (alternative countries, diversification strategies)

Keep the response concise and actionable. Use markdown formatting with bullet points.`

  const userPrompt = `Analyze and optimize this supply chain:

Product: ${product.name || "Unnamed"} (assembled in ${product.country})

Supply chain tree:
${JSON.stringify(product.components, null, 2)}

Provide risk analysis and optimization suggestions.`

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
        max_tokens: 1024,
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
    const content = data.choices?.[0]?.message?.content ?? "No response generated."

    return NextResponse.json({ result: content })
  } catch {
    return NextResponse.json({ error: "Failed to reach OpenRouter" }, { status: 502 })
  }
}
