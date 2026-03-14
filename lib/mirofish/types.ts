// lib/mirofish/types.ts

// --- MiroFish API Response Types ---

export interface MiroFishTaskResponse {
  success: boolean
  data?: {
    task_id?: string
    project_id?: string
    simulation_id?: string
    report_id?: string
    status?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
  error?: string
}

export interface MiroFishTaskStatus {
  success: boolean
  data?: {
    status: "pending" | "processing" | "completed" | "failed"
    progress?: number
    result?: Record<string, unknown>
    error?: string
  }
}

export interface MiroFishRunStatus {
  success: boolean
  data?: {
    runner_status: "idle" | "starting" | "running" | "completed" | "stopped" | "failed"
    current_round?: number
    total_rounds?: number
    total_actions_count?: number
    twitter_actions_count?: number
    reddit_actions_count?: number
  }
}

export interface MiroFishAction {
  round_num: number
  timestamp: string
  platform: string
  agent_id: number
  agent_name: string
  action_type: string
  action_args: Record<string, unknown>
  result: string
  success: boolean
}

export interface MiroFishActionsResponse {
  success: boolean
  data?: {
    count: number
    actions: MiroFishAction[]
  }
}

export interface MiroFishReportResponse {
  success: boolean
  data?: {
    report_id: string
    simulation_id?: string
    status?: string
    markdown_content?: string
    outline?: Record<string, unknown>
    created_at?: string
    completed_at?: string
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

// --- Supply Chain Impact Types (client-side cross-referencing) ---

export interface ProductImpact {
  productId: string
  productName: string
  affectedNodes: AffectedNode[]
  estimatedPriceImpact: string
  overallSeverity: "critical" | "high" | "medium" | "low"
}

export interface AffectedNode {
  nodeId: string
  nodeName: string
  nodeType: "subsystem" | "component" | "material"
  country: string
  concentrationPct: number
  currentRisk: number
  predictedRisk: number
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
