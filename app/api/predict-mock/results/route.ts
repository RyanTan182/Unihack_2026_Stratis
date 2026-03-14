// app/api/predict-mock/results/route.ts
// Mock results with realistic, varied data — no MiroFish needed

import { NextRequest, NextResponse } from "next/server"
import type {
  PredictionResult,
  SentimentDataPoint,
  AffectedCountry,
} from "@/lib/mirofish/types"
import { mockSimulations } from "../_store"

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function generateSentiment(totalRounds: number, seed: number): SentimentDataPoint[] {
  const rand = seededRandom(seed)
  const points: SentimentDataPoint[] = []
  let sentiment = 0.1 + (rand() - 0.5) * 0.3

  for (let round = 1; round <= totalRounds; round++) {
    // Trend generally negative with noise
    sentiment += (rand() - 0.6) * 0.2
    sentiment = Math.max(-1, Math.min(1, sentiment))
    points.push({ round, sentiment: Math.round(sentiment * 100) / 100 })
  }

  return points
}

function generateCountryRisks(
  countries: string[],
  seed: number
): AffectedCountry[] {
  const rand = seededRandom(seed)

  return countries.map((country) => {
    const currentRisk = 30 + Math.round(rand() * 40) // 30-70
    const delta = Math.round((rand() - 0.3) * 35) // biased upward
    const predictedRisk = Math.max(0, Math.min(100, currentRisk + delta))
    const direction: AffectedCountry["direction"] =
      delta > 3 ? "up" : delta < -3 ? "down" : "stable"

    return { country, currentRisk, predictedRisk, direction }
  })
}

const SCENARIO_FINDINGS: Record<string, string[]> = {
  default: [
    "Trade flow disruptions likely within 60 days if current trajectory holds",
    "Key shipping routes face increased insurance premiums",
    "Alternative supplier regions identified but transition costs are significant",
    "Diplomatic channels remain open but progress is slow",
    "Market sentiment increasingly negative across affected sectors",
  ],
  tariff: [
    "Retaliatory tariff escalation probability estimated at 72%",
    "Consumer electronics supply chains most exposed to cost increases",
    "Re-routing through neutral countries adds 15-22% to logistics costs",
    "Agricultural exports from affected regions face immediate impact",
    "Currency volatility amplifying trade cost uncertainty",
  ],
  military: [
    "Shipping lane restrictions affecting 23% of regional container traffic",
    "Defense sector companies accelerating supply chain diversification",
    "Insurance costs for vessels in affected waters up 340%",
    "Semiconductor supply concentration creates critical vulnerability",
    "Energy commodity prices responding to heightened geopolitical risk",
  ],
  sanction: [
    "Payment system fragmentation complicating cross-border transactions",
    "Raw material sourcing requires immediate alternative identification",
    "Compliance costs expected to increase 30-45% for affected trade corridors",
    "Secondary sanction risk affecting third-party trading partners",
    "Stockpiling behavior detected in critical mineral markets",
  ],
}

function pickFindings(scenario: string): string[] {
  const lower = scenario.toLowerCase()
  if (lower.includes("tariff") || lower.includes("trade war")) return SCENARIO_FINDINGS.tariff
  if (lower.includes("military") || lower.includes("tension") || lower.includes("conflict"))
    return SCENARIO_FINDINGS.military
  if (lower.includes("sanction") || lower.includes("embargo")) return SCENARIO_FINDINGS.sanction
  return SCENARIO_FINDINGS.default
}

