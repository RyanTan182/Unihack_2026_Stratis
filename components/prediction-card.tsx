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
import type { PredictionResult, RiskDirection, ProductImpact } from "@/lib/mirofish/types"
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
  productImpacts?: ProductImpact[]
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

function severityColor(severity: ProductImpact["overallSeverity"]) {
  switch (severity) {
    case "critical":
      return "text-red-400 border-red-400/50 bg-red-400/10"
    case "high":
      return "text-orange-400 border-orange-400/50 bg-orange-400/10"
    case "medium":
      return "text-yellow-400 border-yellow-400/50 bg-yellow-400/10"
    default:
      return "text-muted-foreground border-border/50 bg-muted/30"
  }
}

function SupplyChainImpactSection({ impacts }: { impacts: ProductImpact[] }) {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  if (impacts.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-medium mb-2 text-muted-foreground">Supply Chain Impact</h4>
        <p className="text-xs text-muted-foreground/70 italic">
          Add products to inventory to see supply chain impact
        </p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="text-xs font-medium mb-2 text-muted-foreground">Supply Chain Impact</h4>
      <div className="space-y-1.5">
        {impacts.map((impact) => (
          <div key={impact.productId} className="rounded-md border border-border/50 bg-background/50">
            <button
              className="flex items-center justify-between w-full px-2.5 py-1.5 text-left"
              onClick={() =>
                setExpandedProduct(expandedProduct === impact.productId ? null : impact.productId)
              }
            >
              <span className="text-xs font-medium truncate">{impact.productName}</span>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <Badge
                  variant="outline"
                  className={cn("text-[10px] px-1.5 py-0", severityColor(impact.overallSeverity))}
                >
                  {impact.overallSeverity}
                </Badge>
                <span className="text-xs font-mono text-red-400">{impact.estimatedPriceImpact}</span>
                {expandedProduct === impact.productId ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </button>

            {expandedProduct === impact.productId && (
              <div className="px-2.5 pb-2 space-y-1 border-t border-border/30">
                {impact.affectedNodes.map((node) => (
                  <div
                    key={`${node.nodeId}-${node.country}`}
                    className="flex items-center justify-between text-[11px] py-0.5"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="text-muted-foreground">{node.nodeType}</span>
                      <span className="truncate">{node.nodeName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2 text-muted-foreground">
                      <span>{node.country} ({node.concentrationPct}%)</span>
                      <span className={node.predictedRisk > node.currentRisk ? "text-red-400" : "text-green-400"}>
                        {node.currentRisk}→{node.predictedRisk}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function PredictionCard({ result, productImpacts }: PredictionCardProps) {
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

          {/* Supply Chain Impact */}
          <SupplyChainImpactSection impacts={productImpacts || []} />

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
