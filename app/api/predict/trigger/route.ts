// app/api/predict/trigger/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import { buildSeedDocument, buildSimulationRequirement } from "@/lib/mirofish/seed-builder"
import type { TriggerRequest, TriggerResponse } from "@/lib/mirofish/types"

// In-memory store for active simulations (shared across routes via module scope)
// NOTE: This works in local dev (next dev) but will NOT persist across serverless functions.
// For the hackathon demo running locally, this is fine.
export const activeSimulations = new Map<
  string,
  {
    scenario: string
    countries: string[]
    startedAt: number
    projectId: string
  }
>()

export async function POST(request: NextRequest) {
  try {
    const body: TriggerRequest = await request.json()
    const { scenario, countries, source } = body

    if (!scenario || !countries || countries.length === 0) {
      return NextResponse.json(
        { error: "scenario and countries are required" },
        { status: 400 }
      )
    }

    // Check MiroFish availability
    const healthy = await miroFishClient.healthCheck()
    if (!healthy) {
      return NextResponse.json(
        { error: "MiroFish service unavailable — ensure Docker is running" },
        { status: 503 }
      )
    }

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

    // Run full MiroFish pipeline (ontology → graph → create → prepare → start)
    const { simulationId, projectId } = await miroFishClient.runFullPipeline(
      seedMarkdown,
      simulationRequirement
    )

    // Store simulation metadata
    activeSimulations.set(simulationId, {
      scenario,
      countries,
      startedAt: Date.now(),
      projectId,
    })

    const response: TriggerResponse = {
      simulationId,
      status: "started",
      estimatedMinutes: 15,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
