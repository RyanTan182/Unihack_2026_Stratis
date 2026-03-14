"use client"

import { useState } from "react"
import {
  X,
  Factory,
  Sparkles,
  ArrowLeft,
  Play,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { RelocationForm } from "@/components/relocation-form"
import { RelocationResults } from "@/components/relocation-results"
import { CountryComparison } from "@/components/country-comparison"
import { RelocationSimulator } from "@/components/relocation-simulator"
import type { RelocationRequest, RelocationRecommendation, CountryComparisonData, IndustryType } from "@/lib/relocation-types"

interface CountryRisk {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

interface RelocationPanelProps {
  isOpen: boolean
  onClose: () => void
  countryRisks: CountryRisk[]
  onCountrySelect?: (countryId: string) => void
}

export function RelocationPanel({
  isOpen,
  onClose,
  countryRisks,
  onCountrySelect,
}: RelocationPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<RelocationRecommendation[]>([])
  const [currentCountry, setCurrentCountry] = useState<{ name: string; risk: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showComparison, setShowComparison] = useState(false)
  const [comparisonCountries, setComparisonCountries] = useState<CountryComparisonData[]>([])
  const [comparisonWinner, setComparisonWinner] = useState<{
    overall: string
    geopolitical: string
    export: string
    cost: string
  }>({ overall: "", geopolitical: "", export: "", cost: "" })
  const [targetMarkets, setTargetMarkets] = useState<string[]>(['EU', 'US', 'Asia'])

  // Simulator state
  const [showSimulator, setShowSimulator] = useState(false)
  const [simulatorTargetId, setSimulatorTargetId] = useState<string>("")
  const [currentCountryId, setCurrentCountryId] = useState<string>("")
  const [industryType, setIndustryType] = useState<IndustryType>("general")

  // Filter to only country types for the form options
  const countryOptions = countryRisks
    .filter(c => c.type === "country")
    .map(c => ({
      id: c.id,
      name: c.name,
      overallRisk: c.overallRisk,
    }))

  const getCountryName = (id: string) => {
    return countryRisks.find(c => c.id === id)?.name || id
  }

  const handleSubmit = async (request: RelocationRequest) => {
    setIsLoading(true)
    setError(null)
    setRecommendations([])
    setCurrentCountry(null)
    setShowComparison(false)
    setTargetMarkets(request.targetMarkets)
    setCurrentCountryId(request.currentCountry)
    setIndustryType(request.industryType)

    try {
      const response = await fetch("/api/relocation/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      setRecommendations(data.recommendations || [])
      setCurrentCountry({
        name: data.currentCountry?.name || request.currentCountry,
        risk: data.currentCountry?.overallRisk || 0,
      })
    } catch (err) {
      console.error("Relocation analysis error:", err)
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectTarget = (countryId: string) => {
    setSimulatorTargetId(countryId)
    setShowSimulator(true)
    onCountrySelect?.(countryId)
  }

  const handleRunSimulation = (countryId: string) => {
    setSimulatorTargetId(countryId)
    setShowSimulator(true)
  }

  const handleCompare = async (countryIds: string[]) => {
    setIsLoading(true)
    setShowComparison(false)

    try {
      const response = await fetch("/api/relocation/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          countryIds,
          targetMarkets,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()
      setComparisonCountries(data.countries || [])
      setComparisonWinner(data.winner || { overall: "", geopolitical: "", export: "", cost: "" })
      setShowComparison(true)
    } catch (err) {
      console.error("Comparison error:", err)
      setError(err instanceof Error ? err.message : "Comparison failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setRecommendations([])
    setCurrentCountry(null)
    setError(null)
    setShowComparison(false)
    setComparisonCountries([])
    setShowSimulator(false)
    setSimulatorTargetId("")
  }

  const handleBackFromComparison = () => {
    setShowComparison(false)
    setComparisonCountries([])
  }

  const handleCloseSimulator = () => {
    setShowSimulator(false)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Main Panel */}
      <div className="absolute right-4 top-16 z-20 w-[420px] animate-in slide-in-from-right-4 duration-300">
      <Card className="max-h-[calc(100vh-8rem)] overflow-hidden border-primary/20 glass-panel shadow-2xl">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2.5 text-base">
                <Factory className="h-5 w-5 text-primary" />
                Relocation Advisor
              </CardTitle>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                AI-powered factory relocation recommendations
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-muted/50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
          {/* Show form when no results, or show both */}
          <div className="p-4 space-y-4">
            {/* Error State */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="ml-2 h-auto p-0 text-red-400 underline"
                >
                  Try again
                </Button>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <Factory className="absolute inset-0 m-auto h-5 w-5 text-primary" />
                </div>
                <p className="mt-4 text-sm font-medium text-foreground">Analyzing relocation options...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI is evaluating risk factors and trade agreements
                </p>
              </div>
            )}

            {/* Comparison View */}
            {showComparison && comparisonCountries.length > 0 && !isLoading && (
              <div className="space-y-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackFromComparison}
                  className="gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to recommendations
                </Button>
                <CountryComparison
                  countries={comparisonCountries}
                  winner={comparisonWinner}
                  onSelectCountry={handleSelectTarget}
                />
              </div>
            )}

            {/* Show form if not loading and not in comparison mode */}
            {!isLoading && !showComparison && (
              <>
                {/* Form */}
                <RelocationForm
                  onSubmit={handleSubmit}
                  isLoading={isLoading}
                  countryOptions={countryOptions}
                />

                {/* Results */}
                {recommendations.length > 0 && currentCountry && (
                  <div className="mt-4">
                    <RelocationResults
                      recommendations={recommendations}
                      currentCountryName={currentCountry.name}
                      currentCountryRisk={currentCountry.risk}
                      onCountrySelect={onCountrySelect}
                      onCompare={handleCompare}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Card>
    </div>

      {/* Relocation Simulator - appears as separate overlay */}
      <RelocationSimulator
        isOpen={showSimulator}
        onClose={handleCloseSimulator}
        currentCountryId={currentCountryId}
        targetCountryId={simulatorTargetId}
        industryType={industryType}
        countryName={getCountryName}
      />
    </>
  )
}
