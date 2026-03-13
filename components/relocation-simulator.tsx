"use client"

import { useState } from "react"
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Download,
  Shield,
  X,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ImpactTimeline } from "@/components/impact-timeline"
import { cn } from "@/lib/utils"
import type { RelocationSimulation } from "@/lib/relocation-types"

interface RelocationSimulatorProps {
  isOpen: boolean
  onClose: () => void
  currentCountryId: string
  targetCountryId: string
  industryType: string
  countryName?: (id: string) => string
  className?: string
}

export function RelocationSimulator({
  isOpen,
  onClose,
  currentCountryId,
  targetCountryId,
  industryType,
  countryName,
  className,
}: RelocationSimulatorProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [simulation, setSimulation] = useState<RelocationSimulation | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runSimulation = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/relocation/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentCountryId,
          targetCountryId,
          industryType,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()
      setSimulation(data)
    } catch (err) {
      console.error("Simulation error:", err)
      setError(err instanceof Error ? err.message : "Simulation failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = () => {
    if (!simulation) return

    const report = `
Relocation Impact Report
========================

Current Location: ${simulation.current.country}
Target Location: ${simulation.proposed.country}

Risk Analysis
-------------
Current Risk: ${simulation.current.overallRisk}%
Proposed Risk: ${simulation.proposed.overallRisk}%
Risk Reduction: ${simulation.impact.riskReduction}

Cost & Timeline
---------------
Estimated Cost: ${simulation.impact.estimatedCost}
Timeline: ${simulation.impact.timeline}

Avoided Chokepoints
-------------------
${simulation.impact.avoidedChokepoints.join("\n") || "None"}

Recommendations
---------------
${simulation.impact.recommendations.join("\n")}
    `.trim()

    const blob = new Blob([report], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relocation-report-${simulation.current.country}-to-${simulation.proposed.country}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const getRiskLevel = (risk: number) => {
    if (risk >= 70) return { label: "High", color: "text-red-400" }
    if (risk >= 40) return { label: "Medium", color: "text-yellow-400" }
    return { label: "Low", color: "text-emerald-400" }
  }

  return (
    <div className="absolute right-4 top-16 z-20 w-[440px] animate-in slide-in-from-right-4 duration-300">
      <Card className={cn("max-h-[calc(100vh-8rem)] overflow-hidden border-primary/20 glass-panel shadow-2xl floating-panel", className)}>
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <Shield className="h-5 w-5 text-primary" />
                Relocation Simulator
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Impact analysis for {countryName?.(currentCountryId) || currentCountryId} → {countryName?.(targetCountryId) || targetCountryId}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-muted/50 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
          {/* Error State */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400 mb-4">
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={runSimulation}
                className="ml-2 h-auto p-0 text-red-400 underline cursor-pointer"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Initial State - Run Simulation Button */}
          {!simulation && !isLoading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground mb-4">
                Ready to analyze relocation impact
              </p>
              <Button onClick={runSimulation} className="gap-2 sleek-button glow-primary cursor-pointer">
                <TrendingDown className="h-4 w-4" />
                Run Impact Simulation
              </Button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin" />
                <Shield className="absolute inset-0 m-auto h-5 w-5 text-primary" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">Running simulation...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Analyzing risks, costs, and timeline
              </p>
            </div>
          )}

          {/* Simulation Results */}
          {simulation && !isLoading && (
            <div className="space-y-4 animate-fade-in">
              {/* Before/After Risk Comparison */}
              <div className="grid grid-cols-2 gap-3">
                {/* Current */}
                <div className="rounded-xl border border-border/30 bg-card/30 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={cn("h-4 w-4", getRiskLevel(simulation.current.overallRisk).color)} />
                    <span className="text-xs text-muted-foreground">Current</span>
                  </div>
                  <p className="text-base font-bold mb-1">{simulation.current.country}</p>
                  <div className="flex items-center gap-2">
                    <Progress value={simulation.current.overallRisk} className="h-1.5 flex-1" />
                    <span className={cn("text-xs font-medium", getRiskLevel(simulation.current.overallRisk).color)}>
                      {simulation.current.overallRisk}%
                    </span>
                  </div>
                </div>

                {/* Proposed */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                    <span className="text-xs text-muted-foreground">Proposed</span>
                  </div>
                  <p className="text-base font-bold mb-1">{simulation.proposed.country}</p>
                  <div className="flex items-center gap-2">
                    <Progress value={simulation.proposed.overallRisk} className="h-1.5 flex-1 [&>div]:bg-emerald-500" />
                    <span className={cn("text-xs font-medium", getRiskLevel(simulation.proposed.overallRisk).color)}>
                      {simulation.proposed.overallRisk}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Risk Reduction Banner */}
              <div className={cn(
                "flex items-center justify-center gap-2 py-2.5 rounded-xl",
                "bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-emerald-500/20 border border-emerald-500/30"
              )}>
                <TrendingDown className="h-5 w-5 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">
                  {simulation.impact.riskReduction}
                </span>
              </div>

              {/* Cost & Timeline */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/30 bg-card/30 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Estimated Cost</span>
                  </div>
                  <p className="text-sm font-medium">{simulation.impact.estimatedCost}</p>
                </div>
                <div className="rounded-xl border border-border/30 bg-card/30 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Timeline</span>
                  </div>
                  <p className="text-sm font-medium">{simulation.impact.timeline}</p>
                </div>
              </div>

              {/* Avoided Chokepoints */}
              {simulation.impact.avoidedChokepoints.length > 0 && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                  <p className="text-xs font-medium text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Avoided High-Risk Chokepoints
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {simulation.impact.avoidedChokepoints.map((cp) => (
                      <span
                        key={cp}
                        className="px-2.5 py-1 text-xs rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 font-medium"
                      >
                        {cp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Recommendations */}
              {simulation.impact.recommendations.length > 0 && (
                <div className="rounded-xl border border-border/30 bg-card/20 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    AI Recommendations
                  </p>
                  <ul className="space-y-2">
                    {simulation.impact.recommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-2">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export Button */}
              <Button
                variant="outline"
                className="w-full gap-2 sleek-button cursor-pointer"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
