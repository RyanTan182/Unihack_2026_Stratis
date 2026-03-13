"use client"

import { useState } from "react"
import {
  MapPin,
  Factory,
  AlertTriangle,
  Target,
  Globe,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type {
  IndustryType,
  RiskConcern,
  Priority,
  TargetMarket,
  RelocationRequest,
} from "@/lib/relocation-types"

interface RelocationFormProps {
  onSubmit: (request: RelocationRequest) => void
  isLoading: boolean
  countryOptions: { id: string; name: string; overallRisk: number }[]
}

const INDUSTRY_OPTIONS: { value: IndustryType; label: string }[] = [
  { value: "electronics", label: "Electronics" },
  { value: "textiles", label: "Textiles & Apparel" },
  { value: "automotive", label: "Automotive" },
  { value: "food", label: "Food & Beverage" },
  { value: "pharmaceuticals", label: "Pharmaceuticals" },
  { value: "general", label: "General Manufacturing" },
]

const RISK_CONCERN_OPTIONS: { value: RiskConcern; label: string; icon: React.ReactNode }[] = [
  { value: "geopolitical", label: "Geopolitical Risk", icon: <AlertTriangle className="h-3 w-3" /> },
  { value: "natural_disaster", label: "Natural Disasters", icon: <AlertTriangle className="h-3 w-3" /> },
  { value: "trade_barriers", label: "Trade Barriers", icon: <AlertTriangle className="h-3 w-3" /> },
  { value: "labor", label: "Labor Issues", icon: <AlertTriangle className="h-3 w-3" /> },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "cost", label: "Cost Efficiency" },
  { value: "stability", label: "Political Stability" },
  { value: "infrastructure", label: "Infrastructure Quality" },
  { value: "market_access", label: "Market Access" },
]

const TARGET_MARKET_OPTIONS: { value: TargetMarket; label: string }[] = [
  { value: "EU", label: "European Union" },
  { value: "US", label: "United States" },
  { value: "Asia", label: "Asia-Pacific" },
  { value: "Global", label: "Global Markets" },
]

const getRiskLevel = (score: number) => {
  if (score >= 80) return { label: "Critical", color: "text-red-400" }
  if (score >= 60) return { label: "High", color: "text-orange-400" }
  if (score >= 40) return { label: "Medium", color: "text-yellow-400" }
  if (score >= 20) return { label: "Low", color: "text-emerald-400" }
  return { label: "Minimal", color: "text-cyan-400" }
}

export function RelocationForm({ onSubmit, isLoading, countryOptions }: RelocationFormProps) {
  const [currentCountry, setCurrentCountry] = useState<string>("")
  const [industryType, setIndustryType] = useState<IndustryType>("general")
  const [riskConcerns, setRiskConcerns] = useState<RiskConcern[]>(["geopolitical"])
  const [priorities, setPriorities] = useState<Priority[]>(["stability"])
  const [targetMarkets, setTargetMarkets] = useState<TargetMarket[]>(["EU"])

  const toggleRiskConcern = (concern: RiskConcern) => {
    setRiskConcerns(prev =>
      prev.includes(concern)
        ? prev.filter(c => c !== concern)
        : [...prev, concern]
    )
  }

  const togglePriority = (priority: Priority) => {
    setPriorities(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    )
  }

  const toggleTargetMarket = (market: TargetMarket) => {
    setTargetMarkets(prev =>
      prev.includes(market)
        ? prev.filter(m => m !== market)
        : [...prev, market]
    )
  }

  const handleSubmit = () => {
    if (!currentCountry || targetMarkets.length === 0) return

    onSubmit({
      currentCountry,
      industryType,
      riskConcerns,
      priorities,
      targetMarkets,
    })
  }

  const isValid = currentCountry && targetMarkets.length > 0

  return (
    <Card className="border-primary/20 glass-panel shadow-xl">
      <CardHeader className="pb-3 border-b border-border/50">
        <CardTitle className="flex items-center gap-2.5 text-base">
          <Factory className="h-5 w-5 text-primary" />
          Relocation Advisor
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Find safe countries for your factory relocation
        </p>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        {/* Current Country */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-primary" />
            Current Factory Location
          </label>
          <Select value={currentCountry} onValueChange={setCurrentCountry}>
            <SelectTrigger className="w-full border-border/50 bg-muted/30">
              <SelectValue placeholder="Select current country..." />
            </SelectTrigger>
            <SelectContent className="glass-panel border-primary/20">
              {countryOptions
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{country.name}</span>
                      <span className={cn("text-xs font-medium", getRiskLevel(country.overallRisk).color)}>
                        {country.overallRisk}%
                      </span>
                    </div>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Industry Type */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Factory className="h-3 w-3 text-primary" />
            Industry Type
          </label>
          <Select value={industryType} onValueChange={(v) => setIndustryType(v as IndustryType)}>
            <SelectTrigger className="w-full border-border/50 bg-muted/30">
              <SelectValue placeholder="Select industry..." />
            </SelectTrigger>
            <SelectContent className="glass-panel border-primary/20">
              {INDUSTRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Target Markets */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-primary" />
            Target Markets
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TARGET_MARKET_OPTIONS.map((market) => (
              <button
                key={market.value}
                onClick={() => toggleTargetMarket(market.value)}
                className={cn(
                  "chip-button cursor-pointer",
                  targetMarkets.includes(market.value) && "active"
                )}
              >
                {market.label}
              </button>
            ))}
          </div>
          {targetMarkets.length === 0 && (
            <p className="text-[10px] text-red-400">At least one target market required</p>
          )}
        </div>

        {/* Risk Concerns */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-primary" />
            Risk Concerns
          </label>
          <div className="flex flex-wrap gap-1.5">
            {RISK_CONCERN_OPTIONS.map((concern) => (
              <button
                key={concern.value}
                onClick={() => toggleRiskConcern(concern.value)}
                className={cn(
                  "chip-button cursor-pointer flex items-center gap-1.5",
                  riskConcerns.includes(concern.value) && "active"
                )}
              >
                {concern.icon}
                {concern.label}
              </button>
            ))}
          </div>
        </div>

        {/* Priorities */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Target className="h-3 w-3 text-primary" />
            Priorities
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRIORITY_OPTIONS.map((priority) => (
              <button
                key={priority.value}
                onClick={() => togglePriority(priority.value)}
                className={cn(
                  "chip-button cursor-pointer",
                  priorities.includes(priority.value) && "active"
                )}
              >
                {priority.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="w-full gap-2 font-medium"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Target className="h-4 w-4" />
              Get Recommendations
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
