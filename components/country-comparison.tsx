"use client"

import { useState } from "react"
import { Trophy, ArrowRight, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ComparisonChart } from "@/components/comparison-chart"
import { cn } from "@/lib/utils"
import type { CountryComparisonData } from "@/lib/relocation-types"

interface CountryComparisonProps {
  countries: CountryComparisonData[]
  winner: {
    overall: string
    geopolitical: string
    export: string
    cost: string
  }
  onClose?: () => void
  onSelectCountry?: (countryId: string) => void
  className?: string
}

const METRIC_CONFIG = {
  overall: { label: "Overall Score", icon: Trophy },
  geopolitical: { label: "Geopolitical Safety", icon: null },
  export: { label: "Export Stability", icon: null },
  infrastructure: { label: "Infrastructure", icon: null },
  cost: { label: "Cost Efficiency", icon: null },
}

const MARKET_ACCESS_COLORS = {
  excellent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  good: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  moderate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  limited: "bg-red-500/15 text-red-400 border-red-500/30",
}

export function CountryComparison({
  countries,
  winner,
  onClose,
  onSelectCountry,
  className,
}: CountryComparisonProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  if (countries.length === 0) {
    return null
  }

  // Get all metric keys from the first country
  const metricKeys = Object.keys(countries[0].scores) as (keyof typeof METRIC_CONFIG)[]

  // Find the best value for each metric
  const getBestValue = (metric: keyof typeof METRIC_CONFIG): number => {
    return Math.max(...countries.map((c) => c.scores[metric]))
  }

  // Check if a country is the winner for a metric
  const isWinner = (country: CountryComparisonData, metric: keyof typeof METRIC_CONFIG): boolean => {
    return country.name === winner[metric as keyof typeof winner] || country.scores[metric] === getBestValue(metric)
  }

  const handleSelectCountry = (countryId: string) => {
    setSelectedCountry(countryId)
    onSelectCountry?.(countryId)
  }

  return (
    <Card className={cn("border-primary/20 glass-panel shadow-xl floating-panel", className)}>
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-5 w-5 text-primary" />
              Country Comparison
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Compare {countries.length} candidate countries side-by-side
            </p>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 hover:bg-muted/50 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {/* Radar Chart */}
        <ComparisonChart countries={countries} />

        {/* Metric Comparison Table */}
        <div className="rounded-xl border border-border/30 overflow-hidden bg-card/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/20">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground text-xs uppercase tracking-wider">
                  Metric
                </th>
                {countries.map((country) => (
                  <th
                    key={country.countryId}
                    className="px-3 py-2.5 text-center font-medium"
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      {country.flag} {country.name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metricKeys.map((metric) => {
                const config = METRIC_CONFIG[metric]
                return (
                  <tr key={metric} className="border-t border-border/20">
                    <td className="px-3 py-2 text-muted-foreground text-xs">
                      {config.label}
                    </td>
                    {countries.map((country) => {
                      const isMetricWinner = isWinner(country, metric)
                      const score = country.scores[metric]
                      return (
                        <td
                          key={country.countryId}
                          className={cn(
                            "px-3 py-2 text-center font-medium",
                            isMetricWinner && "text-primary"
                          )}
                        >
                          <span className="flex items-center justify-center gap-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded-md",
                              isMetricWinner && "bg-primary/10"
                            )}>
                              {score}
                            </span>
                            {isMetricWinner && (
                              <Trophy className="h-3.5 w-3.5 text-amber-400" />
                            )}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Market Access & Trade Agreements */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            Market Access & Trade Agreements
          </h4>
          <div className="grid gap-2.5">
            {countries.map((country) => (
              <div
                key={country.countryId}
                className={cn(
                  "p-3 rounded-xl border transition-all duration-200 hover-lift cursor-pointer",
                  selectedCountry === country.countryId
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                    : "border-border/30 bg-card/30 hover:border-primary/30 hover:bg-card/50"
                )}
                onClick={() => handleSelectCountry(country.countryId)}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="font-medium flex items-center gap-2 text-sm">
                    {country.flag} {country.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 text-muted-foreground">
                    Labor Index: {country.laborCostIndex}
                  </span>
                </div>

                {/* Market Access Badges */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {country.targetMarketAccess.eu !== 'limited' && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded-full border font-medium",
                        MARKET_ACCESS_COLORS[country.targetMarketAccess.eu]
                      )}
                    >
                      EU: {country.targetMarketAccess.eu}
                    </span>
                  )}
                  {country.targetMarketAccess.us !== 'limited' && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded-full border font-medium",
                        MARKET_ACCESS_COLORS[country.targetMarketAccess.us]
                      )}
                    >
                      US: {country.targetMarketAccess.us}
                    </span>
                  )}
                  {country.targetMarketAccess.asia !== 'limited' && (
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded-full border font-medium",
                        MARKET_ACCESS_COLORS[country.targetMarketAccess.asia]
                      )}
                    >
                      Asia: {country.targetMarketAccess.asia}
                    </span>
                  )}
                </div>

                {/* Trade Agreements */}
                {country.tradeAgreements.length > 0 && (
                  <div className="text-[10px] text-muted-foreground mb-2">
                    <span className="font-medium text-foreground">Trade:</span>{" "}
                    {country.tradeAgreements.slice(0, 3).join(", ")}
                    {country.tradeAgreements.length > 3 && (
                      <span className="text-primary"> +{country.tradeAgreements.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Infrastructure & Select Button */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Infrastructure: <span className="capitalize font-medium text-foreground">{country.infrastructureRating}</span>
                  </span>
                  <Button
                    size="sm"
                    variant={selectedCountry === country.countryId ? "default" : "outline"}
                    className={cn(
                      "h-6 text-[10px] px-2 sleek-button cursor-pointer",
                      selectedCountry === country.countryId && "glow-primary"
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSelectCountry(country.countryId)
                    }}
                  >
                    {selectedCountry === country.countryId ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Selected
                      </>
                    ) : (
                      <>
                        Select
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {selectedCountry && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <p className="text-sm text-center">
              <span className="font-semibold text-primary">
                {countries.find((c) => c.countryId === selectedCountry)?.flag}{" "}
                {countries.find((c) => c.countryId === selectedCountry)?.name}
              </span>{" "}
              selected as relocation target
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
