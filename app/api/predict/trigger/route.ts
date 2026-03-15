// app/api/predict/trigger/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import { buildSeedDocument, buildSimulationRequirement } from "@/lib/mirofish/seed-builder"
import { createPipeline, startPipeline } from "@/lib/mirofish/pipeline-manager"
import type { TriggerRequest, TriggerResponse } from "@/lib/mirofish/types"

export async function POST(request: NextRequest) {
  if (process.env.DISABLE_MIROFISH === "true") {
    return NextResponse.json(
      { error: "Hi, you've called the Simulation API in deployment, but due to cost constraints, we cannot provide this right now. Please use the demo mode instead." },
      { status: 503 }
    )
  }

  try {
    const body: TriggerRequest = await request.json()
    const { scenario, countries, source } = body
    console.log(`[predict/trigger] POST received | scenario="${scenario}" | countries=${JSON.stringify(countries)} | source=${source}`)

    if (!scenario || !countries || countries.length === 0) {
      console.log(`[predict/trigger] 400 — missing scenario or countries`)
      return NextResponse.json(
        { error: "scenario and countries are required" },
        { status: 400 }
      )
    }

    // Check MiroFish availability
    const healthy = await miroFishClient.healthCheck()
    if (!healthy) {
      console.log(`[predict/trigger] 503 — MiroFish health check failed`)
      return NextResponse.json(
        { error: "MiroFish service unavailable — ensure the backend is running" },
        { status: 503 }
      )
    }
    console.log(`[predict/trigger] MiroFish health check passed`)

    // Fetch supplementary data for automatic triggers or to enrich manual ones
    let gdeltEvents: Array<{ title: string; url: string; date: string; source: string; tone?: number }> = []
    let newsArticles: Array<{ title: string; url?: string; snippet?: string; source?: string }> = []

    if (source === "automatic" || source === "manual") {
      // Fetch GDELT events for involved countries
      for (const country of countries.slice(0, 3)) {
        try {
          const gdeltRes = await fetch(
            `${request.nextUrl.origin}/api/gdelt?country=${encodeURIComponent(country)}`
          )
          if (gdeltRes.ok) {
            const data = await gdeltRes.json()
            if (data.articles) {
              gdeltEvents.push(...data.articles)
            }
          }
        } catch {
          // Continue without GDELT data
        }
      }

      // Fetch news for primary country
      try {
        const newsRes = await fetch(
          `${request.nextUrl.origin}/api/news?country=${encodeURIComponent(countries[0])}`
        )
        if (newsRes.ok) {
          const data = await newsRes.json()
          if (data.articles) {
            newsArticles = data.articles
          }
        }
      } catch {
        // Continue without news data
      }
    }

    // Build seed document
    const seedMarkdown = buildSeedDocument({
      scenario,
      countries,
      gdeltEvents,
      newsArticles,
    })

    const simulationRequirement = buildSimulationRequirement(scenario)

    // Create pipeline and start first steps (ontology + graph build kick-off)
    const pipelineId = createPipeline(scenario, countries)
    console.log(`[predict/trigger] pipeline created: ${pipelineId}`)

    const pipelineState = await startPipeline(pipelineId, seedMarkdown, simulationRequirement)
    console.log(`[predict/trigger] pipeline started → stage=${pipelineState.stage}${pipelineState.error ? ` error=${pipelineState.error}` : ""}`)

    const response: TriggerResponse = {
      simulationId: pipelineId,
      status: "started",
      estimatedMinutes: 15,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[predict/trigger] 500 ERROR:`, error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
