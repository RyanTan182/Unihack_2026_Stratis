// app/api/predict/status/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import type { SimulationStatus, AgentAction } from "@/lib/mirofish/types"

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

// Map pipeline status to client-facing simulation status
function mapPipelineStatus(
  pipelineStatus: string
): SimulationStatus["status"] {
  switch (pipelineStatus) {
    case "started":
    case "ontology":
    case "graph":
    case "creating":
    case "preparing":
      return "starting"
    case "running":
      return "starting" // pipeline "running" means simulation was just launched
    case "completed":
      return "starting" // need to check actual simulation run status
    case "failed":
      return "failed"
    default:
      return "starting"
  }
}

export async function GET(request: NextRequest) {
  const pipelineId = request.nextUrl.searchParams.get("simulationId")

  if (!pipelineId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  try {
    // Get pipeline status from MiroFish
    const pipelineRes = await miroFishClient.getPipelineStatus(pipelineId)

    if (!pipelineRes.success) {
      return NextResponse.json(
        {
          simulationId: pipelineId,
          status: "failed",
          currentRound: 0,
          totalRounds: 10,
          activeAgents: 0,
          recentActions: [],
          error: pipelineRes.error || "Pipeline not found",
        } satisfies SimulationStatus,
        { status: 404 }
      )
    }

    const pipelineData = pipelineRes.data!
    const pipelineStatus = pipelineData.status as string
    const simulationId = pipelineData.simulation_id as string | undefined

    // If pipeline hasn't reached simulation stage yet, return pipeline progress
    if (!simulationId || !["running", "completed"].includes(pipelineStatus)) {
      const status: SimulationStatus = {
        simulationId: pipelineId,
        status: mapPipelineStatus(pipelineStatus),
        currentRound: 0,
        totalRounds: 10,
        activeAgents: 0,
        recentActions: [],
        error: pipelineStatus === "failed" ? (pipelineData.error as string) : undefined,
      }
      return NextResponse.json(status)
    }

    // Pipeline has reached simulation stage — query actual simulation run status
    let runnerStatus = "idle"
    let currentRound = 0
    let totalRounds = 10
    let totalActions = 0

    try {
      const runStatus = await miroFishClient.getRunStatus(simulationId)
      if (runStatus.success && runStatus.data) {
        runnerStatus = runStatus.data.runner_status || "idle"
        currentRound = runStatus.data.current_round || 0
        totalRounds = runStatus.data.total_rounds || 10
        totalActions = runStatus.data.total_actions_count || 0
      }
    } catch {
      // Simulation may not have started running yet
    }

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

    const status: SimulationStatus = {
      simulationId: pipelineId,
      status:
        runnerStatus === "idle" || runnerStatus === "starting"
          ? "starting"
          : runnerStatus === "running"
            ? "running"
            : runnerStatus === "completed" || runnerStatus === "stopped"
              ? "completed"
              : "failed",
      currentRound,
      totalRounds,
      activeAgents: totalActions,
      recentActions,
      error: runnerStatus === "failed" ? "Simulation failed" : undefined,
    }

    return NextResponse.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        simulationId: pipelineId,
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
