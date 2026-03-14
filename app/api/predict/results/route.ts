// app/api/predict/results/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import type { PredictionResult, SentimentDataPoint, AffectedCountry } from "@/lib/mirofish/types"
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
      const texts = byRound.get(action.round) || []
      texts.push(action.result || "")
      byRound.set(action.round, texts)
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

function parseReportForPrediction(
  reportMarkdown: string,
  countries: string[]
): {
  summary: string
  confidence: number
  timelineMonths: number
  keyFindings: string[]
  affectedCountries: AffectedCountry[]
} {
  // Extract first paragraph as summary
  const lines = reportMarkdown.split("\n").filter((l) => l.trim() && !l.startsWith("#"))
  const summary = lines[0] || "Simulation complete — review full report for details."

  // Extract bullet points as key findings
  const keyFindings = lines
    .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"))
    .slice(0, 5)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())

  // Default values — a production system would parse these from the report
  const affectedCountries: AffectedCountry[] = countries.map((country) => ({
    country,
    currentRisk: 50,
    predictedRisk: 65,
    direction: "up" as const,
  }))

  return {
    summary,
    confidence: 0.65,
    timelineMonths: 3,
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

    // Generate report (cached to avoid duplicate generation)
    let fullReport = reportCache.get(simulationId) || ""

    if (!fullReport) {
      const reportRes = await miroFishClient.generateReport(simulationId)

      if (reportRes.success && reportRes.data?.report_id) {
        const reportId = reportRes.data.report_id
        let attempts = 0
        while (attempts < 30) {
          const report = await miroFishClient.getReport(reportId)
          if (report.success && report.data?.full_report) {
            fullReport = report.data.full_report
            reportCache.set(simulationId, fullReport)
            break
          }
          if (report.data?.status === "failed") break
          await new Promise((resolve) => setTimeout(resolve, 5000))
          attempts++
        }
      }
    }

    // Compute sentiment
    const sentimentByRound = await computeSentimentByRound(simulationId)

    // Parse report into structured prediction
    const parsed = parseReportForPrediction(fullReport, countries)

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
      fullReport: fullReport || "Report generation in progress...",
      sentimentByRound,
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
