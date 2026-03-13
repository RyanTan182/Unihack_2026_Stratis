// app/api/risk-evaluate/route.ts
import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface Article {
  title: string
  url: string
  date: string
  source: string
}

interface CountryRiskBatchInput {
  nodeId: string
  nodeName: string
  nodeType: "country"
  connections: string[]
  articles: Article[]
}

function factorSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      score: { type: "number" },
      confidence: { type: "number" },
      rationale: { type: "string" },
      evidence: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["score", "confidence", "rationale", "evidence"],
  }
}

function factorGroupSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      tariff: factorSchema(),
      conflict: factorSchema(),
      policy: factorSchema(),
    },
    required: ["tariff", "conflict", "policy"],
  }
}

function weightedFactorRisk(factors: {
  tariff: { score: number }
  conflict: { score: number }
  policy: { score: number }
}) {
  return Math.round(
    factors.tariff.score * 0.35 +
    factors.conflict.score * 0.40 +
    factors.policy.score * 0.25
  )
}

function extractOutputText(response: any): string {
  const output = response?.output ?? []
  for (const item of output) {
    if (item.type === "message") {
      for (const content of item.content ?? []) {
        if (content.type === "output_text" && typeof content.text === "string") {
          return content.text
        }
      }
    }
  }
  throw new Error("No output_text found")
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const countries = (body?.countries ?? []) as CountryRiskBatchInput[]

    if (!Array.isArray(countries) || countries.length === 0) {
      return NextResponse.json({ error: "countries is required" }, { status: 400 })
    }

    const compactCountries = countries.map((country) => ({
      nodeId: country.nodeId,
      nodeName: country.nodeName,
      nodeType: "country",
      connections: country.connections,
      articles: (country.articles ?? []).slice(0, 8).map((a, i) => ({
        index: i + 1,
        title: a.title,
        source: a.source,
        date: a.date,
        url: a.url,
      })),
    }))

    const systemPrompt = `
      You are a supply-chain risk analyst.

      Evaluate supply-chain risk for multiple countries using the provided recent news headlines.
      If the news is nothing related to supply-chain risk at all, ignore the news and give scores based on your knowledge.

      For EACH country, score import-side risk and export-side risk separately.

      For each side, evaluate:
      - tariff risk
      - conflict risk
      - policy risk

      Definitions:
      - tariff risk: tariffs, duties, sanctions-like trade barriers, customs cost escalation
      - conflict risk: war, armed tension, military escalation, security instability, serious geopolitical confrontation
      - policy risk: export controls, regulation changes, industrial policy, administrative restrictions, licensing, government intervention

      Instructions:
      - Use the provided news headlines as evidence.
      - If evidence is weak or sparse, lower confidence.
      - Return valid JSON only.
      - Keep outputs internally consistent across countries in the same batch.
    `.trim()

    const userPrompt = JSON.stringify({
      countries: compactCountries,
      outputFormat: {
        results: [
          {
            nodeId: "string",
            nodeName: "string",
            nodeType: "country",
            importFactors: {
              tariff: { score: "0-100", confidence: "0-1", rationale: "string", evidence: ["string"] },
              conflict: { score: "0-100", confidence: "0-1", rationale: "string", evidence: ["string"] },
              policy: { score: "0-100", confidence: "0-1", rationale: "string", evidence: ["string"] },
            },
            exportFactors: {
              tariff: { score: "0-100", confidence: "0-1", rationale: "string", evidence: ["string"] },
              conflict: { score: "0-100", confidence: "0-1", rationale: "string", evidence: ["string"] },
              policy: { score: "0-100", confidence: "0-1", rationale: "string", evidence: ["string"] },
            },
            summary: "string",
            assumptions: ["string"],
          },
        ],
      },
    })

    const response = await client.responses.create({
      model: "gpt-4.1-nano",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "country_risk_eval_batch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              results: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    nodeId: { type: "string" },
                    nodeName: { type: "string" },
                    nodeType: { type: "string", enum: ["country"] },
                    importFactors: factorGroupSchema(),
                    exportFactors: factorGroupSchema(),
                    summary: { type: "string" },
                    assumptions: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: [
                    "nodeId",
                    "nodeName",
                    "nodeType",
                    "importFactors",
                    "exportFactors",
                    "summary",
                    "assumptions",
                  ],
                },
              },
            },
            required: ["results"],
          },
        },
      },
    })

    const outputText = extractOutputText(response)
    const parsed = JSON.parse(outputText)

    const results = (parsed.results ?? []).map((item: any) => {
      const importRisk = weightedFactorRisk(item.importFactors)
      const exportRisk = weightedFactorRisk(item.exportFactors)
      const overallRisk = Math.round(importRisk * 0.5 + exportRisk * 0.5)

      return {
        ...item,
        importRisk,
        exportRisk,
        overallRisk,
        computedAt: new Date().toISOString(),
      }
    })

    return NextResponse.json({ results })
  } catch (error) {
    console.error("risk-evaluate batch failed:", error)
    return NextResponse.json(
      { error: "batch risk evaluation failed" },
      { status: 500 }
    )
  }
}