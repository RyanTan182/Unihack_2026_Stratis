// lib/mirofish/client.ts

import type {
  MiroFishTaskResponse,
  MiroFishTaskStatus,
  MiroFishRunStatus,
  MiroFishActionsResponse,
  MiroFishReportResponse,
} from "./types"

const MIROFISH_URL = process.env.MIROFISH_URL || "http://localhost:5001"
const GLOBAL_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes
const POLL_INTERVAL_MS = 3000

export class MiroFishClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || MIROFISH_URL
  }

  // --- Low-level API calls ---

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(this.baseUrl, { signal: AbortSignal.timeout(5000) })
      return res.ok
    } catch {
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

    const res = await fetch(`${this.baseUrl}/graph/ontology/generate`, {
      method: "POST",
      body: formData,
    })
    return res.json()
  }

  async buildGraph(projectId: string): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/graph/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, chunk_size: 500, chunk_overlap: 50 }),
    })
    return res.json()
  }

  async pollTask(taskId: string): Promise<MiroFishTaskStatus> {
    const res = await fetch(`${this.baseUrl}/graph/task/${taskId}`)
    return res.json()
  }

  async createSimulation(projectId: string): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/simulation/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    })
    return res.json()
  }

  async prepareSimulation(simulationId: string): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/simulation/prepare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulation_id: simulationId }),
    })
    return res.json()
  }

  async startSimulation(simulationId: string): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/simulation/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulation_id: simulationId,
        platform: "twitter",
        max_rounds: 10,
        enable_graph_memory_update: true,
      }),
    })
    return res.json()
  }

  async getRunStatus(simulationId: string): Promise<MiroFishRunStatus> {
    const res = await fetch(`${this.baseUrl}/simulation/${simulationId}/run-status`)
    return res.json()
  }

  async getActions(simulationId: string): Promise<MiroFishActionsResponse> {
    const res = await fetch(`${this.baseUrl}/simulation/${simulationId}/actions`)
    return res.json()
  }

  async generateReport(simulationId: string): Promise<MiroFishTaskResponse> {
    const res = await fetch(`${this.baseUrl}/report/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ simulation_id: simulationId }),
    })
    return res.json()
  }

  async getReport(reportId: string): Promise<MiroFishReportResponse> {
    const res = await fetch(`${this.baseUrl}/report/${reportId}`)
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
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
    throw new Error(`${stepName} timed out after 20 minutes`)
  }

  async runFullPipeline(
    seedMarkdown: string,
    simulationRequirement: string
  ): Promise<{ simulationId: string; projectId: string }> {
    // Step 1: Generate ontology
    const ontologyRes = await this.generateOntology(seedMarkdown, simulationRequirement)
    if (!ontologyRes.success || !ontologyRes.data?.task_id) {
      throw new Error(`Ontology generation failed: ${ontologyRes.error || "No task_id returned"}`)
    }
    const ontologyResult = await this.waitForTask(ontologyRes.data.task_id, "Ontology generation")
    const projectId = ontologyResult.data?.result?.project_id as string || ontologyRes.data.project_id
    if (!projectId) throw new Error("No project_id from ontology generation")

    // Step 2: Build graph
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

    // Step 4: Prepare simulation
    const prepareRes = await this.prepareSimulation(simulationId)
    if (!prepareRes.success || !prepareRes.data?.task_id) {
      throw new Error(`Simulation prepare failed: ${prepareRes.error || "No task_id returned"}`)
    }
    await this.waitForTask(prepareRes.data.task_id, "Simulation preparation")

    // Step 5: Start simulation
    const startRes = await this.startSimulation(simulationId)
    if (!startRes.success) {
      throw new Error(`Simulation start failed: ${startRes.error || "Unknown error"}`)
    }

    return { simulationId, projectId }
  }
}

export const miroFishClient = new MiroFishClient()
