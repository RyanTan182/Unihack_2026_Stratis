"use client"

import { useState } from "react"
import {
  Factory,
  Sparkles,
  ArrowLeft,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
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

interface RelocationSectionProps {
  countryRisks: CountryRisk[]
  onCountrySelect?: (countryId: string) => void
}

export function RelocationSection({
  countryRisks,
  onCountrySelect,
}: RelocationSectionProps) {
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

  return (
    <div className="space-y-3">
      {/* Error State */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
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
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
            <Factory className="absolute inset-0 m-auto h-4 w-4 text-primary" />
          </div>
          <p className="mt-3 text-xs font-medium text-foreground">Analyzing options...</p>
        </div>
      )}

      {/* Comparison View */}
      {showComparison && comparisonCountries.length > 0 && !isLoading && (
        <div className="space-y-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackFromComparison}
            className="gap-1 text-muted-foreground hover:text-foreground h-7 text-xs"
          >
            <ArrowLeft className="h-3 w-3" />
            Back
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
            <div className="mt-3">
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

      {/* Relocation Simulator - appears as separate overlay */}
      <RelocationSimulator
        isOpen={showSimulator}
        onClose={handleCloseSimulator}
        currentCountryId={currentCountryId}
        targetCountryId={simulatorTargetId}
        industryType={industryType}
        countryName={getCountryName}
      />
    </div>
  )
}
