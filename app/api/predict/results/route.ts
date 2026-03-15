// app/api/predict/results/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import type { PredictionResult, SentimentDataPoint, AffectedCountry, MiroFishAction } from "@/lib/mirofish/types"
import { activeSimulations } from "../trigger/route"

// Cache generated reports to avoid re-triggering on repeated calls
const reportCache = new Map<string, string>()

async function computeSentimentByRound(simulationId: string): Promise<SentimentDataPoint[]> {
  try {
    const actionsRes = await miroFishClient.getActions(simulationId)
    if (!actionsRes.success || !actionsRes.data?.actions) return []

    // Group actions by round
    const byRound = new Map<number, string[]>()
    for (const action of actionsRes.data.actions) {
      const texts = byRound.get(action.round_num) || []
      texts.push(action.result || "")
      byRound.set(action.round_num, texts)
    }

    // Simple keyword-based sentiment (avoids extra LLM calls for demo speed)
    const negativeWords = [
      "conflict", "war", "sanction", "restrict", "crisis", "threat",
      "attack", "escalat", "tension", "ban", "tariff", "block",
      "protest", "unrest", "destabiliz", "collapse", "embargo",
    ]
    const positiveWords = [
      "peace", "agreement", "cooperat", "stabiliz", "diplomat",
      "negotiat", "resolve", "trade deal", "alliance", "de-escalat",
      "recovery", "growth", "partner",
    ]

    const sentiments: SentimentDataPoint[] = []
    const sortedRounds = Array.from(byRound.keys()).sort((a, b) => a - b)

    for (const round of sortedRounds) {
      const texts = byRound.get(round) || []
      const combined = texts.join(" ").toLowerCase()

      let score = 0
      let hits = 0
      for (const word of negativeWords) {
        const count = (combined.match(new RegExp(word, "g")) || []).length
        score -= count * 0.1
        hits += count
      }
      for (const word of positiveWords) {
        const count = (combined.match(new RegExp(word, "g")) || []).length
        score += count * 0.1
        hits += count
      }

      // Normalize to -1 to 1 range
      const sentiment = hits > 0 ? Math.max(-1, Math.min(1, score / Math.max(hits * 0.1, 1))) : 0

      sentiments.push({ round, sentiment: Math.round(sentiment * 100) / 100 })
    }

    return sentiments
  } catch {
    return []
  }
}

function computeSentimentPerCountry(
  actions: MiroFishAction[],
  countries: string[]
): Map<string, number> {
  const negativeWords = [
    "conflict", "war", "sanction", "restrict", "crisis", "threat",
    "attack", "escalat", "tension", "ban", "tariff", "block",
    "protest", "unrest", "destabiliz", "collapse", "embargo",
  ]
  const positiveWords = [
    "peace", "agreement", "cooperat", "stabiliz", "diplomat",
    "negotiat", "resolve", "trade deal", "alliance", "de-escalat",
    "recovery", "growth", "partner",
  ]

  const countryDeltas = new Map<string, number>()

  for (const country of countries) {
    const countryLower = country.toLowerCase()
    // Find actions that mention this country
    const relevant = actions.filter((a) =>
      (a.result || "").toLowerCase().includes(countryLower) ||
      (a.agent_name || "").toLowerCase().includes(countryLower)
    )

    if (relevant.length === 0) {
      countryDeltas.set(country, -0.2) // slight negative bias when no data
      continue
    }

    const combined = relevant.map((a) => a.result || "").join(" ").toLowerCase()
    let score = 0
    let hits = 0
    for (const word of negativeWords) {
      const count = (combined.match(new RegExp(word, "g")) || []).length
      score -= count
      hits += count
    }
    for (const word of positiveWords) {
      const count = (combined.match(new RegExp(word, "g")) || []).length
      score += count
      hits += count
    }

    const delta = hits > 0 ? score / hits : 0
    countryDeltas.set(country, delta)
  }

  return countryDeltas
}

