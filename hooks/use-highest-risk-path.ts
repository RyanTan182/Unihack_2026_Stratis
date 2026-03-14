// hooks/use-highest-risk-path.ts
import { useState, useCallback } from "react"
import type { StoredProduct, DecompositionTree, SupplyChainNode } from "@/lib/decompose/types"
import type { CountryRisk } from "@/components/supply-chain-map"

/**
 * Extracts all unique countries and chokepoints from stored products' supply chain trees
 */
function extractCountriesFromStoredProducts(
  storedProducts: StoredProduct[]
): Map<string, { type: "country" | "chokepoint"; connections: Set<string> }> {
  const countriesMap = new Map<string, { type: "country" | "chokepoint"; connections: Set<string> }>()

  storedProducts.forEach((product) => {
    if (!product.tree) return

    Object.values(product.tree.nodes).forEach((node: SupplyChainNode) => {
      // Extract countries from geographic concentration
      if (node.geographic_concentration && typeof node.geographic_concentration === "object") {
        Object.keys(node.geographic_concentration).forEach((country) => {
          if (!countriesMap.has(country)) {
            countriesMap.set(country, {
              type: "country",
              connections: new Set(),
            })
          }
        })
      }

      // Add chokepoints based on risk factors mentioning straits/canals
      if (node.risk_factors && node.risk_factors.length > 0) {
        const chokepointPatterns = [
          "strait",
          "canal",
          "chokepoint",
          "passage",
          "bottleneck",
        ]
        const mentionsChokepoint = node.risk_factors.some((factor) =>
          chokepointPatterns.some((pattern) =>
            factor.toLowerCase().includes(pattern)
          )
        )

        if (mentionsChokepoint && node.name) {
          if (!countriesMap.has(node.name)) {
            countriesMap.set(node.name, {
              type: "chokepoint",
              connections: new Set(),
            })
          }
        }
      }
    })
  })

  return countriesMap
}

/**
 * Builds connections between countries based on node relationships
 */
function buildConnections(
  storedProducts: StoredProduct[],
  countriesMap: Map<string, { type: "country" | "chokepoint"; connections: Set<string> }>
) {
  storedProducts.forEach((product) => {
    if (!product.tree) return

    Object.values(product.tree.nodes).forEach((node: SupplyChainNode) => {
      // For each child, connect current node to child
      if (node.children && node.children.length > 0) {
        node.children.forEach((childId) => {
          const childNode = product.tree!.nodes[childId]
          if (!childNode) return

          // Get countries from both nodes
          const currentCountries = node.geographic_concentration
            ? Object.keys(node.geographic_concentration)
            : [node.name]
          const childCountries = childNode.geographic_concentration
            ? Object.keys(childNode.geographic_concentration)
            : [childNode.name]

          // Create connections
          currentCountries.forEach((country) => {
            if (countriesMap.has(country)) {
              childCountries.forEach((childCountry) => {
                countriesMap.get(country)?.connections.add(childCountry)
              })
            }
          })
        })
      }
    })
  })
}

interface HighestRiskPathData {
  path: string[]
  pathDetails: Array<{ id: string; name: string; type: string; overallRisk: number }>
  maxRisk: number
  chokepoints: string[]
  pathLength: number
}

export function useHighestRiskPath() {
  const [pathData, setPathData] = useState<HighestRiskPathData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchHighestRiskPath = useCallback(
    async (storedProducts: StoredProduct[], countryRisks: CountryRisk[]) => {
      try {
        setIsLoading(true)
        setError(null)

        // Extract countries from stored products
        const countriesMap = extractCountriesFromStoredProducts(storedProducts)
        buildConnections(storedProducts, countriesMap)
        console.log("🏢 Countries extracted from stored products:", Array.from(countriesMap.keys()))

        // Build CountryRisk array with connections from extracted data
        const enrichedCountryRisks: CountryRisk[] = countryRisks.map((risk) => {
          const extracted = countriesMap.get(risk.name)
          return {
            ...risk,
            connections: extracted?.connections ? Array.from(extracted.connections) : risk.connections,
          }
        })

        // Filter to include:
        // 1. Countries that were extracted from products
        // 2. ALL chokepoints (regardless of extraction) since they're hardcoded in the graph
        const relevantRisks = enrichedCountryRisks.filter(
          (risk) => risk.type === "chokepoint" || countriesMap.has(risk.name) || countriesMap.has(risk.id)
        )
        console.log("📊 Relevant risks for API (countries + chokepoints):", relevantRisks.length, relevantRisks.map(r => ({ id: r.id, type: r.type })))

        if (relevantRisks.length === 0) {
          setError("No supply chain countries found")
          return
        }

        // Call the highest-path API
        const response = await fetch("/api/risk-evaluate/highest-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ countryRisks: relevantRisks }),
        })

        if (!response.ok) {
          throw new Error("Failed to fetch highest risk path")
        }

        const data = await response.json()
        if (data.success && data.highestRiskPath) {
          setPathData(data.highestRiskPath)
        } else {
          setError(data.error || "Unknown error")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error occurred")
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    pathData,
    isLoading,
    error,
    fetchHighestRiskPath,
  }
}