function generateReport(scenario: string, countries: string[], findings: string[]): string {
  return [
    `## Geopolitical Simulation Report`,
    ``,
    `**Scenario:** ${scenario}`,
    `**Countries Analyzed:** ${countries.join(", ")}`,
    `**Simulation Duration:** 10 rounds`,
    `**Generated:** ${new Date().toISOString().split("T")[0]}`,
    ``,
    `### Executive Summary`,
    ``,
    `The multi-agent simulation modeled ${countries.length} national actors across political, economic, military, and civilian domains. Agent interactions revealed escalatory dynamics in ${Math.min(2, countries.length)} of ${countries.length} analyzed regions, with cascading effects on trade infrastructure and commodity pricing.`,
    ``,
    `### Key Findings`,
    ``,
    ...findings.map((f) => `- ${f}`),
    ``,
    `### Agent Activity Summary`,
    ``,
    `- **Government agents** pursued protectionist policies in ${Math.ceil(countries.length * 0.6)} scenarios`,
    `- **Military agents** signaled deterrence postures affecting maritime corridors`,
    `- **Trade analysts** flagged supply chain concentration risks in electronics and energy`,
    `- **Diplomatic agents** attempted bilateral de-escalation with limited success`,
    `- **Civilian observers** reported increased economic uncertainty sentiment`,
    ``,
    `### Risk Timeline`,
    ``,
    `Initial disruption effects expected within 2-4 months. Full supply chain adaptation would require 6-8 months under current policy trajectories. Diplomatic resolution pathway exists but requires coordinated action within 45 days.`,
    ``,
    `### Methodology`,
    ``,
    `This report was generated using MiroFish multi-agent simulation with ${countries.length * 2} autonomous agents operating across social and strategic platforms for 10 rounds of interaction.`,
  ].join("\n")
}

export async function GET(request: NextRequest) {
  const simulationId = request.nextUrl.searchParams.get("simulationId")

  if (!simulationId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  const sim = mockSimulations.get(simulationId)
  if (!sim) {
    return NextResponse.json({ error: "Simulation not found" }, { status: 404 })
  }

  // Use simulationId hash as seed for deterministic results
  const seed = simulationId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const rand = seededRandom(seed)

  const sentimentByRound = generateSentiment(sim.totalRounds, seed)
  const affectedCountries = generateCountryRisks(sim.countries, seed + 1)
  const keyFindings = pickFindings(sim.scenario)

  // Derive overall risk direction from sentiment trend
  const firstSentiment = sentimentByRound[0]?.sentiment ?? 0
  const lastSentiment = sentimentByRound[sentimentByRound.length - 1]?.sentiment ?? 0
  const riskDirection =
    lastSentiment < firstSentiment - 0.05
      ? ("up" as const)
      : lastSentiment > firstSentiment + 0.05
        ? ("down" as const)
        : ("stable" as const)

  // Dynamic confidence
  const confidence = 0.4 + 0.15 + 0.15 + (sim.totalRounds / sim.totalRounds) * 0.3 // report + sentiment + full rounds
  const roundedConfidence = Math.round(Math.min(1, confidence) * 100) / 100

  // Timeline from sentiment volatility
  let volatility = 0
  for (let i = 1; i < sentimentByRound.length; i++) {
    volatility += Math.abs(sentimentByRound[i].sentiment - sentimentByRound[i - 1].sentiment)
  }
  volatility /= Math.max(1, sentimentByRound.length - 1)
  const timelineMonths = volatility > 0.3 ? 2 : volatility > 0.1 ? 3 : 4

  const summary =
    `Multi-agent simulation of "${sim.scenario}" across ${sim.countries.join(", ")} reveals ` +
    (riskDirection === "up"
      ? "escalating risk trajectory with cascading supply chain effects."
      : riskDirection === "down"
        ? "stabilizing conditions with potential for diplomatic resolution."
        : "mixed signals requiring continued monitoring.")

  const fullReport = generateReport(sim.scenario, sim.countries, keyFindings)

  const result: PredictionResult = {
    simulationId,
    prediction: {
      summary,
      riskDirection,
      confidence: roundedConfidence,
      timelineMonths,
      affectedCountries,
      keyFindings,
    },
    fullReport,
    sentimentByRound,
  }

  return NextResponse.json(result)
}
