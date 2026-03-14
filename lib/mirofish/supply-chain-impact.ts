// lib/mirofish/supply-chain-impact.ts

import type { PredictionResult, ProductImpact, AffectedNode } from "./types"
import type { StoredProduct, SupplyChainNode } from "@/lib/decompose/types"
import type { CountryRiskEvaluation } from "@/app/lib/risk-client"

export function computeProductImpacts(
  result: PredictionResult,
  storedProducts: StoredProduct[],
  riskSnapshots: Record<string, CountryRiskEvaluation>
): ProductImpact[] {
  const affectedCountries = new Map(
    result.prediction.affectedCountries.map((c) => [c.country.toLowerCase(), c])
  )

  if (affectedCountries.size === 0) return []

  const impacts: ProductImpact[] = []

  for (const product of storedProducts) {
    const affectedNodes: AffectedNode[] = []

    for (const [nodeId, node] of Object.entries(product.tree.nodes)) {
      if (node.type === "product" || node.type === "geography") continue

      for (const [country, pct] of Object.entries(node.geographic_concentration)) {
        const match = affectedCountries.get(country.toLowerCase())
        if (!match) continue

        const currentRisk = riskSnapshots[country]?.overallRisk ?? match.currentRisk
        affectedNodes.push({
          nodeId,
          nodeName: node.name,
          nodeType: node.type as AffectedNode["nodeType"],
          country,
          concentrationPct: pct,
          currentRisk,
          predictedRisk: match.predictedRisk,
        })
      }
    }

    if (affectedNodes.length === 0) continue

    // Calculate estimated price impact: weighted sum of concentration * risk delta
    let totalImpact = 0
    for (const node of affectedNodes) {
      const riskDelta = node.predictedRisk - node.currentRisk
      totalImpact += (node.concentrationPct / 100) * (riskDelta / 100)
    }
    const pctImpact = Math.round(totalImpact * 100)
    const estimatedPriceImpact = pctImpact >= 0 ? `+${pctImpact}%` : `${pctImpact}%`

    // Determine severity from max risk delta * concentration
    const maxSeverity = Math.max(
      ...affectedNodes.map((n) => {
        const delta = n.predictedRisk - n.currentRisk
        return delta * (n.concentrationPct / 100)
      })
    )

    const overallSeverity: ProductImpact["overallSeverity"] =
      maxSeverity > 15 ? "critical" : maxSeverity > 8 ? "high" : maxSeverity > 3 ? "medium" : "low"

    impacts.push({
      productId: product.id,
      productName: product.name,
      affectedNodes,
      estimatedPriceImpact,
      overallSeverity,
    })
  }

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  impacts.sort((a, b) => severityOrder[a.overallSeverity] - severityOrder[b.overallSeverity])

  return impacts
}
