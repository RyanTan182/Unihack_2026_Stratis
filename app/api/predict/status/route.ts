// app/api/predict/status/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import { advancePipeline, getPipeline } from "@/lib/mirofish/pipeline-manager"
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

// Map pipeline stage to client-facing status
function mapStageToStatus(
  stage: string
): SimulationStatus["status"] {
  switch (stage) {
    case "ontology":
    case "graph":
    case "creating":
    case "preparing":
    case "starting":
      return "starting"
    case "running":
      return "running"
    case "completed":
      return "completed"
    case "failed":
      return "failed"
    default:
      return "starting"
  }
}

export async function GET(request: NextRequest) {
  if (process.env.DISABLE_MIROFISH === "true") {
    return NextResponse.json(
      { error: "Hi, you've called the Simulation API in deployment, but due to cost constraints, we cannot provide this right now. Please use the demo mode instead." },
      { status: 503 }
    )
  }

  const pipelineId = request.nextUrl.searchParams.get("simulationId")

  if (!pipelineId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  try {
    console.log(`[predict/status] GET simulationId=${pipelineId}`)
    const pipeline = getPipeline(pipelineId)
    if (!pipeline) {
      return NextResponse.json(
        {
          simulationId: pipelineId,
          status: "failed",
          currentRound: 0,
          totalRounds: 10,
          activeAgents: 0,
          recentActions: [],
          error: "Pipeline not found — it may have expired or the server restarted",
        } satisfies SimulationStatus,
        { status: 404 }
      )
    }

    // Advance pipeline state machine
    console.log(`[predict/status] advancing pipeline (current stage: ${pipeline.stage})`)
    const state = await advancePipeline(pipelineId)
    console.log(`[predict/status] after advance → stage=${state.stage}${state.error ? ` error="${state.error}"` : ""} | projectId=${state.projectId || "none"} | simId=${state.simulationId || "none"}`)

    // If pipeline hasn't reached simulation running stage yet, return pipeline progress
    if (!state.simulationId || !["running", "completed"].includes(state.stage)) {
      const status: SimulationStatus = {
        simulationId: pipelineId,
        status: mapStageToStatus(state.stage),
        currentRound: 0,
        totalRounds: 10,
        activeAgents: 0,
        recentActions: [],
        error: state.stage === "failed" ? state.error : undefined,
      }
      return NextResponse.json(status)
    }

    // Pipeline has reached simulation stage — query actual simulation run status
    let runnerStatus = "idle"
    let currentRound = 0
    let totalRounds = 10
    let totalActions = 0

    try {
      const runStatus = await miroFishClient.getRunStatus(state.simulationId)
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
      const actionsRes = await miroFishClient.getActions(state.simulationId)
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

    console.log(`[predict/status] responding with status=${status.status} round=${status.currentRound}/${status.totalRounds}`)
    return NextResponse.json(status)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(`[predict/status] 500 ERROR:`, error)
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
