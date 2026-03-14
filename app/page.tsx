"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { NavSidebar } from "@/components/nav-sidebar"
import { RiskSidebar } from "@/components/risk-sidebar"
import { InventorySidebar } from "@/components/inventory-sidebar"
import { SupplyChainMap, type ProductSupplyRoute } from "@/components/supply-chain-map"
import type { ItemType } from "@/components/supply-chain-map"
import { RouteBuilder, type CustomRoute } from "@/components/route-builder"
import { ProductSupplyChain, type Product } from "@/components/product-supply-chain"
import type { StoredProduct, DecompositionTree } from "@/lib/decompose/types"
import { syncStoredToProducts } from "@/lib/sync-products"
import { PathDetailsPanel } from "@/components/path-details-panel"
import { RelocationPanel } from "@/components/relocation-panel"
import { analyzeSupplyChain } from "@/lib/supply-chain-analyzer"
import type { SupplyChainInsights, ComponentRisk as ComponentRiskData } from "@/lib/supply-chain-analyzer"
import { SupplierRecommendations } from "@/components/supplier-recommendations"
import { RouteFinderPanel } from "@/components/route-finder-panel"
import { RouteSummary } from "@/components/route-summary"
import { PriceRiskTimeline } from "@/components/price-risk-timeline"
import { AlertBanner, type AlertData } from "@/components/alert-banner"
import { Button } from "@/components/ui/button"
import { Route, Package, Layers, Globe, Factory, Navigation, X, BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { FoundRoute } from "@/lib/route-types"
import { getRouteGraph } from "@/lib/route-graph"
import { CountryRiskEvaluation } from "./lib/risk-client"
import { evaluateCountryRiskBatch, evaluateAllCountriesInChunks } from "./lib/risk-client"
import { collectCountriesFromProducts } from "./lib/risk-country-utils";

export type AlternativeEntry = { country: string; risk: string; reason: string }

// Type definition for country risks
type CountryRiskType = "country" | "chokepoint"

interface CountryRiskData {
  id: string
  name: string
  type: CountryRiskType
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

// Mock data for country risks with news-based analysis
const countryRisks: CountryRiskData[] = [
  {
    id: "China",
    name: "China",
    type: "country",
    connections: ["Strait of Malacca", "Singapore", "Vietnam", "Japan", "South Korea", "Taiwan"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Strong logistics infrastructure performance"],
  },
  {
    id: "India",
    name: "India",
    type: "country",
    connections: ["Strait of Malacca", "Strait of Hormuz", "Bab-el-Mandeb", "United Arab Emirates", "Singapore", "Bangladesh", "Pakistan"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Palm oil export restrictions easing"],
  },
  {
    id: "Japan",
    name: "Japan",
    type: "country",
    connections: ["China", "South Korea", "Taiwan", "Strait of Malacca", "Panama Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Semiconductor supply chain improvements"],
  },
  {
    id: "South Korea",
    name: "South Korea",
    type: "country",
    connections: ["China", "Japan", "Taiwan", "Strait of Malacca", "Panama Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Tech exports maintaining stability"],
  },
  {
    id: "Mexico",
    name: "Mexico",
    type: "country",
    connections: ["United States", "Panama Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Energy export routes stable"],
  },
  {
    id: "South Africa",
    name: "South Africa",
    type: "country",
    connections: ["Bab-el-Mandeb"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Electronics manufacturing stable"],
  },
  {
    id: "Malaysia",
    name: "Malaysia",
    type: "country",
    connections: ["Thailand", "Vietnam", "Singapore", "Indonesia", "Strait of Malacca"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Semiconductor supply chain hub"],
  },
  {
    id: "Singapore",
    name: "Singapore",
    type: "country",
    connections: ["Malaysia", "Indonesia", "Vietnam", "Thailand", "India", "Strait of Malacca"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Premier logistics hub status maintained"],
  },
  {
    id: "Netherlands",
    name: "Netherlands",
    type: "country",
    connections: ["Germany", "France", "United Kingdom", "Suez Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Rotterdam port efficiency high"],
  },
  {
    id: "United Kingdom",
    name: "United Kingdom",
    type: "country",
    connections: ["Netherlands", "France"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Post-Brexit trade flows stabilizing"],
  },
  {
    id: "France",
    name: "France",
    type: "country",
    connections: ["Germany", "Netherlands", "United Kingdom", "Spain", "Italy", "Suez Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Agricultural exports strong"],
  },
  {
    id: "Italy",
    name: "Italy",
    type: "country",
    connections: ["France", "Spain", "Greece", "Suez Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Manufacturing sector resilient"],
  },
  {
    id: "Spain",
    name: "Spain",
    type: "country",
    connections: ["France", "Italy"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Mediterranean trade routes stable"],
  },
  {
    id: "Australia",
    name: "Australia",
    type: "country",
    connections: ["Indonesia", "Strait of Malacca"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Resource exports to Asia strong"],
  },
  {
    id: "Canada",
    name: "Canada",
    type: "country",
    connections: ["United States", "Panama Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["USMCA trade flows steady"],
  },
  {
    id: "Egypt",
    name: "Egypt",
    type: "country",
    connections: ["Suez Canal", "Bab-el-Mandeb", "Saudi Arabia", "Greece"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Mining exports stable"],
  },
  {
    id: "Poland",
    name: "Poland",
    type: "country",
    connections: ["Germany", "Ukraine", "Romania"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: ["Manufacturing hub for Europe"],
  },
  {
    id: "Bangladesh",
    name: "Bangladesh",
    type: "country",
    connections: ["India", "Strait of Malacca"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
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

  // additional countries used by chokepoint-oriented routing
  {
    id: "Panama",
    name: "Panama",
    type: "country",
    connections: ["Panama Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Canal-linked logistics remains strategically important",
      "Waterway dependency amplifies transit-related risk",
    ],
  },
  {
    id: "United Arab Emirates",
    name: "United Arab Emirates",
    type: "country",
    connections: ["Saudi Arabia", "Qatar", "Oman", "Strait of Hormuz", "Bab-el-Mandeb", "India"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Regional transshipment hub",
      "Exposure to Gulf and Red Sea route conditions",
    ],
  },
  {
    id: "Oman",
    name: "Oman",
    type: "country",
    connections: ["United Arab Emirates", "Strait of Hormuz"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Strategic location near Gulf shipping lanes",
      "Energy and port logistics remain regionally important",
    ],
  },
  {
    id: "Qatar",
    name: "Qatar",
    type: "country",
    connections: ["Saudi Arabia", "United Arab Emirates", "Strait of Hormuz"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "LNG export flows highly strategic",
      "Trade sensitivity tied to Gulf maritime stability",
    ],
  },
  {
    id: "Yemen",
    name: "Yemen",
    type: "country",
    connections: ["Bab-el-Mandeb", "Saudi Arabia"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Conflict-related disruption risk remains very high",
      "Red Sea shipping security strongly affected",
    ],
  },
  {
    id: "Djibouti",
    name: "Djibouti",
    type: "country",
    connections: ["Bab-el-Mandeb", "Ethiopia"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Important Red Sea logistics location",
      "Strategic shipping and port relevance remains elevated",
    ],
  },
  {
    id: "Greece",
    name: "Greece",
    type: "country",
    connections: ["Egypt", "Italy", "Turkey", "Suez Canal", "Bosphorus"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Eastern Mediterranean maritime hub role remains important",
      "Port connectivity links Asia-Europe routes",
    ],
  },
  {
    id: "Romania",
    name: "Romania",
    type: "country",
    connections: ["Ukraine", "Poland", "Turkey", "Bosphorus", "Bulgaria"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Black Sea trade relevance elevated",
      "Regional logistics affected by security conditions",
    ],
  },
  {
    id: "Bulgaria",
    name: "Bulgaria",
    type: "country",
    connections: ["Romania", "Turkey", "Greece", "Bosphorus"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Black Sea and Balkan corridor importance continues",
      "Regional multimodal trade routes remain relevant",
    ],
  },
  {
    id: "Georgia",
    name: "Georgia",
    type: "country",
    connections: ["Russia", "Turkey", "Bosphorus"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Caucasus corridor role remains strategically important",
      "Regional geopolitical conditions shape logistics risk",
    ],
  },
  {
    id: "Peru",
    name: "Peru",
    type: "country",
    connections: ["Chile", "Brazil", "Panama Canal"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Pacific commodity exports remain important",
      "Canal access influences route flexibility",
    ],
  },
  {
    id: "Ethiopia",
    name: "Ethiopia",
    type: "country",
    connections: ["Djibouti", "Bab-el-Mandeb"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: 0,
    newsHighlights: [
      "Trade access highly dependent on external port routes",
      "Logistics resilience tied to Red Sea corridor stability",
    ],
  },

  // chokepoints
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

const chokeToCountriesMap: Record<string, any> = {
  "Suez Canal": ["Egypt", "Israel"],
  "Panama Canal": ["Panama", "Cuba", "United States"],
  "Strait of Hormuz": ["Iran", "Oman", "Saudi Arabia", "United Arab Emirates"],
  "Strait of Malacca": ["Singapore", "Malaysia", "Indonesia"],
  "Bab-el-Mandeb": ["Yemen", "Djibouti", "Ethiopia"],
  "Bosphorus": ["Turkey", "Greece", "Romania", "Bulgaria"],
}

export default function SupplyChainCrisisDetector() {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [isRouteBuilderOpen, setIsRouteBuilderOpen] = useState(false)
  const [isProductBuilderOpen, setIsProductBuilderOpen] = useState(false)
  const [customRoute, setCustomRoute] = useState<CustomRoute | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedRoute, setSelectedRoute] = useState<ProductSupplyRoute | null>(null)
  const [showRiskZones, setShowRiskZones] = useState(false)
  const [isRelocationOpen, setIsRelocationOpen] = useState(false)
  const [isRouteFinderOpen, setIsRouteFinderOpen] = useState(false)
  const [foundRoutes, setFoundRoutes] = useState<FoundRoute[]>([])
  const [selectedFoundRouteId, setSelectedFoundRouteId] = useState<string | null>(null)
  const [storedProducts, setStoredProducts] = useState<StoredProduct[]>([])
  const [decompositionTree, setDecompositionTree] = useState<DecompositionTree | null>(null)
  const [activeTree, setActiveTree] = useState<DecompositionTree | null>(null)
  const [selectedDecompNodeId, setSelectedDecompNodeId] = useState<string | null>(null)
  const [isInventorySidebarOpen, setIsInventorySidebarOpen] = useState(false)
  const [alternativesMap, setAlternativesMap] = useState<Record<string, AlternativeEntry[]>>({})
  const [altScanLoading, setAltScanLoading] = useState(false)
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
  const [mapAddRequest, setMapAddRequest] = useState<{
    country: string
    itemType: ItemType
  } | null>(null)
  const [safeRouteContext, setSafeRouteContext] = useState<{
    origin: string
    destination: string
    itemName: string
  } | null>(null)
  const [alternativesPanelOpen, setAlternativesPanelOpen] = useState(false)
  const [selectedComponentRisk, setSelectedComponentRisk] = useState<ComponentRiskData | null>(null)
  const [isRouteSummaryOpen, setIsRouteSummaryOpen] = useState(false)

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
      if (node.type !== "country") return node

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
    })
  }, [countryRisks, riskSnapshots])

  // Calculate insights from products
  const insights = useMemo(() => {
    if (products.length === 0) return undefined
    return analyzeSupplyChain(products, resolvedCountryRisks)
  }, [products, resolvedCountryRisks])

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
  }, [riskSnapshots])

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
  }, [countryRisks])

  // Initialize route graph with country risks data
  useEffect(() => {
    if (!resolvedCountryRisks.length) return
    try {
      getRouteGraph(resolvedCountryRisks)
    } catch (error) {
      console.error("Failed to initialize route graph:", error)
    }
  }, [resolvedCountryRisks])

  // Sync storedProducts → right-panel products (additive; keeps local edits)
  useEffect(() => {
    setProducts((prev) => syncStoredToProducts(storedProducts, prev))
  }, [storedProducts])

  const handleReset = () => {
    setSelectedCountry(null)
    setCustomRoute(null)
    setSelectedRoute(null)
  }

  const handleRouteClick = (route: ProductSupplyRoute) => {
    setSelectedRoute(route)
    setIsProductBuilderOpen(false)
    setIsRouteBuilderOpen(false)
  }

  const handleProductAdd = (product: StoredProduct) => {
    setStoredProducts((prev) => [...prev, product])
  }

  const handleTreeChange = (tree: DecompositionTree | null) => {
    setActiveTree(tree)
  }

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedDecompNodeId(nodeId)
  }

  const handleInventoryProductSelect = useCallback(
    async (storedProduct: StoredProduct) => {
      setIsProductBuilderOpen(true)
      setIsRouteBuilderOpen(false)
      setIsRelocationOpen(false)
      setAlternativesMap({})
      setAltScanLoading(true)

      // Check server-side JSON cache first
      try {
        const cacheRes = await fetch(
          `/api/alternatives-cache?productId=${encodeURIComponent(storedProduct.id)}`,
        )
        const cacheData = await cacheRes.json()
        if (cacheData.alternatives && Object.keys(cacheData.alternatives).length > 0) {
          setAlternativesMap(cacheData.alternatives)
          setAltScanLoading(false)
          return
        }
      } catch {
        /* cache miss — continue to fetch */
      }

      const tree = storedProduct.tree
      const THRESHOLD = 60
      const highRiskItems: {
        id: string
        name: string
        type: string
        country: string
        risk: number
      }[] = []

      const walkTree = (nodeId: string) => {
        const node = tree.nodes[nodeId]
        if (!node) return
        const entries = Object.entries(node.geographic_concentration)
        if (entries.length > 0) {
          entries.sort((a, b) => b[1] - a[1])
          const country = entries[0][0]
          const cr = resolvedCountryRisks.find((c) => c.name === country)
          if (cr && cr.overallRisk >= THRESHOLD) {
            highRiskItems.push({
              id: node.id,
              name: node.name,
              type: node.type,
              country,
              risk: cr.overallRisk,
            })
          }
        }
        node.children.forEach(walkTree)
      }
      walkTree(tree.root_id)

      if (highRiskItems.length === 0) {
        setAltScanLoading(false)
        return
      }

      highRiskItems.sort((a, b) => b.risk - a.risk)

      const results: Record<string, AlternativeEntry[]> = {}
      await Promise.allSettled(
        highRiskItems.map(async (item) => {
          try {
            const res = await fetch("/api/ai/alternatives", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                country: item.country,
                itemType: item.type,
                itemName: item.name,
                currentRisk: item.risk,
              }),
            })
            const data = await res.json()
            if (data.alternatives) {
              results[item.id] = data.alternatives
            }
          } catch {
            /* skip failed */
          }
        }),
      )
      setAlternativesMap(results)
      setAltScanLoading(false)

      // Persist to server-side JSON cache
      if (Object.keys(results).length > 0) {
        fetch("/api/alternatives-cache", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: storedProduct.id,
            alternatives: results,
          }),
        }).catch(() => {})
      }
    },
    [resolvedCountryRisks],
  )

  const handleAddToInventory = useCallback(
    (product: Product) => {
      if (storedProducts.some((sp) => sp.id === product.id)) return

      const buildNodes = (
        item: { id: string; name: string; type: string; country: string; riskPrediction: number; children: any[] },
        tier: number,
      ): Record<string, any> => {
        const nodeType =
          item.type === "product" ? "product" :
          item.type === "component" ? "component" :
          item.type === "material" ? "material" : "geography"

        const node = {
          id: item.id,
          name: item.name || item.type,
          tier,
          type: nodeType,
          status: "verified" as const,
          confidence: 0.8,
          geographic_concentration: { [item.country]: 100 },
          risk_score: item.riskPrediction,
          risk_factors: [],
          source: "inferred" as const,
          search_evidence: null,
          correction: null,
          children: item.children.map((c: any) => c.id),
        }

        let all: Record<string, any> = { [item.id]: node }
        for (const child of item.children) {
          all = { ...all, ...buildNodes(child, tier + 1) }
        }
        return all
      }

      const rootId = product.id
      const rootNode = {
        id: rootId,
        name: product.name || "Unnamed",
        type: "product",
        country: product.country,
        riskPrediction: product.riskPrediction,
        children: product.components,
      }
      const nodes = buildNodes(rootNode, 0)

      const tree: DecompositionTree = {
        product: product.name || "Unnamed",
        phase: "verified",
        nodes,
        root_id: rootId,
        metadata: {
          total_nodes: Object.keys(nodes).length,
          verified_count: Object.keys(nodes).length,
          corrected_count: 0,
          avg_confidence: 0.8,
        },
      }

      const stored: StoredProduct = {
        id: product.id,
        name: product.name || "Unnamed",
        suppliers: [],
        tree,
        durationMs: 0,
        createdAt: Date.now(),
      }

      setStoredProducts((prev) => [...prev, stored])
    },
    [storedProducts],
  )

  const handleToggleInventory = () => {
    setIsInventorySidebarOpen((prev) => !prev)
  }

  const countryOptions = useMemo(
    () =>
      resolvedCountryRisks
        .filter((c) => c.type === "country")
        .map((c) => ({ id: c.id, name: c.name })),
    [resolvedCountryRisks],
  )

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
  const handleFindSafeRouteForProduct = (origin: string, destination: string, itemName: string) => {
    setSafeRouteContext({ origin, destination, itemName })
    setIsRouteFinderOpen(true)
    setIsProductBuilderOpen(false)
  }

  const handleClearFoundRoutes = () => {
    setFoundRoutes([])
    setSelectedFoundRouteId(null)
    setSafeRouteContext(null)
  }

  // Handler for viewing supplier alternatives
  const handleViewAlternatives = (component: { componentId: string; componentName: string; country: string; risk: number }, parentCountry: string) => {
    // Find the component risk from insights
    if (insights) {
      const componentRisk = insights.highRiskComponents.find(c => c.componentId === component.componentId)
      if (componentRisk) {
        setSelectedComponentRisk(componentRisk)
        setAlternativesPanelOpen(true)
      }
    }
  }

  // Handler for alert click
  const handleAlertClick = (alert: AlertData) => {
    if (alert.relatedComponentId && insights) {
      const componentRisk = insights.highRiskComponents.find(c => c.componentId === alert.relatedComponentId)
      if (componentRisk) {
        setSelectedComponentRisk(componentRisk)
        setAlternativesPanelOpen(true)
      }
    }
  }

  return (
    <div className="grid h-screen w-full grid-cols-[56px_320px_1fr] overflow-hidden bg-background">
      {/* Left Navigation Sidebar */}
      <NavSidebar
        onInventoryClick={handleToggleInventory}
        isInventoryOpen={isInventorySidebarOpen}
        onLocationClick={() => setIsInventorySidebarOpen(false)}
        isLocationActive={!isInventorySidebarOpen}
      />

      {/* Left-side panel: either Inventory or Supply Chain Crisis (Risk) */}
      {isInventorySidebarOpen ? (
        <InventorySidebar
          products={storedProducts}
          onProductAdd={handleProductAdd}
          onTreeChange={handleTreeChange}
          onNodeSelect={handleNodeSelect}
          onProductSelect={handleInventoryProductSelect}
          countryOptions={countryOptions}
          alternativesMap={alternativesMap}
          altScanLoading={altScanLoading}
          onApplyAlternative={handleApplyAlternative}
        />
      ) : (
        <RiskSidebar
          countryRisks={resolvedCountryRisks}
          selectedCountry={selectedCountry}
          onCountrySelect={setSelectedCountry}
          onReset={handleReset}
        />
      )}

      {/* Main Map Area */}
      <div className="relative h-full w-full overflow-hidden">
        {/* Alert Banner - positioned below action buttons */}
        <div className="absolute left-4 right-4 top-20 z-20">
          <AlertBanner
            insights={insights}
            onAlertClick={handleAlertClick}
          />
        </div>

        <SupplyChainMap
          countryRisks={resolvedCountryRisks}
          onCountrySelect={setSelectedCountry}
          selectedCountry={selectedCountry}
          customRoute={customRoute}
          products={products}
          selectedRouteId={selectedRoute?.id ?? null}
          onRouteClick={handleRouteClick}
          showRiskZones={showRiskZones}
          onAddItemAtCountry={(country, itemType) => {
            setMapAddRequest({ country, itemType })
            setIsProductBuilderOpen(true)
          }}
          foundRoutes={foundRoutes}
          selectedFoundRouteId={selectedFoundRouteId}
        />

        {/* Action Buttons */}
        <div className="absolute left-4 top-4 z-10 flex gap-2">
          <Button
            variant={isRouteBuilderOpen || customRoute ? "default" : "secondary"}
            size="sm"
            className={cn(
              "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
              isRouteBuilderOpen || customRoute
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
            )}
            onClick={() => {
              setIsRouteBuilderOpen(!isRouteBuilderOpen)
              setIsProductBuilderOpen(false)
            }}
          >
            <Route className="h-4 w-4" />
            {customRoute ? `${customRoute.totalRisk}% Risk` : "Build Route"}
          </Button>

          <Button
            variant={isProductBuilderOpen || products.length > 0 ? "default" : "secondary"}
            size="sm"
            className={cn(
              "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
              isProductBuilderOpen || products.length > 0
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
            )}
            onClick={() => {
              setIsProductBuilderOpen(!isProductBuilderOpen)
              setIsRouteBuilderOpen(false)
              setIsRelocationOpen(false)
            }}
          >
            <Package className="h-4 w-4" />
            {products.length > 0 ? `${products.length} Product${products.length > 1 ? 's' : ''}` : "Products"}
          </Button>

          <Button
            variant={isRelocationOpen ? "default" : "secondary"}
            size="sm"
            className={cn(
              "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
              isRelocationOpen
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
            )}
            onClick={() => {
              setIsRelocationOpen(!isRelocationOpen)
              setIsRouteBuilderOpen(false)
              setIsProductBuilderOpen(false)
            }}
          >
            <Factory className="h-4 w-4" />
            Relocation
          </Button>

          <Button
            variant={isRouteFinderOpen ? "default" : "secondary"}
            size="sm"
            className={cn(
              "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
              isRouteFinderOpen
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
            )}
            onClick={() => {
              setIsRouteFinderOpen(!isRouteFinderOpen)
              setIsRouteBuilderOpen(false)
              setIsProductBuilderOpen(false)
              setIsRelocationOpen(false)
            }}
          >
            <Navigation className="h-4 w-4" />
            Safe Routes
          </Button>

          <Button
            variant={showRiskZones ? "default" : "secondary"}
            size="sm"
            className={cn(
              "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
              showRiskZones
                ? "bg-primary text-primary-foreground glow-primary"
                : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
            )}
            onClick={() => setShowRiskZones(!showRiskZones)}
          >
            <Globe className="h-4 w-4" />
            Risk Zones
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="gap-2 font-medium glass-panel border-primary/20 shadow-lg hover:border-primary/40 hover:bg-muted/50 sleek-button cursor-pointer"
            onClick={() => {
              setSelectedCountry(null)
              setSelectedRoute(null)
            }}
          >
            <Layers className="h-4 w-4" />
            Clear
          </Button>

          {/* Route Summary Button */}
          {products.length > 0 && (
            <Button
              variant={isRouteSummaryOpen ? "default" : "secondary"}
              size="sm"
              className={cn(
                "gap-2 font-medium shadow-lg transition-all duration-200 sleek-button cursor-pointer",
                isRouteSummaryOpen
                  ? "bg-primary text-primary-foreground glow-primary"
                  : "glass-panel border-primary/20 hover:border-primary/40 hover:bg-muted/50"
              )}
              onClick={() => setIsRouteSummaryOpen(!isRouteSummaryOpen)}
            >
              <BarChart3 className="h-4 w-4" />
              Routes
            </Button>
          )}
        </div>

        {/* Route Builder Panel */}
        <RouteBuilder
          isOpen={isRouteBuilderOpen}
          onClose={() => setIsRouteBuilderOpen(false)}
          countryRisks={countryRisks}
          customRoute={customRoute}
          onRouteChange={setCustomRoute}
        />

        {/* Safe Route Finder Panel */}
        <RouteFinderPanel
          isOpen={isRouteFinderOpen}
          onClose={() => {
            setIsRouteFinderOpen(false)
            setSafeRouteContext(null)
          }}
          countryRisks={resolvedCountryRisks}
          onRouteFound={(routes) => {
            setFoundRoutes(routes)
            if (routes.length > 0) {
              setSelectedFoundRouteId(routes[0].id)
            }
          }}
          preselectedOrigin={safeRouteContext?.origin}
          preselectedDestination={safeRouteContext?.destination}
        />

        {/* Product Supply Chain Panel */}
        <ProductSupplyChain
          isOpen={isProductBuilderOpen}
          onClose={() => setIsProductBuilderOpen(false)}
          countryRisks={countryRisks}
          products={products}
          onProductsChange={setProducts}
          preloadedAlternatives={alternativesMap}
          altScanLoading={altScanLoading}
          onAddToInventory={handleAddToInventory}
          inventoryProductIds={storedProducts.map((p) => p.id)}
          mapAddRequest={mapAddRequest}
          onClearMapAddRequest={() => setMapAddRequest(null)}
          onFindSafeRoute={handleFindSafeRouteForProduct}
          foundRoutes={foundRoutes}
          selectedFoundRouteId={selectedFoundRouteId}
          onClearFoundRoutes={handleClearFoundRoutes}
          onViewAlternatives={handleViewAlternatives}
        />

        {/* Path Details Panel - shows when a route is clicked */}
        <PathDetailsPanel
          route={selectedRoute}
          onClose={() => setSelectedRoute(null)}
        />

        {/* Relocation Advisor Panel */}
        <RelocationPanel
          isOpen={isRelocationOpen}
          onClose={() => setIsRelocationOpen(false)}
          countryRisks={countryRisks}
          onCountrySelect={setSelectedCountry}
        />

        {/* Route Summary Panel */}
        <RouteSummary
          isOpen={isRouteSummaryOpen}
          onClose={() => setIsRouteSummaryOpen(false)}
          products={products}
          countryRisks={resolvedCountryRisks}
          onRouteClick={(origin, destination) => {
            setSafeRouteContext({ origin, destination, itemName: 'Selected Route' })
            setIsRouteFinderOpen(true)
            setIsRouteSummaryOpen(false)
          }}
        />

        {/* Supplier Recommendations Panel */}
        <SupplierRecommendations
          isOpen={alternativesPanelOpen}
          onClose={() => setAlternativesPanelOpen(false)}
          componentRisk={selectedComponentRisk}
          destinationCountry={products[0]?.destinationCountry || 'United States'}
          onSelectAlternative={(alternative) => {
            // Handle alternative selection - could update the supply chain
          }}
          onViewRoute={(origin, destination) => {
            setSafeRouteContext({ origin, destination, itemName: 'Alternative Route' })
            setIsRouteFinderOpen(true)
            setAlternativesPanelOpen(false)
          }}
          onReplaceSupplier={(alternative) => {
            // Handle supplier replacement in supply chain
            setAlternativesPanelOpen(false)
          }}
        />
      </div>
    </div>
  )
}
