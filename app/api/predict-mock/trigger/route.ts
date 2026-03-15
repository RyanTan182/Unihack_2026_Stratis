// app/api/predict-mock/trigger/route.ts
// Mock trigger that instantly returns a fake simulationId

import { NextRequest, NextResponse } from "next/server"
import type { TriggerRequest, TriggerResponse } from "@/lib/mirofish/types"
import { mockSimulations } from "../_store"

export async function POST(request: NextRequest) {
  try {
    const body: TriggerRequest = await request.json()
    const { scenario, countries } = body

    if (!scenario || !countries || countries.length === 0) {
      return NextResponse.json(
        { error: "scenario and countries are required" },
        { status: 400 }
      )
    }

    const simulationId = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    mockSimulations.set(simulationId, {
      scenario,
      countries,
      startedAt: Date.now(),
      totalRounds: 10,
    })

    const response: TriggerResponse = {
      simulationId,
      status: "started",
      estimatedMinutes: 0.2,
    }

    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
