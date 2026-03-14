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