function computeDynamicConfidence(
  hasReport: boolean,
  hasSentiment: boolean,
  currentRound: number,
  totalRounds: number
): number {
  const roundCompletion = totalRounds > 0 ? currentRound / totalRounds : 0
  return 0.4 + (hasReport ? 0.15 : 0) + (hasSentiment ? 0.15 : 0) + (roundCompletion * 0.3)
}

function parseTimelineFromReport(reportMarkdown: string, sentimentByRound: SentimentDataPoint[]): number {
  // Try to extract timeline from report text
  const timelineMatch = reportMarkdown.match(/(\d+)\s*months?/i)
  let months = timelineMatch ? parseInt(timelineMatch[1], 10) : 3

  // Adjust based on sentiment volatility
  if (sentimentByRound.length >= 3) {
    let volatility = 0
    for (let i = 1; i < sentimentByRound.length; i++) {
      volatility += Math.abs(sentimentByRound[i].sentiment - sentimentByRound[i - 1].sentiment)
    }
    volatility /= sentimentByRound.length - 1
    // High volatility = shorter timeline (things are changing fast)
    if (volatility > 0.5) months = Math.max(1, months - 1)
    else if (volatility < 0.1) months = Math.min(12, months + 1)
  }

  return Math.max(1, Math.min(12, months))
}

async function buildFallbackContent(
  simulationId: string,
  scenario: string,
  countries: string[]
): Promise<{ report: string; findings: string[] }> {
  try {
    const actionsRes = await miroFishClient.getActions(simulationId)
    if (!actionsRes.success || !actionsRes.data?.actions?.length) {
      return {
        report: `## Scenario Analysis\n\n${scenario}\n\n*Report generation was unsuccessful. Limited data available from simulation.*`,
        findings: ["Simulation completed but report generation failed — results based on agent activity analysis."],
      }
    }

    const actions = actionsRes.data.actions
    // Pick the most significant actions (longer results tend to be more meaningful)
    const significant = [...actions]
      .sort((a, b) => (b.result || "").length - (a.result || "").length)
      .slice(0, 8)

    const findings = significant
      .filter((a) => a.result && a.result.length > 20)
      .slice(0, 5)
      .map((a) => `${a.agent_name} (Round ${a.round_num}): ${a.result!.slice(0, 150)}`)

    const agentSummaries = significant
      .map((a) => `- **${a.agent_name}** (R${a.round_num}): ${a.result?.slice(0, 200) || a.action_type}`)
      .join("\n")

    const report = [
      `## Scenario Analysis`,
      ``,
      `**Scenario:** ${scenario}`,
      `**Countries:** ${countries.join(", ")}`,
      `**Rounds completed:** ${actions[actions.length - 1]?.round_num || "unknown"}`,
      ``,
      `### Key Agent Actions`,
      ``,
      agentSummaries,
      ``,
      `*Note: Full report generation was unsuccessful. This summary is derived from agent activity logs.*`,
    ].join("\n")

    return {
      report,
      findings: findings.length > 0 ? findings : ["Agent activity captured but no detailed findings could be extracted."],
    }
  } catch {
    return {
      report: `## Scenario Analysis\n\n${scenario}\n\n*Report generation was unsuccessful.*`,
      findings: ["Report generation failed — limited data available."],
    }
  }
}

