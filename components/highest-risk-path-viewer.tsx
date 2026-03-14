// components/highest-risk-path-viewer.tsx
"use client"

import { useState } from "react"
import { AlertTriangle, Zap, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CountryRisk } from "@/components/supply-chain-map"

interface HighestRiskPathViewerProps {
  countryRisks: CountryRisk[]
  isOpen: boolean
  onClose: () => void
  pathData?: {
    path: string[]
    pathDetails: Array<{ id: string; name: string; type: string; overallRisk: number }>
    maxRisk: number
    chokepoints: string[]
    pathLength: number
  } | null
  isLoading?: boolean
}

export function HighestRiskPathViewer({
  countryRisks,
  isOpen,
  onClose,
  pathData,
  isLoading = false,
}: HighestRiskPathViewerProps) {
  if (!isOpen) return null

  const getRiskColor = (risk: number) => {
    if (risk >= 80) return "bg-red-500/20 text-red-400"
    if (risk >= 60) return "bg-orange-500/20 text-orange-400"
    if (risk >= 40) return "bg-yellow-500/20 text-yellow-400"
    return "bg-blue-500/20 text-blue-400"
  }

  return (
    <div className="absolute top-4 right-4 z-20 w-96 animate-in slide-in-from-right">
      <Card className="glass-panel border-primary/20 shadow-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/30">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-orange-400" />
                Highest Risk Path
              </CardTitle>
              <p className="text-xs text-muted-foreground">Critical supply chain node</p>
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

        <CardContent className="space-y-4 pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin">
                <Zap className="h-5 w-5 text-primary" />
              </div>
            </div>
          ) : pathData ? (
            <>
              {/* Max Risk Value */}
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Maximum Risk Score
                </p>
                <p className="text-2xl font-bold text-red-400">{pathData.maxRisk}</p>
              </div>

              {/* Path Visualization */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Critical Path ({pathData.pathLength} nodes)
                </p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {pathData.pathDetails.map((node, idx) => (
                    <div key={node.id} className="flex items-center gap-2">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium text-foreground truncate">
                            {node.name}
                          </span>
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded", getRiskColor(node.overallRisk))}>
                            {node.overallRisk}
                          </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground capitalize">{node.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chokepoints */}
              {pathData.chokepoints.length > 0 && (
                <div className="pt-2 border-t border-border/30">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                    ⚠️ Chokepoints on Path
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {pathData.chokepoints.map((cpId) => {
                      const cpNode = countryRisks.find((r) => r.id === cpId)
                      return (
                        <Badge key={cpId} variant="destructive" className="text-[10px]">
                          {cpNode?.name || cpId}
                        </Badge>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No path data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
