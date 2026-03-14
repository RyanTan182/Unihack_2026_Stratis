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
