// app/api/predict-mock/status/route.ts
// Mock status that progresses 1 round/sec, completes in ~10s

import { NextRequest, NextResponse } from "next/server"
import type { SimulationStatus, AgentAction } from "@/lib/mirofish/types"
import { mockSimulations, getMockRound } from "../_store"

const AGENT_NAMES = [
  "Minister Chen Wei",
  "General Tanaka",
  "Trade Analyst Rivera",
  "Ambassador Okafor",
  "Reuters Correspondent",
  "Civilian Observer Park",
  "Finance Minister Schmidt",
  "Admiral Rodriguez",
]

const ROLES: AgentAction["role"][] = [
  "government",
  "military",
  "trader",
  "diplomat",
  "journalist",
  "civilian",
  "government",
  "military",
]

const ACTION_TEMPLATES = [
  "Posted analysis of trade restrictions impacting {country} exports",
  "Issued statement on escalating tensions near {country} border",
  "Published supply chain disruption report for {country} manufacturing sector",
  "Negotiated preliminary agreement with {country} trade delegation",
  "Reported on protest movements affecting logistics in {country}",
  "Raised tariff concerns in response to {country} policy announcement",
  "Deployed monitoring assets near {country} shipping lanes",
  "Called for de-escalation of sanctions against {country}",
  "Released economic impact assessment for {country} embargo scenario",
  "Announced bilateral cooperation framework with {country}",
]

function generateActions(round: number, countries: string[]): AgentAction[] {
  const count = 2 + Math.floor(Math.random() * 3) // 2-4 actions per round
  const actions: AgentAction[] = []

  for (let i = 0; i < count; i++) {
    const agentIdx = (round * 3 + i) % AGENT_NAMES.length
    const templateIdx = (round * 7 + i * 3) % ACTION_TEMPLATES.length
    const country = countries[(round + i) % countries.length]

    actions.push({
      agentName: AGENT_NAMES[agentIdx],
      role: ROLES[agentIdx],
      action: ACTION_TEMPLATES[templateIdx].replace("{country}", country),
      round,
      timestamp: new Date(Date.now() - (10 - round) * 1000).toISOString(),
    })
  }

  return actions
}

export async function GET(request: NextRequest) {
  const simulationId = request.nextUrl.searchParams.get("simulationId")

  if (!simulationId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  const sim = mockSimulations.get(simulationId)
  if (!sim) {
    return NextResponse.json(
      {
        simulationId,
        status: "failed",
        currentRound: 0,
        totalRounds: 10,
        activeAgents: 0,
        recentActions: [],
        error: "Simulation not found",
      } satisfies SimulationStatus,
      { status: 404 }
    )
  }

  const { currentRound, isCompleted } = getMockRound(sim)

  // Generate recent actions for the last few rounds
  const recentActions: AgentAction[] = []
  const startRound = Math.max(1, currentRound - 2)
  for (let r = startRound; r <= currentRound; r++) {
    recentActions.push(...generateActions(r, sim.countries))
  }

  const status: SimulationStatus = {
    simulationId,
    status: currentRound === 0 ? "starting" : isCompleted ? "completed" : "running",
    currentRound,
    totalRounds: sim.totalRounds,
    activeAgents: isCompleted ? 0 : 6 + Math.floor(Math.random() * 3),
    recentActions: recentActions.slice(-10),
  }

  return NextResponse.json(status)
}
