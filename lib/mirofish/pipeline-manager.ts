// lib/mirofish/pipeline-manager.ts
// In-memory pipeline state manager — replaces the /api/pipeline/* endpoints
// that don't exist on the official MiroFish Docker image.

import { miroFishClient } from "./client"

function dbg(pipelineId: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString()
  if (data !== undefined) {
    console.log(`[Pipeline ${ts}] [${pipelineId}] ${msg}`, typeof data === "string" ? data : JSON.stringify(data, null, 2))
  } else {
    console.log(`[Pipeline ${ts}] [${pipelineId}] ${msg}`)
  }
}

export type PipelineStage =
  | "ontology"
  | "graph"
  | "creating"
  | "preparing"
  | "starting"
  | "running"
  | "completed"
  | "failed"

export interface PipelineState {
  id: string
  projectId?: string
  graphTaskId?: string
  simulationId?: string
  prepareTaskId?: string
  stage: PipelineStage
  scenario: string
  countries: string[]
  error?: string
}

const pipelines = new Map<string, PipelineState>()

let nextId = 1

export function createPipeline(scenario: string, countries: string[]): string {
  const id = `pipeline-${Date.now()}-${nextId++}`
  pipelines.set(id, {
    id,
    stage: "ontology",
    scenario,
    countries,
  })
  dbg(id, `CREATED | scenario="${scenario}" | countries=${JSON.stringify(countries)}`)
  return id
}

export function getPipeline(id: string): PipelineState | undefined {
  return pipelines.get(id)
}

/**
 * Start the first step (ontology generation) synchronously.
 * Called once from the trigger route after creating the pipeline.
 */
export async function startPipeline(
  id: string,
  seedMarkdown: string,
  simulationRequirement: string
): Promise<PipelineState> {
  const state = pipelines.get(id)
  if (!state) throw new Error("Pipeline not found")

  try {
    // Step 1: Generate ontology (synchronous — returns project_id directly)
    // Retry up to 3 times — Mirofish LLM output is non-deterministic and sometimes
    // returns malformed JSON that fails their server-side validation
    let ontologyRes: Awaited<ReturnType<typeof miroFishClient.generateOntology>> | null = null
    let lastOntologyError = ""
    for (let attempt = 1; attempt <= 3; attempt++) {
      dbg(id, `STAGE ontology → calling generateOntology (attempt ${attempt}/3)`)
      ontologyRes = await miroFishClient.generateOntology(seedMarkdown, simulationRequirement)
      if (ontologyRes.success && ontologyRes.data?.project_id) {
        break
      }
      lastOntologyError = ontologyRes.error || "Unknown error"
      dbg(id, `ontology attempt ${attempt} failed: ${lastOntologyError}`)
      if (attempt < 3) {
        dbg(id, `retrying in 3s...`)
        await new Promise((r) => setTimeout(r, 3000))
      }
    }

    if (!ontologyRes?.success) {
      state.stage = "failed"
      state.error = `Ontology generation failed after 3 attempts: ${lastOntologyError}`
      dbg(id, `FAILED at ontology (all retries exhausted)`, { error: state.error })
      return state
    }

    const projectId = ontologyRes.data?.project_id
    if (!projectId) {
      state.stage = "failed"
      state.error = "No project_id from ontology generation"
      dbg(id, `FAILED — no project_id in response`, ontologyRes)
      return state
    }

    state.projectId = projectId
    dbg(id, `ontology OK → projectId=${projectId}`)

    // Step 2: Kick off graph build (async — returns task_id)
    dbg(id, "STAGE graph → calling buildGraph")
    const graphRes = await miroFishClient.buildGraph(projectId)
    if (!graphRes.success || !graphRes.data?.task_id) {
      state.stage = "failed"
      state.error = `Graph build failed: ${graphRes.error || "No task_id returned"}`
      dbg(id, `FAILED at graph build`, { error: state.error, response: graphRes })
      return state
    }

    state.graphTaskId = graphRes.data.task_id
    state.stage = "graph"
    dbg(id, `graph build kicked off → taskId=${state.graphTaskId}`)
    return state
  } catch (err) {
    state.stage = "failed"
    state.error = err instanceof Error ? err.message : "Unknown error"
    dbg(id, `EXCEPTION in startPipeline`, { error: state.error, stack: err instanceof Error ? err.stack : undefined })
    return state
  }
}

/**
 * Advance the pipeline state machine. Called on each status poll.
 * Checks current stage and moves forward if the current async step is done.
 */
