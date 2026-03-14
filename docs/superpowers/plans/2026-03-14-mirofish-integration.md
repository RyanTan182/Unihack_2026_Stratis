# MiroFish Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate MiroFish swarm intelligence engine into Stratis to provide live predictive geopolitical risk simulations, with a dedicated predictions panel, inline risk indicators, and alert toasts.

**Architecture:** MiroFish runs as a Docker sidecar (port 5001). Next.js API routes orchestrate the simulation lifecycle (trigger → poll → results). A React hook manages prediction state with 5-second polling. The frontend adds a predictions panel to the sidebar, inline risk arrows in the risk sidebar, and Sonner alert toasts.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Recharts, Sonner, Shadcn/UI, Docker, MiroFish (Python/Flask), kimi-k2.5 via OpenRouter, Zep Cloud

**Spec:** `docs/superpowers/specs/2026-03-14-mirofish-integration-design.md`

---

## Chunk 1: Infrastructure & Types

### Task 1: Docker Compose for MiroFish Sidecar

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
services:
  mirofish:
    build:
      context: ./mirofish
    ports:
      - "5001:5001"
      - "5002:3000"
    environment:
      - LLM_API_KEY=${OPENROUTER_API_KEY}
      - LLM_BASE_URL=https://openrouter.ai/api/v1
      - LLM_MODEL_NAME=moonshotai/kimi-k2.5
      - ZEP_API_KEY=${ZEP_API_KEY}
    volumes:
      - mirofish-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5001/"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mirofish-data:
```

- [ ] **Step 2: Clone MiroFish into project**

Run:
```bash
git clone https://github.com/666ghj/MiroFish.git mirofish
```

- [ ] **Step 3: Add MiroFish env vars to .env.local**

Add to `.env.local`:
```
ZEP_API_KEY=your_zep_cloud_api_key
MIROFISH_URL=http://localhost:5001
```

- [ ] **Step 4: Verify MiroFish starts**

Run:
```bash
docker compose up -d mirofish
docker compose logs mirofish
curl http://localhost:5001/
```
Expected: MiroFish Flask API responds.

- [ ] **Step 5: Commit**

```bash
echo "mirofish/" >> .gitignore
git add docker-compose.yml .gitignore
git commit -m "infra: add MiroFish Docker sidecar configuration"
```

---

### Task 2: TypeScript Types for MiroFish Integration

**Files:**
- Create: `lib/mirofish/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// lib/mirofish/types.ts

// --- MiroFish API Response Types ---

export interface MiroFishTaskResponse {
  success: boolean
  data?: {
    task_id: string
    project_id?: string
    simulation_id?: string
  }
  error?: string
}

export interface MiroFishTaskStatus {
  success: boolean
  data?: {
    status: "pending" | "running" | "completed" | "failed"
    progress?: number
    result?: Record<string, unknown>
    error?: string
  }
}

export interface MiroFishRunStatus {
  success: boolean
  data?: {
    status: "pending" | "running" | "completed" | "failed"
    current_round?: number
    total_rounds?: number
    active_agents?: number
  }
}

export interface MiroFishAction {
  round: number
  timestamp: string
  agent_id: string
  agent_name: string
  action_type: string
  action_args: Record<string, unknown>
  result: string
  success: boolean
}

export interface MiroFishActionsResponse {
  success: boolean
  data?: {
    actions: MiroFishAction[]
  }
}

export interface MiroFishReportResponse {
  success: boolean
  data?: {
    report_id: string
    full_report?: string
    status?: string
  }
}

// --- Stratis Domain Types ---

export type RiskDirection = "up" | "down" | "stable"

export interface AffectedCountry {
  country: string
  currentRisk: number
  predictedRisk: number
  direction: RiskDirection
}

export interface AgentAction {
  agentName: string
  role: "government" | "military" | "trader" | "diplomat" | "journalist" | "civilian"
  action: string
  round: number
  timestamp: string
}

export interface SentimentDataPoint {
  round: number
  sentiment: number
}

export interface Prediction {
  summary: string
  riskDirection: RiskDirection
  confidence: number
  timelineMonths: number
  affectedCountries: AffectedCountry[]
  keyFindings: string[]
}

export interface PredictionResult {
  simulationId: string
  prediction: Prediction
  fullReport: string
  sentimentByRound: SentimentDataPoint[]
}

export interface SimulationStatus {
  simulationId: string
  status: "starting" | "running" | "completed" | "failed" | "timed_out"
  currentRound: number
  totalRounds: number
  activeAgents: number
  recentActions: AgentAction[]
  error?: string
}

export interface TriggerRequest {
  scenario: string
  countries: string[]
  source: "manual" | "automatic"
}