function parseReportForPrediction(
  reportMarkdown: string,
  countries: string[],
  sentimentByRound: SentimentDataPoint[],
  countryDeltas: Map<string, number>,
  runStatus: { currentRound: number; totalRounds: number }
): {
  summary: string
  confidence: number
  timelineMonths: number
  keyFindings: string[]
  affectedCountries: AffectedCountry[]
} {
  const hasReport = reportMarkdown.length > 50
  const hasSentiment = sentimentByRound.length > 0

  // Extract first paragraph as summary
  const lines = reportMarkdown.split("\n").filter((l) => l.trim() && !l.startsWith("#"))
  const summary = lines[0] || "Simulation complete — review full report for details."

  // Extract bullet points as key findings
  const keyFindings = lines
    .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"))
    .slice(0, 5)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())

  // Sentiment-derived risk scores per country
  const affectedCountries: AffectedCountry[] = countries.map((country) => {
    const delta = countryDeltas.get(country) ?? -0.2
    const currentRisk = 50
    const predictedRisk = Math.max(0, Math.min(100, currentRisk + Math.round(delta * -30)))
    const direction: AffectedCountry["direction"] =
      predictedRisk > currentRisk + 3 ? "up" : predictedRisk < currentRisk - 3 ? "down" : "stable"
    return { country, currentRisk, predictedRisk, direction }
  })

  // Dynamic confidence
  const confidence = computeDynamicConfidence(
    hasReport,
    hasSentiment,
    runStatus.currentRound,
    runStatus.totalRounds
  )

  // Dynamic timeline
  const timelineMonths = parseTimelineFromReport(reportMarkdown, sentimentByRound)

  return {
    summary,
    confidence: Math.round(confidence * 100) / 100,
    timelineMonths,
    keyFindings: keyFindings.length > 0 ? keyFindings : ["See full report for detailed analysis."],
    affectedCountries,
  }
}

export async function GET(request: NextRequest) {
  const simulationId = request.nextUrl.searchParams.get("simulationId")

  if (!simulationId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  try {
    const meta = activeSimulations.get(simulationId)
    const countries = meta?.countries || []
    const scenario = meta?.scenario || ""

    // Get run status for confidence calculation
    let currentRound = 10
    let totalRounds = 10
    try {
      const runStatus = await miroFishClient.getRunStatus(simulationId)
      currentRound = runStatus.data?.current_round || 10
      totalRounds = runStatus.data?.total_rounds || 10
    } catch {
      // Use defaults
    }

    // Get actions for sentiment per country
    let allActions: MiroFishAction[] = []
    try {
      const actionsRes = await miroFishClient.getActions(simulationId)
      if (actionsRes.success && actionsRes.data?.actions) {
        allActions = actionsRes.data.actions
      }
    } catch {
      // Continue without actions
    }

    const countryDeltas = computeSentimentPerCountry(allActions, countries)

    // Generate report (cached to avoid duplicate generation)
    let fullReport = reportCache.get(simulationId) || ""

    if (!fullReport) {
      const reportRes = await miroFishClient.generateReport(simulationId)

      if (reportRes.success && reportRes.data?.report_id) {
        const reportId = reportRes.data.report_id
        let attempts = 0
        while (attempts < 30) {
          const report = await miroFishClient.getReport(reportId)
          if (report.success && report.data?.markdown_content) {
            fullReport = report.data.markdown_content
            reportCache.set(simulationId, fullReport)
            break
          }
          if (report.data?.status === "failed" || report.data?.status === "error") break
          await new Promise((resolve) => setTimeout(resolve, 5000))
          attempts++
        }
      }
    }

    // Build fallback if report failed
    let fallbackFindings: string[] | null = null
    if (!fullReport) {
      const fallback = await buildFallbackContent(simulationId, scenario, countries)
      fullReport = fallback.report
      fallbackFindings = fallback.findings
      reportCache.set(simulationId, fullReport)
    }

    // Compute sentiment
    const sentimentByRound = await computeSentimentByRound(simulationId)

    // Parse report into structured prediction
    const parsed = parseReportForPrediction(
      fullReport,
      countries,
      sentimentByRound,
      countryDeltas,
      { currentRound, totalRounds }
    )

    // Override key findings with fallback if needed
    if (fallbackFindings) {
      parsed.keyFindings = fallbackFindings
    }

    // Derive risk direction from sentiment trend
    const riskDirection =
      sentimentByRound.length >= 2
        ? sentimentByRound[sentimentByRound.length - 1].sentiment <
          sentimentByRound[0].sentiment
          ? ("up" as const)
          : sentimentByRound[sentimentByRound.length - 1].sentiment >
              sentimentByRound[0].sentiment
            ? ("down" as const)
            : ("stable" as const)
        : ("stable" as const)

    const result: PredictionResult = {
      simulationId,
      prediction: {
        ...parsed,
        riskDirection,
      },
      fullReport,
      sentimentByRound,
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
