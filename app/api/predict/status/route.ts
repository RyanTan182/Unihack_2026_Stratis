// app/api/predict/status/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import type { SimulationStatus, AgentAction } from "@/lib/mirofish/types"
import { activeSimulations } from "../trigger/route"

const GLOBAL_TIMEOUT_MS = 20 * 60 * 1000

// Map MiroFish action types to agent roles
function inferRole(agentName: string): AgentAction["role"] {
  const lower = agentName.toLowerCase()
  if (lower.includes("minister") || lower.includes("official") || lower.includes("governor"))
    return "government"
  if (lower.includes("general") || lower.includes("military") || lower.includes("admiral"))
    return "military"
  if (lower.includes("trader") || lower.includes("analyst") || lower.includes("investor"))
    return "trader"
  if (lower.includes("ambassador") || lower.includes("diplomat") || lower.includes("envoy"))
    return "diplomat"
  if (lower.includes("journalist") || lower.includes("reporter") || lower.includes("editor"))
    return "journalist"
  return "civilian"
}

export async function GET(request: NextRequest) {
  const simulationId = request.nextUrl.searchParams.get("simulationId")

  if (!simulationId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  try {
    // Check for timeout
    const meta = activeSimulations.get(simulationId)
    if (meta && Date.now() - meta.startedAt > GLOBAL_TIMEOUT_MS) {
      const timedOut: SimulationStatus = {
        simulationId,
        status: "timed_out",
        currentRound: 0,
        totalRounds: 10,
        activeAgents: 0,
        recentActions: [],
        error: "Simulation timed out — try a simpler scenario or fewer countries.",
      }
      return NextResponse.json(timedOut)
    }

    // Get run status from MiroFish
    const runStatus = await miroFishClient.getRunStatus(simulationId)

    // Get recent actions
    let recentActions: AgentAction[] = []
    try {
      const actionsRes = await miroFishClient.getActions(simulationId)
      if (actionsRes.success && actionsRes.data?.actions) {
        recentActions = actionsRes.data.actions.slice(-10).map((a) => ({
          agentName: a.agent_name,
          role: inferRole(a.agent_name),
          action: a.result || `${a.action_type}`,
          round: a.round_num,
          timestamp: a.timestamp,
        }))
      }
    } catch {
      // Actions may not be available yet
    }

    const mfStatus = runStatus.data?.runner_status || "idle"

    const status: SimulationStatus = {
      simulationId,
      status:
        mfStatus === "idle" || mfStatus === "starting"
          ? "starting"
          : mfStatus === "running"
            ? "running"
            : mfStatus === "completed" || mfStatus === "stopped"
              ? "completed"
              : "failed",
      currentRound: runStatus.data?.current_round || 0,
      totalRounds: runStatus.data?.total_rounds || 10,
      activeAgents: runStatus.data?.total_actions_count || 0,
      recentActions,
      error: mfStatus === "failed" ? (runStatus.data as Record<string, unknown>)?.error as string : undefined,
    }

    return NextResponse.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        simulationId,
        status: "failed",
        currentRound: 0,
        totalRounds: 10,
        activeAgents: 0,
        recentActions: [],
        error: message,
      } satisfies SimulationStatus,
      { status: 500 }
    )
  }
}