export interface TriggerResponse {
  simulationId: string
  status: "started"
  estimatedMinutes: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mirofish/types.ts
git commit -m "feat: add MiroFish TypeScript type definitions"
```

---

## Chunk 2: MiroFish Client & Seed Builder

### Task 3: MiroFish REST API Client

**Files:**
- Create: `lib/mirofish/client.ts`

- [ ] **Step 1: Create the MiroFish client**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/mirofish/client.ts
git commit -m "feat: add MiroFish REST API client with full pipeline orchestration"
```

---

### Task 4: Seed Document Builder

**Files:**
- Create: `lib/mirofish/seed-builder.ts`

Depends on: existing `/api/gdelt` and `/api/news` response formats, and `app/lib/risk-client.ts` for `CountryRiskEvaluation`.

- [ ] **Step 1: Create seed document builder**

```typescript
// lib/mirofish/seed-builder.ts

interface GdeltEvent {
  title: string
  url: string
  date: string
  source: string
  tone?: number
}

interface NewsArticle {
  title: string
  url?: string
  snippet?: string
  source?: string
  publishedAt?: string
}

interface CountryRiskData {
  country: string
  overallRisk: number
  importRisk: number
  exportRisk: number
  summary?: string
}

interface SeedBuildInput {
  scenario: string
  countries: string[]
  gdeltEvents?: GdeltEvent[]
  newsArticles?: NewsArticle[]
  riskData?: CountryRiskData[]
}

export function buildSeedDocument(input: SeedBuildInput): string {
  const { scenario, countries, gdeltEvents, newsArticles, riskData } = input

  const sections: string[] = []

  // Header
  sections.push(`# Geopolitical Scenario Analysis: ${scenario}`)
  sections.push(`\n**Countries involved:** ${countries.join(", ")}`)
  sections.push(`**Analysis date:** ${new Date().toISOString().split("T")[0]}`)

  // Scenario description
  sections.push(`\n## Scenario`)
  sections.push(scenario)

  // GDELT events
  if (gdeltEvents && gdeltEvents.length > 0) {
    sections.push(`\n## Recent Geopolitical Events`)
    for (const event of gdeltEvents.slice(0, 20)) {
      const tone = event.tone !== undefined ? ` (tone: ${event.tone.toFixed(1)})` : ""
      sections.push(`- **${event.date}** — ${event.title}${tone} (Source: ${event.source})`)
    }
  }

  // News articles
  if (newsArticles && newsArticles.length > 0) {
    sections.push(`\n## News Analysis`)
    for (const article of newsArticles.slice(0, 15)) {
      sections.push(`- **${article.title}**`)
      if (article.snippet) {
        sections.push(`  ${article.snippet}`)
      }
      if (article.source) {
        sections.push(`  Source: ${article.source}`)
      }
    }
  }

  // Current risk context
  if (riskData && riskData.length > 0) {
    sections.push(`\n## Current Risk Context`)
    for (const risk of riskData) {
      sections.push(
        `- **${risk.country}**: Overall risk ${risk.overallRisk}/100 ` +
          `(Import: ${risk.importRisk}, Export: ${risk.exportRisk})` +
          (risk.summary ? ` — ${risk.summary}` : "")
      )
    }
  }

  // Supply chain context
  sections.push(`\n## Supply Chain Dependencies`)
  sections.push(
    `The following countries are part of active supply chains being monitored: ${countries.join(", ")}. ` +
      `Any disruptions to trade routes, tariffs, or political stability in these regions ` +
      `will have direct impact on manufacturing and logistics operations.`
  )

  return sections.join("\n")
}

