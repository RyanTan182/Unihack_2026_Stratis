// app/api/predict/trigger/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import { buildSeedDocument, buildSimulationRequirement } from "@/lib/mirofish/seed-builder"
import type { TriggerRequest, TriggerResponse } from "@/lib/mirofish/types"

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
        { error: "MiroFish service unavailable — ensure the backend is running" },
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

    // Start pipeline asynchronously on MiroFish (returns immediately)
    const pipelineRes = await miroFishClient.startPipeline(
      seedMarkdown,
      simulationRequirement,
      { scenario, countries }
    )

    if (!pipelineRes.success || !pipelineRes.data?.pipeline_id) {
      return NextResponse.json(
        { error: `Pipeline start failed: ${pipelineRes.error || "No pipeline_id returned"}` },
        { status: 500 }
      )
    }

    const response: TriggerResponse = {
      simulationId: pipelineRes.data.pipeline_id,
      status: "started",
      estimatedMinutes: 15,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