export async function advancePipeline(id: string): Promise<PipelineState> {
  const state = pipelines.get(id)
  if (!state) throw new Error("Pipeline not found")
  if (state.stage === "completed" || state.stage === "failed") {
    dbg(id, `advancePipeline — already terminal: ${state.stage}${state.error ? ` (${state.error})` : ""}`)
    return state
  }

  dbg(id, `advancePipeline — current stage: ${state.stage}`)

  try {
    switch (state.stage) {
      case "graph": {
        // Poll graph build task
        dbg(id, `polling graph task ${state.graphTaskId}`)
        const taskStatus = await miroFishClient.pollTask(state.graphTaskId!)
        if (taskStatus.data?.status === "failed") {
          state.stage = "failed"
          state.error = `Graph build failed: ${taskStatus.data?.error || "Unknown"}`
          dbg(id, `FAILED at graph`, { error: state.error, taskData: taskStatus.data })
          return state
        }
        if (taskStatus.data?.status === "completed") {
          dbg(id, `graph build COMPLETED → moving to creating`)
          state.stage = "creating"
          return await advancePipeline(id)
        }
        dbg(id, `graph still processing (status=${taskStatus.data?.status})`)
        return state
      }

      case "creating": {
        dbg(id, `creating simulation for project ${state.projectId}`)
        const createRes = await miroFishClient.createSimulation(state.projectId!)
        if (!createRes.success || !createRes.data?.simulation_id) {
          state.stage = "failed"
          state.error = `Simulation creation failed: ${createRes.error || "No simulation_id"}`
          dbg(id, `FAILED at creating`, { error: state.error, response: createRes })
          return state
        }
        state.simulationId = createRes.data.simulation_id
        dbg(id, `simulation created → simulationId=${state.simulationId}`)
        state.stage = "preparing"

        // Kick off preparation
        dbg(id, `preparing simulation ${state.simulationId}`)
        const prepareRes = await miroFishClient.prepareSimulation(state.simulationId)
        if (!prepareRes.success) {
          state.stage = "failed"
          state.error = `Simulation prepare failed: ${prepareRes.error || "Unknown"}`
          dbg(id, `FAILED at prepare`, { error: state.error, response: prepareRes })
          return state
        }
        if (prepareRes.data?.task_id) {
          state.prepareTaskId = prepareRes.data.task_id
          dbg(id, `prepare is async → taskId=${state.prepareTaskId}`)
        } else {
          dbg(id, `prepare completed synchronously → moving to starting`)
          state.stage = "starting"
          return await advancePipeline(id)
        }
        return state
      }

      case "preparing": {
        if (state.prepareTaskId) {
          dbg(id, `polling prepare task ${state.prepareTaskId}`)
          const taskStatus = await miroFishClient.pollTask(state.prepareTaskId)
          if (taskStatus.data?.status === "failed") {
            state.stage = "failed"
            state.error = `Preparation failed: ${taskStatus.data?.error || "Unknown"}`
            dbg(id, `FAILED at preparation`, { error: state.error, taskData: taskStatus.data })
            return state
          }
          if (taskStatus.data?.status === "completed") {
            dbg(id, `preparation COMPLETED → moving to starting`)
            state.stage = "starting"
            return await advancePipeline(id)
          }
          dbg(id, `preparation still processing (status=${taskStatus.data?.status})`)
          return state
        }
        dbg(id, `no prepareTaskId — moving to starting`)
        state.stage = "starting"
        return await advancePipeline(id)
      }

      case "starting": {
        dbg(id, `starting simulation ${state.simulationId}`)
        const startRes = await miroFishClient.startSimulation(state.simulationId!)
        if (!startRes.success) {
          state.stage = "failed"
          state.error = `Simulation start failed: ${startRes.error || "Unknown"}`
          dbg(id, `FAILED at start`, { error: state.error, response: startRes })
          return state
        }
        state.stage = "running"
        dbg(id, `simulation STARTED → running`)
        return state
      }

      case "running": {
        try {
          dbg(id, `checking run status for simulation ${state.simulationId}`)
          const runStatus = await miroFishClient.getRunStatus(state.simulationId!)
          if (runStatus.success && runStatus.data) {
            const runner = runStatus.data.runner_status || "idle"
            const round = runStatus.data.current_round || 0
            const total = runStatus.data.total_rounds || 10
            dbg(id, `run status: runner=${runner} round=${round}/${total}`)
            if (runner === "completed" || runner === "stopped") {
              state.stage = "completed"
              dbg(id, `simulation COMPLETED`)
            } else if (runner === "failed") {
              state.stage = "failed"
              state.error = "Simulation run failed"
              dbg(id, `simulation run FAILED`, runStatus.data)
            }
          }
        } catch (err) {
          dbg(id, `run status poll error (will retry)`, err instanceof Error ? err.message : String(err))
        }
        return state
      }

      default:
        dbg(id, `unknown stage: ${state.stage}`)
        return state
    }
  } catch (err) {
    state.stage = "failed"
    state.error = err instanceof Error ? err.message : "Unknown error"
    dbg(id, `EXCEPTION in advancePipeline`, { error: state.error, stack: err instanceof Error ? err.stack : undefined })
    return state
  }
}