export function buildSimulationRequirement(scenario: string): string {
  return (
    `Predict how ${scenario} will evolve over the next 1-6 months, focusing on:\n` +
    `- Impact on international trade and shipping routes\n` +
    `- Government policy responses (sanctions, tariffs, export controls)\n` +
    `- Military escalation or de-escalation probability\n` +
    `- Economic ripple effects on supply chains\n` +
    `- Regional stability and civilian sentiment\n` +
    `Simulate the full spectrum of geopolitical actors: government officials, ` +
    `military analysts, trade representatives, diplomats, journalists, and civilian populations.`
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/mirofish/seed-builder.ts
git commit -m "feat: add seed document builder for MiroFish simulations"
```

---

## Chunk 3: API Routes

### Task 5: Predict Trigger API Route

**Files:**
- Create: `app/api/predict/trigger/route.ts`

- [ ] **Step 1: Create trigger route**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/predict/trigger/route.ts
git commit -m "feat: add /api/predict/trigger route for MiroFish simulations"
```

---

### Task 6: Predict Status API Route

**Files:**
- Create: `app/api/predict/status/route.ts`

- [ ] **Step 1: Create status route**

```typescript
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
          round: a.round,
          timestamp: a.timestamp,
        }))
      }
    } catch {
      // Actions may not be available yet
    }

    const mfStatus = runStatus.data?.status || "pending"

    const status: SimulationStatus = {
      simulationId,
      status:
        mfStatus === "pending"
          ? "starting"
          : mfStatus === "running"
            ? "running"
            : mfStatus === "completed"
              ? "completed"
              : "failed",
      currentRound: runStatus.data?.current_round || 0,
      totalRounds: runStatus.data?.total_rounds || 10,
      activeAgents: runStatus.data?.active_agents || 0,
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
```

- [ ] **Step 2: Commit**

```bash
git add app/api/predict/status/route.ts
git commit -m "feat: add /api/predict/status route for polling simulation progress"
```

---

### Task 7: Predict Results API Route

**Files:**
- Create: `app/api/predict/results/route.ts`

- [ ] **Step 1: Create results route**

```typescript
// app/api/predict/results/route.ts

import { NextRequest, NextResponse } from "next/server"
import { miroFishClient } from "@/lib/mirofish/client"
import type { PredictionResult, SentimentDataPoint, AffectedCountry } from "@/lib/mirofish/types"
import { activeSimulations } from "../trigger/route"

// Cache generated reports to avoid re-triggering on repeated calls
const reportCache = new Map<string, string>()

async function computeSentimentByRound(simulationId: string): Promise<SentimentDataPoint[]> {
  try {
    const actionsRes = await miroFishClient.getActions(simulationId)
    if (!actionsRes.success || !actionsRes.data?.actions) return []

    // Group actions by round
    const byRound = new Map<number, string[]>()
    for (const action of actionsRes.data.actions) {
      const texts = byRound.get(action.round) || []
      texts.push(action.result || "")
      byRound.set(action.round, texts)
    }

    // Simple keyword-based sentiment (avoids extra LLM calls for demo speed)
    const negativeWords = [
      "conflict", "war", "sanction", "restrict", "crisis", "threat",
      "attack", "escalat", "tension", "ban", "tariff", "block",
      "protest", "unrest", "destabiliz", "collapse", "embargo",
    ]
    const positiveWords = [
      "peace", "agreement", "cooperat", "stabiliz", "diplomat",
      "negotiat", "resolve", "trade deal", "alliance", "de-escalat",
      "recovery", "growth", "partner",
    ]

    const sentiments: SentimentDataPoint[] = []
    const sortedRounds = Array.from(byRound.keys()).sort((a, b) => a - b)

    for (const round of sortedRounds) {
      const texts = byRound.get(round) || []
      const combined = texts.join(" ").toLowerCase()

      let score = 0
      let hits = 0
      for (const word of negativeWords) {
        const count = (combined.match(new RegExp(word, "g")) || []).length
        score -= count * 0.1
        hits += count
      }
      for (const word of positiveWords) {
        const count = (combined.match(new RegExp(word, "g")) || []).length
        score += count * 0.1
        hits += count
      }

      // Normalize to -1 to 1 range
      const sentiment = hits > 0 ? Math.max(-1, Math.min(1, score / Math.max(hits * 0.1, 1))) : 0

      sentiments.push({ round, sentiment: Math.round(sentiment * 100) / 100 })
    }

    return sentiments
  } catch {
    return []
  }
}

function parseReportForPrediction(
  reportMarkdown: string,
  countries: string[]
): {
  summary: string
  confidence: number
  timelineMonths: number
  keyFindings: string[]
  affectedCountries: AffectedCountry[]
} {
  // Extract first paragraph as summary
  const lines = reportMarkdown.split("\n").filter((l) => l.trim() && !l.startsWith("#"))
  const summary = lines[0] || "Simulation complete — review full report for details."

  // Extract bullet points as key findings
  const keyFindings = lines
    .filter((l) => l.trim().startsWith("-") || l.trim().startsWith("*"))
    .slice(0, 5)
    .map((l) => l.replace(/^[-*]\s*/, "").trim())

  // Default values — a production system would parse these from the report
  const affectedCountries: AffectedCountry[] = countries.map((country) => ({
    country,
    currentRisk: 50,
    predictedRisk: 65,
    direction: "up" as const,
  }))

  return {
    summary,
    confidence: 0.65,
    timelineMonths: 3,
    keyFindings: keyFindings.length > 0 ? keyFindings : ["See full report for detailed analysis."],
    affectedCountries,
  }
}

export async function GET(request: NextRequest) {
  const simulationId = request.nextUrl.searchParams.get("simulationId")

  if (!simulationId) {
    return NextResponse.json({ error: "simulationId parameter required" }, { status: 400 })
  }

  try {
    const meta = activeSimulations.get(simulationId)
    const countries = meta?.countries || []

    // Generate report (cached to avoid duplicate generation)
    let fullReport = reportCache.get(simulationId) || ""

    if (!fullReport) {
      const reportRes = await miroFishClient.generateReport(simulationId)

      if (reportRes.success && reportRes.data?.report_id) {
        const reportId = reportRes.data.report_id
        let attempts = 0
        while (attempts < 30) {
          const report = await miroFishClient.getReport(reportId)
          if (report.success && report.data?.full_report) {
            fullReport = report.data.full_report
            reportCache.set(simulationId, fullReport)
            break
          }
          if (report.data?.status === "failed") break
          await new Promise((resolve) => setTimeout(resolve, 5000))
          attempts++
        }
      }
    }

    // Compute sentiment
    const sentimentByRound = await computeSentimentByRound(simulationId)

    // Parse report into structured prediction
    const parsed = parseReportForPrediction(fullReport, countries)

    // Derive risk direction from sentiment trend
    const riskDirection =
      sentimentByRound.length >= 2
        ? sentimentByRound[sentimentByRound.length - 1].sentiment <
          sentimentByRound[0].sentiment
          ? ("up" as const)
          : sentimentByRound[sentimentByRound.length - 1].sentiment >
              sentimentByRound[0].sentiment
            ? ("down" as const)
            : ("stable" as const)
        : ("stable" as const)

    const result: PredictionResult = {
      simulationId,
      prediction: {
        ...parsed,
        riskDirection,
      },
      fullReport: fullReport || "Report generation in progress...",
      sentimentByRound,
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/predict/results/route.ts
git commit -m "feat: add /api/predict/results route with sentiment analysis and report parsing"
```

---

## Chunk 4: React Hook

### Task 8: Predictions Hook

**Files:**
- Create: `hooks/use-predictions.ts`

Reference pattern: `hooks/use-decompose.ts` (lines 8-97) — state interface, useCallback, AbortController, polling.

- [ ] **Step 1: Create predictions hook**

```typescript
// hooks/use-predictions.ts

"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type {
  SimulationStatus,
  PredictionResult,
  TriggerResponse,
} from "@/lib/mirofish/types"

interface ActivePrediction {
  simulationId: string
  scenario: string
  countries: string[]
  status: SimulationStatus | null
}

interface PredictionsState {
  activePredictions: ActivePrediction[]
  completedPredictions: PredictionResult[]
  isTriggering: boolean
  error: string | null
}

const POLL_INTERVAL_MS = 5000

export function usePredictions() {
  const [state, setState] = useState<PredictionsState>({
    activePredictions: [],
    completedPredictions: [],
    isTriggering: false,
    error: null,
  })
  const pollTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Poll a single simulation's status
  const pollStatus = useCallback((simulationId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/predict/status?simulationId=${simulationId}`)
        if (!res.ok) return

        const status: SimulationStatus = await res.json()

        setState((prev) => ({
          ...prev,
          activePredictions: prev.activePredictions.map((p) =>
            p.simulationId === simulationId ? { ...p, status } : p
          ),
        }))

        // If completed, fetch results and move to completed list
        if (status.status === "completed") {
          // Stop polling
          const timer = pollTimers.current.get(simulationId)
          if (timer) {
            clearInterval(timer)
            pollTimers.current.delete(simulationId)
          }

          // Fetch results
          try {
            const resultsRes = await fetch(
              `/api/predict/results?simulationId=${simulationId}`
            )
            if (resultsRes.ok) {
              const result: PredictionResult = await resultsRes.json()
              setState((prev) => ({
                ...prev,
                activePredictions: prev.activePredictions.filter(
                  (p) => p.simulationId !== simulationId
                ),
                completedPredictions: [result, ...prev.completedPredictions],
              }))
            }
          } catch {
            // Results will be fetched on next attempt
          }
        }

        // If failed or timed out, stop polling
        if (status.status === "failed" || status.status === "timed_out") {
          const timer = pollTimers.current.get(simulationId)
          if (timer) {
            clearInterval(timer)
            pollTimers.current.delete(simulationId)
          }
        }
      } catch {
        // Polling error — will retry on next interval
      }
    }

    // Immediate first poll, then interval
    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    pollTimers.current.set(simulationId, timer)
  }, [])

  // Trigger a new prediction
  const triggerPrediction = useCallback(
    async (scenario: string, countries: string[]) => {
      setState((prev) => ({ ...prev, isTriggering: true, error: null }))

      try {
        const res = await fetch("/api/predict/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, countries, source: "manual" }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `HTTP ${res.status}`)
        }

        const data: TriggerResponse = await res.json()

        const newPrediction: ActivePrediction = {
          simulationId: data.simulationId,
          scenario,
          countries,
          status: null,
        }

        setState((prev) => ({
          ...prev,
          isTriggering: false,
          activePredictions: [newPrediction, ...prev.activePredictions],
        }))

        // Start polling
        pollStatus(data.simulationId)
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isTriggering: false,
          error: error instanceof Error ? error.message : "Failed to trigger prediction",
        }))
      }
    },
    [pollStatus]
  )

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      for (const timer of pollTimers.current.values()) {
        clearInterval(timer)
      }
      pollTimers.current.clear()
    }
  }, [])

  return {
    ...state,
    triggerPrediction,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-predictions.ts
git commit -m "feat: add usePredictions hook with polling and state management"
```

---

## Chunk 5: Frontend Components

### Task 9: Prediction Card Component

**Files:**
- Create: `components/prediction-card.tsx`

Reference: `components/insights-panel.tsx` for card styling (rounded-lg border, bg-muted/30, p-3).

- [ ] **Step 1: Create prediction card component**

```tsx
// components/prediction-card.tsx

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Clock,
  Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { PredictionResult, RiskDirection } from "@/lib/mirofish/types"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface PredictionCardProps {
  result: PredictionResult
}

function DirectionIcon({ direction }: { direction: RiskDirection }) {
  switch (direction) {
    case "up":
      return <TrendingUp className="h-4 w-4 text-red-400" />
    case "down":
      return <TrendingDown className="h-4 w-4 text-green-400" />
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />
  }
}

function directionColor(direction: RiskDirection) {
  switch (direction) {
    case "up":
      return "text-red-400"
    case "down":
      return "text-green-400"
    default:
      return "text-muted-foreground"
  }
}

export function PredictionCard({ result }: PredictionCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { prediction, sentimentByRound } = result

  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium leading-snug">{prediction.summary}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Within {prediction.timelineMonths} months</span>
            <Target className="h-3 w-3 ml-2" />
            <span>{Math.round(prediction.confidence * 100)}% confidence</span>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn("shrink-0", directionColor(prediction.riskDirection))}
        >
          <DirectionIcon direction={prediction.riskDirection} />
          <span className="ml-1 capitalize">{prediction.riskDirection}</span>
        </Badge>
      </div>

      {/* Affected Countries */}
      <div className="flex flex-wrap gap-1.5">
        {prediction.affectedCountries.map((c) => (
          <Badge
            key={c.country}
            variant="secondary"
            className={cn("text-xs", directionColor(c.direction))}
          >
            <DirectionIcon direction={c.direction} />
            <span className="ml-1">
              {c.country} {c.currentRisk}→{c.predictedRisk}
            </span>
          </Badge>
        ))}
      </div>

      {/* Expand/Collapse Button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-muted-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <>
            <ChevronUp className="h-3 w-3 mr-1" /> Hide details
          </>
        ) : (
          <>
            <ChevronDown className="h-3 w-3 mr-1" /> Show details
          </>
        )}
      </Button>

      {/* Expanded Content */}
      {expanded && (
        <div className="space-y-4 pt-2 border-t border-border/50">
          {/* Sentiment Chart */}
          {sentimentByRound.length > 0 && (
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                Agent Sentiment by Round
              </h4>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sentimentByRound}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="round"
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      domain={[-1, 1]}
                      tick={{ fontSize: 10 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Line
                      type="monotone"
                      dataKey="sentiment"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Key Findings */}
          <div>
            <h4 className="text-xs font-medium mb-2 text-muted-foreground">Key Findings</h4>
            <ul className="space-y-1">
              {prediction.keyFindings.map((finding, i) => (
                <li key={i} className="text-xs text-foreground/80 flex gap-2">
                  <span className="text-primary shrink-0">-</span>
                  {finding}
                </li>
              ))}
            </ul>
          </div>

          {/* Full Report */}
          {result.fullReport && (
            <div>
              <h4 className="text-xs font-medium mb-2 text-muted-foreground">Full Report</h4>
              <div className="max-h-60 overflow-y-auto rounded-md bg-background/50 p-3 text-xs whitespace-pre-wrap">
                {result.fullReport}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/prediction-card.tsx
git commit -m "feat: add PredictionCard component with sentiment chart and expandable details"
```

---

### Task 10: Prediction Alert Component (Inline Risk Sidebar)

**Files:**
- Create: `components/prediction-alert.tsx`

- [ ] **Step 1: Create prediction alert component**

```tsx
// components/prediction-alert.tsx

"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AffectedCountry, RiskDirection } from "@/lib/mirofish/types"

interface PredictionAlertProps {
  prediction: AffectedCountry
  onClick?: () => void
}

function directionConfig(direction: RiskDirection) {
  switch (direction) {
    case "up":
      return {
        icon: TrendingUp,
        color: "text-red-400",
        bg: "bg-red-400/10",
        label: "Rising",
        pulse: "animate-pulse",
      }
    case "down":
      return {
        icon: TrendingDown,
        color: "text-green-400",
        bg: "bg-green-400/10",
        label: "Declining",
        pulse: "",
      }
    default:
      return {
        icon: Minus,
        color: "text-muted-foreground",
        bg: "bg-muted/30",
        label: "Stable",
        pulse: "",
      }
  }
}

export function PredictionAlert({ prediction, onClick }: PredictionAlertProps) {
  const config = directionConfig(prediction.direction)
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
        "hover:bg-muted/50 cursor-pointer w-full",
        config.bg
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full shrink-0",
          prediction.direction === "up" ? "bg-red-400 animate-pulse" : "bg-muted-foreground"
        )}
      />
      <span className={cn("font-medium", config.color)}>Predicted</span>
      <Icon className={cn("h-3 w-3", config.color)} />
      <span className={cn("text-xs", config.color)}>
        {prediction.currentRisk}→{prediction.predictedRisk}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/prediction-alert.tsx
git commit -m "feat: add PredictionAlert component for inline risk sidebar indicators"
```

---

### Task 11: Predictions Panel

**Files:**
- Create: `components/predictions-panel.tsx`

Reference: `components/insights-panel.tsx` (lines 87-262) — fixed right panel with header, sections, close button.

- [ ] **Step 1: Create predictions panel**

```tsx
// components/predictions-panel.tsx

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  X,
  Zap,
  Send,
  Loader2,
  Activity,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PredictionCard } from "./prediction-card"
import type { PredictionResult, SimulationStatus, AgentAction } from "@/lib/mirofish/types"

interface ActivePrediction {
  simulationId: string
  scenario: string
  countries: string[]
  status: SimulationStatus | null
}

interface PredictionsPanelProps {
  isOpen: boolean
  onClose: () => void
  activePredictions: ActivePrediction[]
  completedPredictions: PredictionResult[]
  isTriggering: boolean
  error: string | null
  onTrigger: (scenario: string, countries: string[]) => void
}

import {
  Landmark,
  Shield,
  BarChart2,
  Handshake,
  Newspaper,
  User,
} from "lucide-react"

const roleIcons: Record<AgentAction["role"], typeof Landmark> = {
  government: Landmark,
  military: Shield,
  trader: BarChart2,
  diplomat: Handshake,
  journalist: Newspaper,
  civilian: User,
}

function AgentFeed({ actions }: { actions: AgentAction[] }) {
  if (actions.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-4">
        Waiting for agent activity...
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-48 overflow-y-auto">
      {actions.map((action, i) => (
        <div
          key={`${action.round}-${action.agentName}-${i}`}
          className="flex gap-2 text-xs rounded-md bg-background/50 p-2 animate-in fade-in duration-300"
        >
          {(() => { const Icon = roleIcons[action.role]; return <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" /> })()}
          <div className="flex-1 min-w-0">
            <span className="font-medium">{action.agentName}</span>
            <span className="text-muted-foreground ml-1">R{action.round}</span>
            <p className="text-foreground/80 truncate">{action.action}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PredictionsPanel({
  isOpen,
  onClose,
  activePredictions,
  completedPredictions,
  isTriggering,
  error,
  onTrigger,
}: PredictionsPanelProps) {
  const [scenario, setScenario] = useState("")
  const [countriesInput, setCountriesInput] = useState("")

  if (!isOpen) return null

  const handleSubmit = () => {
    if (!scenario.trim()) return
    const countries = countriesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
    if (countries.length === 0) return
    onTrigger(scenario.trim(), countries)
    setScenario("")
    setCountriesInput("")
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[420px] shadow-2xl">
      <div className="flex h-full flex-col bg-background/95 backdrop-blur-xl border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Predictions</h2>
              <p className="text-xs text-muted-foreground">
                MiroFish AI swarm intelligence
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* What-If Input */}
          <div className="p-4 border-b border-border space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              What-If Scenario
            </h3>
            <Input
              placeholder='e.g., "Military tensions in the Taiwan Strait"'
              value={scenario}
              onChange={(e) => setScenario(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="text-sm"
            />
            <Input
              placeholder="Countries (comma-separated): Taiwan, China, Japan"
              value={countriesInput}
              onChange={(e) => setCountriesInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="text-sm"
            />
            <Button
              onClick={handleSubmit}
              disabled={isTriggering || !scenario.trim() || !countriesInput.trim()}
              size="sm"
              className="w-full gap-2"
            >
              {isTriggering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting simulation...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Simulate
                </>
              )}
            </Button>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>

          {/* Active Simulations */}
          {activePredictions.length > 0 && (
            <div className="p-4 border-b border-border space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-yellow-400 animate-pulse" />
                Active Simulations ({activePredictions.length})
              </h3>
              {activePredictions.map((pred) => {
                const progress = pred.status
                  ? (pred.status.currentRound / pred.status.totalRounds) * 100
                  : 0
                const remaining = pred.status
                  ? Math.ceil(
                      ((pred.status.totalRounds - pred.status.currentRound) * 90) / // ~90s per round
                        60
                    )
                  : 15

                return (
                  <div
                    key={pred.simulationId}
                    className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2"
                  >
                    <p className="text-sm font-medium">{pred.scenario}</p>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="flex-1 h-2" />
                      <span className="text-xs text-muted-foreground shrink-0">
                        {pred.status
                          ? `R${pred.status.currentRound}/${pred.status.totalRounds}`
                          : "Starting..."}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ~{remaining} min remaining &middot;{" "}
                      {pred.status?.activeAgents || 0} agents active
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {pred.countries.map((c) => (
                        <Badge key={c} variant="outline" className="text-xs">
                          {c}
                        </Badge>
                      ))}
                    </div>

                    {/* Agent Activity Feed */}
                    {pred.status && pred.status.recentActions.length > 0 && (
                      <div className="pt-2 border-t border-border/30">
                        <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                          Live Agent Feed
                        </h4>
                        <AgentFeed actions={pred.status.recentActions} />
                      </div>
                    )}

                    {/* Error state */}
                    {pred.status?.status === "failed" && (
                      <p className="text-xs text-red-400">
                        {pred.status.error || "Simulation failed"}
                      </p>
                    )}
                    {pred.status?.status === "timed_out" && (
                      <p className="text-xs text-yellow-400">
                        {pred.status.error || "Simulation timed out"}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Completed Predictions */}
          <div className="p-4 space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Predictions ({completedPredictions.length})
            </h3>
            {completedPredictions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                No predictions yet. Run a What-If scenario to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {completedPredictions.map((result) => (
                  <PredictionCard key={result.simulationId} result={result} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/predictions-panel.tsx
git commit -m "feat: add PredictionsPanel with what-if input, live simulation view, and results"
```

---

## Chunk 6: Integration with Existing UI

### Task 12: Add Predictions Nav Item to Sidebar

**Files:**
- Modify: `components/nav-sidebar.tsx`

Reference: Lines 29-49 — existing props interface and nav items array with `onClick` and `active` pattern.

- [ ] **Step 1: Read nav-sidebar.tsx to get current content**

Read: `components/nav-sidebar.tsx`

- [ ] **Step 2: Add Predictions props and nav item**

Add to the `NavSidebarProps` interface:
```typescript
onPredictionsClick?: () => void
isPredictionsOpen?: boolean
```

Add to the nav items array (after the existing items):
```typescript
{ icon: Sparkles, label: "Predictions", active: isPredictionsOpen, onClick: onPredictionsClick },
```

Import `Sparkles` from lucide-react (add to existing import line).

- [ ] **Step 3: Commit**

```bash
git add components/nav-sidebar.tsx
git commit -m "feat: add Predictions nav item to sidebar"
```

---

### Task 13: Wire Predictions into Main Page

**Files:**
- Modify: `app/page.tsx`

Reference: Lines 705-742 for state pattern, lines 981-995 for conditional rendering pattern.

- [ ] **Step 1: Read app/page.tsx to find integration points**

Read: `app/page.tsx` — find the state declarations section (~line 705), the NavSidebar rendering, and the panel rendering area.

- [ ] **Step 2: Add imports**

Add at the top of `app/page.tsx`:
```typescript
import { PredictionsPanel } from "@/components/predictions-panel"
import { PredictionAlert } from "@/components/prediction-alert"
import { usePredictions } from "@/hooks/use-predictions"
```

- [ ] **Step 3: Add state and hook**

Near the other state declarations (~line 705), add:
```typescript
const [isPredictionsOpen, setIsPredictionsOpen] = useState(false)
const predictions = usePredictions()
```

- [ ] **Step 4: Wire nav sidebar props**

Find the `<NavSidebar` JSX and add:
```typescript
onPredictionsClick={() => {
  setIsPredictionsOpen(!isPredictionsOpen)
  setIsInventorySidebarOpen(false)
}}
isPredictionsOpen={isPredictionsOpen}
```

- [ ] **Step 5: Add PredictionsPanel rendering**

Add alongside other panel conditionals (near the InsightsPanel or RelocationPanel rendering):
```tsx
<PredictionsPanel
  isOpen={isPredictionsOpen}
  onClose={() => setIsPredictionsOpen(false)}
  activePredictions={predictions.activePredictions}
  completedPredictions={predictions.completedPredictions}
  isTriggering={predictions.isTriggering}
  error={predictions.error}
  onTrigger={predictions.triggerPrediction}
/>
```

- [ ] **Step 6: Ensure Sonner Toaster is in layout**

Check `app/layout.tsx` for a `<Toaster />` component from Sonner. If it's not present, add it:
```tsx
import { Toaster } from "sonner"
// Inside the layout's body, add:
<Toaster position="top-right" />
```
If the app already uses a custom toast system instead of Sonner, use `toast()` from `sonner` which is already in `package.json` dependencies.

- [ ] **Step 7: Add alert toasts for critical predictions**

Add a `useEffect` after the predictions hook that fires Sonner toasts:
```typescript
import { toast } from "sonner"

// Inside the component, after the predictions hook:
useEffect(() => {
  for (const result of predictions.completedPredictions) {
    for (const country of result.prediction.affectedCountries) {
      if (country.predictedRisk - country.currentRisk > 20) {
        toast.warning(
          `Prediction Alert: ${result.prediction.summary}`,
          {
            description: `${country.country} risk predicted to rise from ${country.currentRisk} to ${country.predictedRisk}`,
            action: {
              label: "View Details",
              onClick: () => setIsPredictionsOpen(true),
            },
            id: `prediction-${result.simulationId}-${country.country}`,
          }
        )
      }
    }
  }
}, [predictions.completedPredictions])
```

- [ ] **Step 8: Commit**

```bash
git add app/page.tsx app/layout.tsx
git commit -m "feat: wire predictions panel, hook, and alert toasts into main page"
```

---

### Task 14: Add Prediction Indicators to Risk Sidebar

**Files:**
- Modify: `components/risk-sidebar.tsx` (or wherever country risk items are rendered)

- [ ] **Step 1: Read the risk sidebar component**

Read the risk sidebar component to find where individual country risk scores are rendered. Look for the country list/card rendering.

- [ ] **Step 2: Add PredictionAlert below country risk scores**

Pass `completedPredictions` as a prop to the risk sidebar. For each country rendered, check if there's a matching prediction:

```tsx
import { PredictionAlert } from "@/components/prediction-alert"
import type { PredictionResult } from "@/lib/mirofish/types"

// In the component props, add:
// predictions?: PredictionResult[]
// onPredictionClick?: () => void

// Below each country's risk score display, add:
{predictions?.map((result) => {
  const match = result.prediction.affectedCountries.find(
    (c) => c.country.toLowerCase() === country.name.toLowerCase()
  )
  if (!match) return null
  return (
    <PredictionAlert
      key={result.simulationId}
      prediction={match}
      onClick={onPredictionClick}
    />
  )
})}
```

- [ ] **Step 3: Wire prediction props from page.tsx**

In `app/page.tsx`, pass predictions to the risk sidebar:
```tsx
<RiskSidebar
  // ...existing props
  predictions={predictions.completedPredictions}
  onPredictionClick={() => setIsPredictionsOpen(true)}
/>
```

- [ ] **Step 4: Commit**

```bash
git add components/risk-sidebar.tsx app/page.tsx
git commit -m "feat: add prediction indicators to risk sidebar"
```

Note: The exact file name and structure of the risk sidebar will need to be verified at implementation time. Read the file first and adapt the integration to match the actual component structure.

---

## Chunk 7: Verification & Demo Prep

### Task 15: End-to-End Verification

- [ ] **Step 1: Start MiroFish sidecar**

Run:
```bash
docker compose up -d mirofish
docker compose logs -f mirofish
```
Expected: MiroFish Flask API starts on port 5001.

- [ ] **Step 2: Start Next.js dev server**

Run:
```bash
npm run dev
```

- [ ] **Step 3: Test the trigger endpoint**

Run:
```bash
curl -X POST http://localhost:3000/api/predict/trigger \
  -H "Content-Type: application/json" \
  -d '{"scenario":"Rising tensions in South China Sea","countries":["China","Taiwan","Japan"],"source":"manual"}'
```
Expected: JSON response with `simulationId` and `status: "started"`.

- [ ] **Step 4: Test the status endpoint**

Run (with the simulationId from step 3):
```bash
curl "http://localhost:3000/api/predict/status?simulationId=<ID>"
```
Expected: JSON with round progress and agent actions.

- [ ] **Step 5: Test the UI**

1. Open the app in browser
2. Click "Predictions" in the nav sidebar
3. Type a scenario and countries, click "Simulate"
4. Verify: progress bar updates, agent feed populates
5. Wait for completion — verify prediction card appears with sentiment chart
6. Verify: risk sidebar shows prediction arrows for affected countries
7. Verify: toast notification fires for high-risk predictions

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: MiroFish predictive risk integration complete"
```

---

## Stretch Goals (Not in Core Plan)

These are specified in the design spec but deferred for the core implementation:

- **Knowledge Graph Embed** — Iframe of MiroFish Vue frontend at port 5002 with "Show Knowledge Graph" toggle button in the live simulation view. Requires CORS configuration.
- **Automatic Monitoring** — Client-side polling every 5 minutes from the predictions hook to auto-detect GDELT events and trigger simulations. Add to `use-predictions.ts`.
- **Live Sentiment Chart During Active Simulation** — Update the sentiment chart in real-time during simulation (not just on completed predictions). Requires computing sentiment from partial action data on each poll.
