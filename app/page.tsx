"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { UnifiedSidebar } from "@/components/unified-sidebar"
import { SupplyChainMap, type ProductSupplyRoute, type SupplyChainMapRef } from "@/components/supply-chain-map"
import type { ItemType } from "@/components/supply-chain-map"
import type { StoredProduct, DecompositionTree } from "@/lib/decompose/types"
import { syncStoredToProducts } from "@/lib/sync-products"
import { storedProductToMapProduct, type MapProduct } from "@/lib/decompose/to-map-product"
import { PathDetailsPanel } from "@/components/path-details-panel"
import { analyzeSupplyChain } from "@/lib/supply-chain-analyzer"
import type { SupplyChainInsights, ComponentRisk as ComponentRiskData } from "@/lib/supply-chain-analyzer"
import { convertTreeToAnalyzerProducts, extractHighRiskCountries } from "@/lib/product-converter"
import { SupplierRecommendations } from "@/components/supplier-recommendations"
import { RouteSummary } from "@/components/route-summary"
import { AlertBanner, type AlertData } from "@/components/alert-banner"
import { ActionBar } from "@/components/action-bar"
import { ProductSupplyChainRoutesPanel } from "@/components/product-supply-chain-routes-panel"
import { cn } from "@/lib/utils"
import type { FoundRoute, CountryRiskData as RouteCountryRiskData } from "@/lib/route-types"
import { getRouteGraph } from "@/lib/route-graph"
import { CountryRiskEvaluation } from "./lib/risk-client"
import { evaluateAllCountriesInChunks } from "./lib/risk-client"
import type { SupplyChainInsightsData, ComponentRiskForInsights } from "@/components/sidebar-sections/insights-section"

export type AlternativeEntry = { country: string; risk: string; reason: string }

