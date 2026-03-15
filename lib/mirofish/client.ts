// lib/mirofish/client.ts

import type {
  MiroFishTaskResponse,
  MiroFishTaskStatus,
  MiroFishRunStatus,
  MiroFishActionsResponse,
  MiroFishReportResponse,
} from "./types"

const MIROFISH_URL = process.env.MIROFISH_URL || "http://localhost:5001/api"
const GLOBAL_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes
const POLL_INTERVAL_MS = 3000

function dbg(label: string, data?: unknown) {
  const ts = new Date().toISOString()
  if (data !== undefined) {
    console.log(`[MiroFish ${ts}] ${label}`, typeof data === "string" ? data : JSON.stringify(data, null, 2))
  } else {
    console.log(`[MiroFish ${ts}] ${label}`)
  }
}

export class MiroFishClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || MIROFISH_URL
    dbg(`Client initialized with baseUrl: ${this.baseUrl}`)
  }

  // --- Low-level API calls ---

  async healthCheck(): Promise<boolean> {
    try {
      const rootUrl = this.baseUrl.replace(/\/api\/?$/, "")
      dbg(`Health check → GET ${rootUrl}`)
      const res = await fetch(rootUrl, { signal: AbortSignal.timeout(5000) })
      dbg(`Health check ← ${res.status} ${res.statusText}`)
      return true
    } catch (err) {
      dbg(`Health check FAILED`, err instanceof Error ? err.message : String(err))
      return false
    }
  }

  async generateOntology(
    seedMarkdown: string,
    simulationRequirement: string
  ): Promise<MiroFishTaskResponse> {
    const formData = new FormData()
    const blob = new Blob([seedMarkdown], { type: "text/markdown" })
    formData.append("files", blob, "seed.md")
    formData.append("simulation_requirement", simulationRequirement)

    const url = `${this.baseUrl}/graph/ontology/generate`
    dbg(`generateOntology → POST ${url}`)
    dbg(`  seed length: ${seedMarkdown.length} chars, requirement: "${simulationRequirement.slice(0, 100)}..."`)
    const res = await fetch(url, { method: "POST", body: formData })
    const json = await res.json()
    dbg(`generateOntology ← ${res.status}`, json)
    return json
  }

  async buildGraph(projectId: string): Promise<MiroFishTaskResponse> {
    const url = `${this.baseUrl}/graph/build`
    const body = { project_id: projectId, chunk_size: 500, chunk_overlap: 50 }
    dbg(`buildGraph → POST ${url}`, body)
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    dbg(`buildGraph ← ${res.status}`, json)
    return json
  }

  async pollTask(taskId: string): Promise<MiroFishTaskStatus> {
    const url = `${this.baseUrl}/graph/task/${taskId}`
    dbg(`pollTask → GET ${url}`)
    const res = await fetch(url)
    const json = await res.json()
    dbg(`pollTask ← ${res.status} | status=${json.data?.status || "unknown"}`, json)
    return json
  }

  async createSimulation(projectId: string): Promise<MiroFishTaskResponse> {
    const url = `${this.baseUrl}/simulation/create`
    const body = { project_id: projectId }
    dbg(`createSimulation → POST ${url}`, body)
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    dbg(`createSimulation ← ${res.status}`, json)
    return json
  }

  async prepareSimulation(simulationId: string): Promise<MiroFishTaskResponse> {
    const url = `${this.baseUrl}/simulation/prepare`
    const body = { simulation_id: simulationId }
    dbg(`prepareSimulation → POST ${url}`, body)
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    dbg(`prepareSimulation ← ${res.status}`, json)
    return json
  }

  async startSimulation(simulationId: string): Promise<MiroFishTaskResponse> {
    const url = `${this.baseUrl}/simulation/start`
    const body = {
      simulation_id: simulationId,
      platform: "parallel",
      max_rounds: 10,
      enable_graph_memory_update: true,
    }
    dbg(`startSimulation → POST ${url}`, body)
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    dbg(`startSimulation ← ${res.status}`, json)
    return json
  }

  async getRunStatus(simulationId: string): Promise<MiroFishRunStatus> {
    const url = `${this.baseUrl}/simulation/${simulationId}/run-status`
    dbg(`getRunStatus → GET ${url}`)
    const res = await fetch(url)
    const json = await res.json()
    dbg(`getRunStatus ← ${res.status}`, json)
    return json
  }

  async getActions(simulationId: string): Promise<MiroFishActionsResponse> {
    const url = `${this.baseUrl}/simulation/${simulationId}/actions`
    dbg(`getActions → GET ${url}`)
    const res = await fetch(url)
    const json = await res.json()
    const count = json.data?.actions?.length ?? 0
    dbg(`getActions ← ${res.status} | ${count} actions`)
    return json
  }

  async generateReport(simulationId: string): Promise<MiroFishTaskResponse> {
    const url = `${this.baseUrl}/report/generate`
    const body = { simulation_id: simulationId }
    dbg(`generateReport → POST ${url}`, body)
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    dbg(`generateReport ← ${res.status}`, json)
    return json
  }

  async getReport(reportId: string): Promise<MiroFishReportResponse> {
    const url = `${this.baseUrl}/report/${reportId}`
    dbg(`getReport → GET ${url}`)
    const res = await fetch(url)
    const json = await res.json()
    dbg(`getReport ← ${res.status} | status=${json.data?.status || "unknown"}`)
    return json
  }

  // --- Pipeline endpoints (async, non-blocking) ---

  async startPipeline(
    seedMarkdown: string,
    simulationRequirement: string,
    metadata: Record<string, unknown> = {}
  ): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/pipeline/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed_markdown: seedMarkdown,
        simulation_requirement: simulationRequirement,
        metadata,
      }),
    })
    return res.json()
  }

  async getPipelineStatus(pipelineId: string): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/pipeline/${pipelineId}/status`)
    return res.json()
  }

  // --- High-level orchestration ---

  private async waitForTask(taskId: string, stepName: string): Promise<MiroFishTaskStatus> {
    const startTime = Date.now()
    while (Date.now() - startTime < GLOBAL_TIMEOUT_MS) {
      const status = await this.pollTask(taskId)
      if (!status.success) {
        throw new Error(`${stepName} failed: ${status.data?.error || "Unknown error"}`)
      }
      if (status.data?.status === "completed") return status
      if (status.data?.status === "failed") {
        throw new Error(`${stepName} failed: ${status.data?.error || "Unknown error"}`)
      }
      // Backend uses "processing" not "running" — keep polling
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    throw new Error(`${stepName} timed out after 20 minutes`)
  }

  async runFullPipeline(
    seedMarkdown: string,
    simulationRequirement: string
  ): Promise<{ simulationId: string; projectId: string }> {
    // Step 1: Generate ontology (SYNCHRONOUS — returns project_id directly, no task_id)
    const ontologyRes = await this.generateOntology(seedMarkdown, simulationRequirement)
    if (!ontologyRes.success) {
      throw new Error(`Ontology generation failed: ${ontologyRes.error || "Unknown error"}`)
    }
    const projectId = ontologyRes.data?.project_id
    if (!projectId) throw new Error("No project_id from ontology generation")

    // Step 2: Build graph (ASYNC — returns task_id to poll)
    const graphRes = await this.buildGraph(projectId)
    if (!graphRes.success || !graphRes.data?.task_id) {
      throw new Error(`Graph build failed: ${graphRes.error || "No task_id returned"}`)
    }
    await this.waitForTask(graphRes.data.task_id, "Graph build")

    // Step 3: Create simulation
    const createRes = await this.createSimulation(projectId)
    if (!createRes.success || !createRes.data?.simulation_id) {
      throw new Error(`Simulation creation failed: ${createRes.error || "No simulation_id returned"}`)
    }
    const simulationId = createRes.data.simulation_id

    // Step 4: Prepare simulation (ASYNC — returns task_id to poll)
    const prepareRes = await this.prepareSimulation(simulationId)
    if (!prepareRes.success) {
      throw new Error(`Simulation prepare failed: ${prepareRes.error || "Unknown error"}`)
    }
    // Prepare may return a task_id for async polling, or complete synchronously
    if (prepareRes.data?.task_id) {
      await this.waitForTask(prepareRes.data.task_id, "Simulation preparation")
    }

    // Step 5: Start simulation
    const startRes = await this.startSimulation(simulationId)
    if (!startRes.success) {
      throw new Error(`Simulation start failed: ${startRes.error || "Unknown error"}`)
    }

    return { simulationId, projectId }
  }
}

export const miroFishClient = new MiroFishClient()