// Type definition for country risks
type CountryRiskType = "country" | "chokepoint"
type CountryRiskData = {
  id: string
  name: string
  type: CountryRiskType
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

// Map chokepoints to their connected countries for risk derivation
const chokeToCountriesMap: Record<string, string[]> = {
  "Suez Canal": ["Egypt", "Greece", "Italy", "France", "Netherlands", "Germany", "Turkey"],
  "Panama Canal": ["United States", "Mexico", "Canada", "Brazil", "Argentina", "Chile", "Peru", "Japan", "South Korea"],
  "Strait of Hormuz": ["Iran", "Saudi Arabia", "United Arab Emirates", "Qatar", "India", "Pakistan"],
  "Strait of Malacca": ["China", "Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam", "India", "Bangladesh", "Taiwan", "Japan", "South Korea", "Philippines", "Australia"],
  "Bab-el-Mandeb": ["Egypt", "Saudi Arabia", "United Arab Emirates", "Yemen", "Djibouti", "Ethiopia", "South Africa", "Nigeria", "India"],
  "Bosphorus": ["Turkey", "Greece", "Romania", "Bulgaria", "Georgia", "Ukraine", "Russia"],
}

// Mock data for country risks with news-based analysis
const countryRisks: CountryRiskData[] = [
  {
    id: "China",
    name: "China",
    type: "country",
    connections: ["Strait of Malacca", "Singapore", "Vietnam", "Japan", "South Korea", "Taiwan"],
    importRisk: 65,
    exportRisk: 75,
    overallRisk: 70,
    newsHighlights: [
      "New tariff regulations affecting electronics exports",
      "Port congestion reported in Shanghai",
      "Labor shortage in manufacturing sector",
    ],
  },
  {
    id: "United States",
    name: "United States",
    type: "country",
    connections: ["Canada", "Mexico", "Panama Canal"],
    importRisk: 25,
    exportRisk: 40,
    overallRisk: 32,
    newsHighlights: [
      "New trade agreement negotiations ongoing",
      "West Coast port operations stabilizing",
    ],
  },
  {
    id: "Germany",
    name: "Germany",
    type: "country",
    connections: ["Netherlands", "France", "Poland", "Suez Canal"],
    importRisk: 20,
    exportRisk: 28,
    overallRisk: 24,
    newsHighlights: ["Strong logistics infrastructure performance"],
  },
  {
    id: "India",
    name: "India",
    type: "country",
    connections: ["Strait of Malacca", "Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Singapore", "Bangladesh", "Pakistan"],
    importRisk: 48,
    exportRisk: 56,
    overallRisk: 52,
    newsHighlights: [
      "Monsoon affecting regional logistics",
      "Textile export growth continues",
    ],
  },
  {
    id: "Vietnam",
    name: "Vietnam",
    type: "country",
    connections: ["China", "Thailand", "Malaysia", "Singapore", "Strait of Malacca"],
    importRisk: 40,
    exportRisk: 48,
    overallRisk: 44,
    newsHighlights: [
      "Manufacturing capacity expanding",
      "Infrastructure improvements underway",
    ],
  },
  {
    id: "Brazil",
    name: "Brazil",
    type: "country",
    connections: ["Argentina", "Chile", "Panama Canal", "Peru"],
    importRisk: 50,
    exportRisk: 60,
    overallRisk: 55,
    newsHighlights: [
      "Currency volatility affecting trade costs",
      "Agricultural exports remain strong",
    ],
  },
  {
    id: "Indonesia",
    name: "Indonesia",
    type: "country",
    connections: ["Malaysia", "Singapore", "Australia", "Strait of Malacca"],
    importRisk: 42,
    exportRisk: 52,
    overallRisk: 47,
    newsHighlights: ["Palm oil export restrictions easing"],
  },
  {
    id: "Japan",
    name: "Japan",
    type: "country",
    connections: ["China", "South Korea", "Taiwan", "Strait of Malacca", "Panama Canal"],
    importRisk: 24,
    exportRisk: 30,
    overallRisk: 27,
    newsHighlights: ["Semiconductor supply chain improvements"],
  },
  {
    id: "South Korea",
    name: "South Korea",
    type: "country",
    connections: ["China", "Japan", "Taiwan", "Strait of Malacca", "Panama Canal"],
    importRisk: 27,
    exportRisk: 33,
    overallRisk: 30,
    newsHighlights: ["Tech exports maintaining stability"],
  },
  {
    id: "Mexico",
    name: "Mexico",
    type: "country",
    connections: ["United States", "Panama Canal"],
    importRisk: 35,
    exportRisk: 45,
    overallRisk: 40,
    newsHighlights: [
      "Near-shoring trend boosting manufacturing",
      "Cross-border logistics improving",
    ],
  },
  {
    id: "Russia",
    name: "Russia",
    type: "country",
    connections: ["Georgia", "Bosphorus", "China", "Iran"],
    importRisk: 85,
    exportRisk: 95,
    overallRisk: 90,
    newsHighlights: [
      "Ongoing sanctions affecting trade routes",
      "Payment system complications",
      "Limited logistics options",
    ],
  },
  {
    id: "Ukraine",
    name: "Ukraine",
    type: "country",
    connections: ["Romania", "Bosphorus", "Poland"],
    importRisk: 90,
    exportRisk: 96,
    overallRisk: 93,
    newsHighlights: [
      "Active conflict zones affecting logistics",
      "Agricultural exports disrupted",
    ],
  },
  {
    id: "Taiwan",
    name: "Taiwan",
    type: "country",
    connections: ["China", "Japan", "South Korea", "Strait of Malacca"],
    importRisk: 55,
    exportRisk: 65,
    overallRisk: 60,
    newsHighlights: [
      "Semiconductor supply critical globally",
      "Geopolitical tensions elevated",
    ],
  },
  {
    id: "Saudi Arabia",
    name: "Saudi Arabia",
    type: "country",
    connections: ["Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Qatar", "Egypt"],
    importRisk: 32,
    exportRisk: 42,
    overallRisk: 37,
    newsHighlights: ["Energy export routes stable"],
  },
  {
    id: "South Africa",
    name: "South Africa",
    type: "country",
    connections: ["Bab-el-Mandeb"],
    importRisk: 45,
    exportRisk: 55,
    overallRisk: 50,
    newsHighlights: [
      "Port operations experiencing delays",
      "Mining sector exports fluctuating",
    ],
  },
  {
    id: "Turkey",
    name: "Turkey",
    type: "country",
    connections: ["Greece", "Bulgaria", "Romania", "Bosphorus", "Suez Canal", "Iran"],
    importRisk: 58,
    exportRisk: 68,
    overallRisk: 63,
    newsHighlights: [
      "Currency instability affecting costs",
      "Strategic position for regional trade",
    ],
  },
  {
    id: "Thailand",
    name: "Thailand",
    type: "country",
    connections: ["Vietnam", "Malaysia", "Singapore", "Strait of Malacca"],
    importRisk: 35,
    exportRisk: 43,
    overallRisk: 39,
    newsHighlights: ["Electronics manufacturing stable"],
  },
  {
    id: "Malaysia",
    name: "Malaysia",
    type: "country",
    connections: ["Thailand", "Vietnam", "Singapore", "Indonesia", "Strait of Malacca"],
    importRisk: 30,
    exportRisk: 38,
    overallRisk: 34,
    newsHighlights: ["Semiconductor supply chain hub"],
  },
  {
    id: "Singapore",
    name: "Singapore",
    type: "country",
    connections: ["Malaysia", "Indonesia", "Vietnam", "Thailand", "India", "Strait of Malacca"],
    importRisk: 15,
    exportRisk: 19,
    overallRisk: 17,
    newsHighlights: ["Premier logistics hub status maintained"],
  },
  {
    id: "Netherlands",
    name: "Netherlands",
    type: "country",
    connections: ["Germany", "France", "United Kingdom", "Suez Canal"],
    importRisk: 19,
    exportRisk: 23,
    overallRisk: 21,
    newsHighlights: ["Rotterdam port efficiency high"],
  },
  {
    id: "United Kingdom",
    name: "United Kingdom",
    type: "country",
    connections: ["Netherlands", "France"],
    importRisk: 30,
    exportRisk: 38,
    overallRisk: 34,
    newsHighlights: ["Post-Brexit trade flows stabilizing"],
  },
  {
    id: "France",
    name: "France",
    type: "country",
    connections: ["Germany", "Netherlands", "United Kingdom", "Spain", "Italy", "Suez Canal"],
    importRisk: 26,
    exportRisk: 32,
    overallRisk: 29,
    newsHighlights: ["Agricultural exports strong"],
  },
  {
    id: "Italy",
    name: "Italy",
    type: "country",
    connections: ["France", "Spain", "Greece", "Suez Canal"],
    importRisk: 30,
    exportRisk: 38,
    overallRisk: 34,
    newsHighlights: ["Manufacturing sector resilient"],
  },
  {
    id: "Spain",
    name: "Spain",
    type: "country",
    connections: ["France", "Italy"],
    importRisk: 28,
    exportRisk: 34,
    overallRisk: 31,
    newsHighlights: ["Mediterranean trade routes stable"],
  },
  {
    id: "Australia",
    name: "Australia",
    type: "country",
    connections: ["Indonesia", "Strait of Malacca"],
    importRisk: 24,
    exportRisk: 30,
    overallRisk: 27,
    newsHighlights: ["Resource exports to Asia strong"],
  },
  {
    id: "Canada",
    name: "Canada",
    type: "country",
    connections: ["United States", "Panama Canal"],
    importRisk: 21,
    exportRisk: 27,
    overallRisk: 24,
    newsHighlights: ["USMCA trade flows steady"],
  },
  {
    id: "Egypt",
    name: "Egypt",
    type: "country",
    connections: ["Suez Canal", "Bab-el-Mandeb", "Saudi Arabia", "Greece"],
    importRisk: 48,
    exportRisk: 58,
    overallRisk: 53,
    newsHighlights: [
      "Suez Canal operations normal",
      "Regional tensions monitoring",
    ],
  },
  {
    id: "Nigeria",
    name: "Nigeria",
    type: "country",
    connections: ["Bab-el-Mandeb"],
    importRisk: 60,
    exportRisk: 70,
    overallRisk: 65,
    newsHighlights: [
      "Oil exports facing logistics challenges",
      "Currency volatility high",
    ],
  },
  {
    id: "Argentina",
    name: "Argentina",
    type: "country",
    connections: ["Brazil", "Chile", "Panama Canal"],
    importRisk: 65,
    exportRisk: 75,
    overallRisk: 70,
    newsHighlights: [
      "Currency restrictions affecting trade",
      "Agricultural exports strong",
    ],
  },
  {
    id: "Chile",
    name: "Chile",
    type: "country",
    connections: ["Peru", "Brazil", "Argentina", "Panama Canal"],
    importRisk: 30,
    exportRisk: 36,
    overallRisk: 33,
    newsHighlights: ["Mining exports stable"],
  },
  {
    id: "Poland",
    name: "Poland",
    type: "country",
    connections: ["Germany", "Ukraine", "Romania"],
    importRisk: 33,
    exportRisk: 41,
    overallRisk: 37,
    newsHighlights: ["Manufacturing hub for Europe"],
  },
  {
    id: "Bangladesh",
    name: "Bangladesh",
    type: "country",
    connections: ["India", "Strait of Malacca"],
    importRisk: 48,
    exportRisk: 58,
    overallRisk: 53,
    newsHighlights: [
      "Textile exports growing",
      "Infrastructure development ongoing",
    ],
  },
  {
    id: "Pakistan",
    name: "Pakistan",
    type: "country",
    connections: ["India", "Iran", "Strait of Hormuz"],
    importRisk: 65,
    exportRisk: 75,
    overallRisk: 70,
    newsHighlights: [
      "Economic instability affecting trade",
      "Textile sector challenges",
    ],
  },
  {
    id: "Philippines",
    name: "Philippines",
    type: "country",
    connections: ["Taiwan", "Japan", "Strait of Malacca"],
    importRisk: 40,
    exportRisk: 48,
    overallRisk: 44,
    newsHighlights: ["Electronics manufacturing growing"],
  },
  {
    id: "Iran",
    name: "Iran",
    type: "country",
    connections: ["Strait of Hormuz", "Pakistan", "Turkey", "Russia"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Sanctions severely limiting trade",
      "Oil exports restricted",
    ],
  },

  // Chokepoints
  {
    id: "Suez Canal",
    name: "Suez Canal",
    type: "chokepoint",
    connections: ["Bab-el-Mandeb", "Egypt", "Greece", "Italy", "France", "Netherlands", "Germany", "Turkey"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Critical Europe-Asia shipping corridor",
      "Any Red Sea disruption can propagate into Mediterranean trade",
      "High dependency for container and energy flows",
    ],
  },
  {
    id: "Panama Canal",
    name: "Panama Canal",
    type: "chokepoint",
    connections: ["Panama", "United States", "Mexico", "Canada", "Brazil", "Argentina", "Chile", "Peru", "Japan", "South Korea"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Key Atlantic-Pacific transit route",
      "Capacity constraints can affect East-West shipping times",
      "Important for container and bulk trade rerouting",
    ],
  },
  {
    id: "Strait of Hormuz",
    name: "Strait of Hormuz",
    type: "chokepoint",
    connections: ["Iran", "Oman", "Saudi Arabia", "United Arab Emirates", "Qatar", "India", "Pakistan"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Major global energy chokepoint",
      "High sensitivity to geopolitical escalation",
      "Disruptions rapidly affect oil and LNG shipping sentiment",
    ],
  },
  {
    id: "Strait of Malacca",
    name: "Strait of Malacca",
    type: "chokepoint",
    connections: ["China", "Singapore", "Malaysia", "Indonesia", "Thailand", "Vietnam", "India", "Bangladesh", "Taiwan", "Japan", "South Korea", "Philippines", "Australia", "Bab-el-Mandeb"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Shortest major sea route between Indian and Pacific Oceans",
      "Core artery for East Asian manufacturing supply chains",
      "Congestion or security incidents can shift traffic and cost",
    ],
  },
  {
    id: "Bab-el-Mandeb",
    name: "Bab-el-Mandeb",
    type: "chokepoint",
    connections: ["Strait of Malacca", "Suez Canal", "Egypt", "Saudi Arabia", "United Arab Emirates", "Yemen", "Djibouti", "Ethiopia", "South Africa", "Nigeria", "India"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Southern gateway to the Red Sea",
      "Strongly coupled with Suez Canal risk",
      "Shipping disruptions can force Cape rerouting",
    ],
  },
  {
    id: "Bosphorus",
    name: "Bosphorus",
    type: "chokepoint",
    connections: ["Turkey", "Greece", "Romania", "Bulgaria", "Georgia", "Ukraine", "Russia"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Essential outlet for Black Sea trade",
      "Important for grain, energy, and regional shipping",
      "Regional conflict risk can propagate into maritime insurance and routing",
    ],
  },
]

export default function SupplyChainCrisisDetector() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<ProductSupplyRoute | null>(null)
  const [showRiskZones, setShowRiskZones] = useState(false)
  const [foundRoutes, setFoundRoutes] = useState<FoundRoute[]>([])
  const [selectedFoundRouteId, setSelectedFoundRouteId] = useState<string | null>(null)
  const [storedProducts, setStoredProducts] = useState<StoredProduct[]>([])
  const [decompositionTree, setDecompositionTree] = useState<DecompositionTree | null>(null)
  const [activeTree, setActiveTree] = useState<DecompositionTree | null>(null)
  const [selectedDecompNodeId, setSelectedDecompNodeId] = useState<string | null>(null)
  const [riskSnapshots, setRiskSnapshots] = useState<Record<string, CountryRiskEvaluation>>({})
  const [hasLoadedSnapshots, setHasLoadedSnapshots] = useState(false)
  const [riskLoadingIds, setRiskLoadingIds] = useState<Record<string, boolean>>({})
  const [isBulkEvaluating, setIsBulkEvaluating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState({
    completedCountries: 0,
    totalCountries: 0,
    completedChunks: 0,
    totalChunks: 0,
  })
  const [safeRouteContext, setSafeRouteContext] = useState<{
    origin: string
    destination: string
    itemName: string
    componentId?: string
    productId?: string
  } | null>(null)
  const [alternativesPanelOpen, setAlternativesPanelOpen] = useState(false)
  const [selectedComponentRisk, setSelectedComponentRisk] = useState<ComponentRiskData | null>(null)
  const [isRouteSummaryOpen, setIsRouteSummaryOpen] = useState(false)
  const [routesPanelProduct, setRoutesPanelProduct] = useState<StoredProduct | null>(null)

  // Alternative supplier scanning
  const [alternativesMap, setAlternativesMap] = useState<Record<string, AlternativeEntry[]>>({})
  const [altScanLoading, setAltScanLoading] = useState(false)

  // Map ref for demo mode control
  const mapRef = useRef<SupplyChainMapRef>(null)

  // Track route animation state for ActionBar
  const [isRouteAnimating, setIsRouteAnimating] = useState(false)

  // Handle route animation with state tracking
  const handleAnimateRoutes = useCallback(() => {
    if (isRouteAnimating) return
    setIsRouteAnimating(true)
    mapRef.current?.animateRoutes(2500, undefined, () => {
      setIsRouteAnimating(false)
    })
  }, [isRouteAnimating])

  const requiredCountryIds = useMemo(() => {
    return countryRisks
      .filter((node) => node.type === "country")
      .map((node) => node.id)
  }, [])

  const hasCompleteSnapshots = useMemo(() => {
    return requiredCountryIds.every((id) => !!riskSnapshots[id])
  }, [requiredCountryIds, riskSnapshots])

  // resolvedCountryRisks must be defined before insights
  const resolvedCountryRisks = useMemo(() => {
    return countryRisks.map((node) => {
      if (node.type === "country") {
        const snapshot = riskSnapshots[node.id]
        if (!snapshot) return node

        return {
          ...node,
          importRisk: snapshot.importRisk,
          exportRisk: snapshot.exportRisk,
          overallRisk: snapshot.overallRisk,
          newsHighlights: [
            snapshot.summary,
            `Import → tariff ${snapshot.importFactors.tariff.score}, conflict ${snapshot.importFactors.conflict.score}, policy ${snapshot.importFactors.policy.score}`,
            `Export → tariff ${snapshot.exportFactors.tariff.score}, conflict ${snapshot.exportFactors.conflict.score}, policy ${snapshot.exportFactors.policy.score}`,
          ],
        }
      }

      const relatedCountries = chokeToCountriesMap[node.id] ?? []
      if (relatedCountries.length === 0) return node

      const availableSnapshots = relatedCountries
        .map((countryName: string) => riskSnapshots[countryName])
        .filter(Boolean)

      if (availableSnapshots.length === 0) {
        return node
      }

      const totalImport = availableSnapshots.reduce((sum: number, s: CountryRiskEvaluation) => sum + s.importRisk, 0)
      const totalExport = availableSnapshots.reduce((sum: number, s: CountryRiskEvaluation) => sum + s.exportRisk, 0)
      const totalOverall = availableSnapshots.reduce((sum: number, s: CountryRiskEvaluation) => sum + s.overallRisk, 0)

      return {
        ...node,
        importRisk: totalImport / availableSnapshots.length,
        exportRisk: totalExport / availableSnapshots.length,
        overallRisk: totalOverall / availableSnapshots.length,
        newsHighlights: [
          ...node.newsHighlights,
          `Derived from ${availableSnapshots.length} neighboring countries`,
        ],
      }
    })
  }, [riskSnapshots])

  // Calculate insights from stored products
  const insights = useMemo<SupplyChainInsights | undefined>(() => {
    if (storedProducts.length === 0) return undefined
    const product = storedProducts[storedProducts.length - 1] // Get the most recently added product
    const tree = product.tree
    const products = convertTreeToAnalyzerProducts(tree)
    return analyzeSupplyChain(products, countryRisks)
  }, [storedProducts, countryRisks])

  // Convert insights to SupplyChainInsightsData format for the sidebar
  const insightsData = useMemo<SupplyChainInsightsData | null>(() => {
    if (!insights) return null
    return {
      healthScore: 100 - (insights.highRiskComponents.length > 0
        ? insights.highRiskComponents.reduce((sum, c) => sum + c.risk, 0) / insights.highRiskComponents.length
        : 0),
      riskBreakdown: {
        geopolitical: insights.riskBreakdown?.geopolitical ?? 30,
        logistics: insights.riskBreakdown?.logistics ?? 25,
        priceVolatility: insights.riskBreakdown?.priceVolatility ?? 20,
      },
      highRiskComponents: insights.highRiskComponents.map(c => ({
        componentId: c.componentId,
        componentName: c.componentName,
        country: c.country,
        risk: c.risk,
        productId: c.productId,
      })),
      priceImpact: {
        estimated: insights.priceImpact?.estimated ?? "+5%",
        factors: insights.priceImpact?.factors ?? [],
      },
      recommendations: insights.recommendations ?? [],
    }
  }, [insights])

  // Calculate risk level from insights
  const riskLevel = useMemo<"low" | "medium" | "high">(() => {
    if (!insights) return "low"
    const avgRisk = insights.highRiskComponents.reduce((sum, c) => sum + c.risk, 0) / Math.max(insights.highRiskComponents.length, 1)
    if (avgRisk > 70) return "high"
    if (avgRisk > 40) return "medium"
    return "low"
  }, [insights])

  // Load cached risk snapshots
  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const res = await fetch("/data/risk-snapshots.json", { cache: "no-store" })

        if (!res.ok) {
          setHasLoadedSnapshots(true)
          return
        }

        const data = await res.json()
        setRiskSnapshots(data ?? {})
      } catch (err) {
        console.log("No cached risk snapshots")
      } finally {
        setHasLoadedSnapshots(true)
      }
    }

    loadSnapshots()
  }, [])

  // Save risk snapshots
  useEffect(() => {
    if (!hasLoadedSnapshots) return
    if (!Object.keys(riskSnapshots).length) return

    const save = async () => {
      await fetch("/api/save-risk-snapshots", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(riskSnapshots),
      })
    }

    save()
  }, [hasLoadedSnapshots, hasCompleteSnapshots, riskSnapshots])

  // Bulk evaluate countries
  useEffect(() => {
    if (!hasLoadedSnapshots) return
    if (!countryRisks.length) return
    if (hasCompleteSnapshots) {
      console.log("Using cached risk snapshots. Skipping evaluation.")
      return
    }

    let cancelled = false;

    (async () => {
      try {
        setIsBulkEvaluating(true)

        const results = await evaluateAllCountriesInChunks({
          countryRisks,
          existingSnapshots: riskSnapshots,
          chunkSize: 10,
          forceRefresh: false,
          onChunkStart: (countryIds: string[]) => {
            if (cancelled) return

            setRiskLoadingIds((prev) => {
              const next = { ...prev }
              countryIds.forEach((id) => {
                next[id] = true
              })
              return next
            })
          },
          onChunkComplete: (chunkResults: CountryRiskEvaluation[]) => {
            if (cancelled) return

            setRiskSnapshots((prev) => {
              const next = { ...prev }
              chunkResults.forEach((result) => {
                next[result.nodeId] = result
              })
              return next
            })

            setRiskLoadingIds((prev) => {
              const next = { ...prev }
              chunkResults.forEach((result) => {
                next[result.nodeId] = false
              })
              return next
            })
          },
          onProgress: (info) => {
            if (cancelled) return
            setBulkProgress(info)
          },
        })

        if (cancelled) return

        console.log("Bulk country evaluation completed:", results.length)
      } catch (error) {
        console.error("Bulk country evaluation failed:", error)
      } finally {
        if (!cancelled) {
          setIsBulkEvaluating(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [countryRisks, hasLoadedSnapshots, hasCompleteSnapshots, riskSnapshots])

  // Initialize route graph with country risks data
  useEffect(() => {
    if (!resolvedCountryRisks.length) return
    try {
      getRouteGraph(resolvedCountryRisks)
    } catch (error) {
      console.error("Failed to initialize route graph:", error)
    }
  }, [resolvedCountryRisks])

  const handleReset = useCallback(() => {
    setSelectedCountry(null)
    setSelectedRoute(null)
  }, [])

  const handleRouteClick = useCallback((route: ProductSupplyRoute) => {
    setSelectedRoute(route)
  }, [])

  const handleProductAdd = useCallback((product: StoredProduct) => {
    setStoredProducts((prev) => [...prev, product])
  }, [])

  const handleTreeChange = useCallback((tree: DecompositionTree | null) => {
    setActiveTree(tree)
  }, [])

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedDecompNodeId(nodeId)
  }, [])

  const handleRouteFound = useCallback((routes: FoundRoute[]) => {
    setFoundRoutes(routes)
    if (routes.length > 0) {
      setSelectedFoundRouteId(routes[0].id)
    }
  }, [])

  // Apply alternative supplier to a tree node
  const handleApplyAlternative = useCallback(
    (nodeId: string, newCountry: string) => {
      const cr = resolvedCountryRisks.find((c) => c.name === newCountry)
      const newRisk = cr?.overallRisk ?? 0

      setStoredProducts((prev) =>
        prev.map((sp) => {
          const node = sp.tree.nodes[nodeId]
          if (!node) return sp
          return {
            ...sp,
            tree: {
              ...sp.tree,
              nodes: {
                ...sp.tree.nodes,
                [nodeId]: {
                  ...node,
                  geographic_concentration: { [newCountry]: 100 },
                  risk_score: newRisk,
                },
              },
            },
          }
        }),
      )
    },
    [resolvedCountryRisks],
  )

  // Handle "Find Safe Routes" from product card - extracts high-risk countries
  const handleFindSafeRoute = useCallback((product: StoredProduct, targetCountry?: string) => {
    const highRiskCountries = extractHighRiskCountries(product, 60)
    // Use product's destination country, then targetCountry param, then default to United States
    const destination = product.destinationCountry || targetCountry || "United States"

    if (highRiskCountries.length === 0) {
      // No high-risk countries found, use the product's main country if available
      const rootNode = product.tree.nodes[product.tree.root_id]
      const mainCountry = rootNode
        ? Object.keys(rootNode.geographic_concentration)[0] || "China"
        : "China"

      setSafeRouteContext({
        origin: mainCountry,
        destination,
        itemName: product.name,
        productId: product.id,
      })
    } else {
      // Use the highest-risk country as origin
      const highestRisk = highRiskCountries[0]
      setSafeRouteContext({
        origin: highestRisk.country,
        destination,
        itemName: `${product.name} - ${highestRisk.nodeName}`,
        componentId: highestRisk.nodeId,
        productId: product.id,
      })
    }
  }, [])

  const handleFindSafeRouteFromInsights = useCallback((
    origin: string,
    destination: string,
    itemName: string,
    componentId?: string,
    productId?: string
  ) => {
    setSafeRouteContext({ origin, destination, itemName, componentId, productId })
  }, [])

  const handleViewAlternatives = useCallback((component: ComponentRiskForInsights, parentCountry: string) => {
    if (insights) {
      const componentRisk = insights.highRiskComponents.find(c => c.componentId === component.componentId)
      if (componentRisk) {
        setSelectedComponentRisk(componentRisk)
        setAlternativesPanelOpen(true)
      }
    }
  }, [insights])

  const handleAlertClick = useCallback((alert: AlertData) => {
    if (alert.relatedComponentId && insights) {
      const componentRisk = insights.highRiskComponents.find(c => c.componentId === alert.relatedComponentId)
      if (componentRisk) {
        setSelectedComponentRisk(componentRisk)
        setAlternativesPanelOpen(true)
      }
    }
  }, [insights])

  const handleClear = useCallback(() => {
    setSelectedCountry(null)
    setSelectedRoute(null)
    setFoundRoutes([])
    setSelectedFoundRouteId(null)
    setSafeRouteContext(null)
  }, [])

  // Convert resolvedCountryRisks to format expected by UnifiedSidebar
  const sidebarCountryRisks = useMemo(() => {
    return resolvedCountryRisks
      .filter(c => c.type === "country")
      .map(c => ({
        id: c.id,
        name: c.name,
        importRisk: c.importRisk,
        exportRisk: c.exportRisk,
        overallRisk: c.overallRisk,
        newsHighlights: c.newsHighlights,
      }))
  }, [resolvedCountryRisks])

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Unified Sidebar - THE central hub */}
      <UnifiedSidebar
        countryRisks={sidebarCountryRisks}
        selectedCountry={selectedCountry}
        onCountrySelect={setSelectedCountry}
        onReset={handleReset}
        products={storedProducts}
        onProductAdd={handleProductAdd}
        onTreeChange={handleTreeChange}
        onNodeSelect={handleNodeSelect}
        productCount={storedProducts.length}
        riskLevel={riskLevel}
        onFindSafeRoute={handleFindSafeRoute}
        onRouteFound={handleRouteFound}
        preselectedOrigin={safeRouteContext?.origin}
        preselectedDestination={safeRouteContext?.destination}
        routeContext={safeRouteContext ? {
          componentId: safeRouteContext.componentId,
          productId: safeRouteContext.productId,
        } : null}
        insights={insightsData}
        onFindSafeRouteFromInsights={handleFindSafeRouteFromInsights}
        onViewAlternatives={handleViewAlternatives}
        routesPanelProduct={routesPanelProduct}
        onRoutesPanelProductChange={setRoutesPanelProduct}
      />

      {/* Main Map Area */}
      <div className="relative flex-1 h-full overflow-hidden">
        {/* Alert Banner */}
        <div className="absolute left-4 right-4 top-20 z-20">
          <AlertBanner
            insights={insights}
            onAlertClick={handleAlertClick}
          />
        </div>

        {/* Action Bar */}
        <ActionBar
          showRiskZones={showRiskZones}
          isRouteSummaryOpen={isRouteSummaryOpen}
          productCount={storedProducts.length}
          onToggleRiskZones={() => setShowRiskZones(!showRiskZones)}
          onToggleRouteSummary={() => setIsRouteSummaryOpen(!isRouteSummaryOpen)}
          onClear={handleClear}
          onAnimateRoutes={handleAnimateRoutes}
          isAnimating={isRouteAnimating}
        />

        {/* Supply Chain Map */}
        <SupplyChainMap
          countryRisks={resolvedCountryRisks}
          onCountrySelect={setSelectedCountry}
          selectedCountry={selectedCountry}
          customRoute={null}
          products={[]}
          selectedRouteId={selectedRoute?.id ?? null}
          onRouteClick={handleRouteClick}
          showRiskZones={showRiskZones}
          onAddItemAtCountry={() => {}}
          foundRoutes={foundRoutes}
          selectedFoundRouteId={selectedFoundRouteId}
          ref={mapRef}
        />

        {/* Path Details Panel - shows when a route is clicked */}
        <PathDetailsPanel
          route={selectedRoute}
          countryRisks={resolvedCountryRisks}
          onClose={() => setSelectedRoute(null)}
        />

        {/* Route Summary Panel */}
        <RouteSummary
          isOpen={isRouteSummaryOpen}
          onClose={() => setIsRouteSummaryOpen(false)}
          products={[]}
          countryRisks={resolvedCountryRisks}
          onRouteClick={(origin, destination) => {
            setSafeRouteContext({ origin, destination, itemName: 'Selected Route' })
            setIsRouteSummaryOpen(false)
          }}
        />

        {/* Supplier Recommendations Panel */}
        <SupplierRecommendations
          isOpen={alternativesPanelOpen}
          onClose={() => setAlternativesPanelOpen(false)}
          componentRisk={selectedComponentRisk}
          destinationCountry="United States"
          onSelectAlternative={(alternative) => {
            // Handle alternative selection
          }}
          onViewRoute={(origin, destination) => {
            setSafeRouteContext({ origin, destination, itemName: 'Alternative Route' })
            setAlternativesPanelOpen(false)
          }}
          onReplaceSupplier={(alternative) => {
            setAlternativesPanelOpen(false)
          }}
        />

        {/* Product Supply Chain Routes Panel */}
        <ProductSupplyChainRoutesPanel
          isOpen={routesPanelProduct !== null}
          onClose={() => setRoutesPanelProduct(null)}
          product={routesPanelProduct}
          countryRisks={resolvedCountryRisks as RouteCountryRiskData[]}
          onVisualizeRoutes={handleRouteFound}
        />
      </div>
    </div>
  )
}
