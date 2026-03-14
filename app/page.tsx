"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { NavSidebar } from "@/components/nav-sidebar"
import { RiskSidebar } from "@/components/risk-sidebar"
import { InventorySidebar } from "@/components/inventory-sidebar"
import { SupplyChainMap, type ProductSupplyRoute } from "@/components/supply-chain-map"
import { RouteBuilder, type CustomRoute } from "@/components/route-builder"
import { ProductSupplyChain, type Product } from "@/components/product-supply-chain"
import type { ItemType } from "@/components/product-supply-chain"
import { PathDetailsPanel } from "@/components/path-details-panel"
import { RelocationPanel } from "@/components/relocation-panel"
import { Button } from "@/components/ui/button"
import { Route, Package, Layers, Globe, Factory } from "lucide-react"
import { cn } from "@/lib/utils"
import { CountryRiskEvaluation } from "./lib/risk-client"
import { evaluateCountryRiskBatch, evaluateAllCountriesInChunks } from "./lib/risk-client"
import type { StoredProduct, DecompositionTree } from "@/lib/decompose/types"
import { storedProductToMapProduct } from "@/lib/decompose/to-map-product"

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
    overallRisk: 64,
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
    overallRisk: 58,
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
    overallRisk: 78,
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
    overallRisk: 61,
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
    overallRisk: 83,
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
    overallRisk: 57,
    newsHighlights: [
      "Essential outlet for Black Sea trade",
      "Important for grain, energy, and regional shipping",
      "Regional conflict risk can propagate into maritime insurance and routing",
    ],
  },
]

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize))
  }
  return chunks
}

function getAllCountryNodes(countryRisks: CountryRiskData[]) {
  return countryRisks.filter((node) => node.type === "country")
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
  const [inventoryProducts, setInventoryProducts] = useState<StoredProduct[]>([])
  const [isInventorySidebarOpen, setIsInventorySidebarOpen] = useState(false)
  const [decompositionTree, setDecompositionTree] = useState<DecompositionTree | null>(null)
  const [selectedDecompNodeId, setSelectedDecompNodeId] = useState<string | null>(null)
  const [riskSnapshots, setRiskSnapshots] = useState<Record<string, CountryRiskEvaluation>>({})
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

  useEffect(() => {
    if (!countryRisks.length) return

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

  const handleToggleInventory = () => {
    setIsInventorySidebarOpen((prev) => {
      const next = !prev
      if (!next) {
        setDecompositionTree(null)
        setSelectedDecompNodeId(null)
      }
      return next
    })
  }

  const handleProductAdd = useCallback((product: StoredProduct) => {
    setInventoryProducts((prev) => [...prev, product])
  }, [])

  const handleTreeChange = useCallback((tree: DecompositionTree | null) => {
    setDecompositionTree(tree)
  }, [])

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedDecompNodeId(nodeId)
  }, [])

  const mapProducts = useMemo(() => {
    return inventoryProducts
      .map((stored, i) => storedProductToMapProduct(stored, i))
      .filter((p): p is NonNullable<typeof p> => p !== null)
  }, [inventoryProducts])

  return (
    <div className="grid h-screen w-full grid-cols-[56px_320px_1fr] overflow-hidden bg-background animate-slide-up">
      {/* Left Navigation Sidebar */}
      <NavSidebar
        onInventoryClick={handleToggleInventory}
        isInventoryOpen={isInventorySidebarOpen}
        onLocationClick={() => setIsInventorySidebarOpen(false)}
        isLocationActive={!isInventorySidebarOpen}
      />

      {/* Left-side panel: either Inventory or Supply Chain Crisis (Risk) */}
      <div className="min-h-0 overflow-hidden">
        {isInventorySidebarOpen ? (
          <InventorySidebar
            products={inventoryProducts}
            onProductAdd={handleProductAdd}
            onTreeChange={handleTreeChange}
            onNodeSelect={handleNodeSelect}
          />
        ) : (
          <RiskSidebar
            countryRisks={resolvedCountryRisks}
            selectedCountry={selectedCountry}
            onCountrySelect={setSelectedCountry}
            onReset={handleReset}
          />
        )}
      </div>

      {/* Main Map Area */}
      <div className="relative h-full w-full overflow-hidden">
        <SupplyChainMap
          countryRisks={resolvedCountryRisks}
          onCountrySelect={setSelectedCountry}
          selectedCountry={selectedCountry}
          customRoute={customRoute}
          products={mapProducts}
          selectedRouteId={selectedRoute?.id ?? null}
          onRouteClick={handleRouteClick}
          showRiskZones={showRiskZones}
          onAddItemAtCountry={(country, itemType) => {
            setMapAddRequest({ country, itemType })
            setIsProductBuilderOpen(true)
          }}
        />

        {/* Action Buttons */}
        <div className="absolute left-4 top-4 z-10 flex gap-2 stagger-children">
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
        </div>

        {/* Route Builder Panel */}
        <RouteBuilder
          isOpen={isRouteBuilderOpen}
          onClose={() => setIsRouteBuilderOpen(false)}
          countryRisks={countryRisks}
          customRoute={customRoute}
          onRouteChange={setCustomRoute}
        />

        {/* Product Supply Chain Panel */}
        {/* <ProductSupplyChain
          isOpen={isProductBuilderOpen}
          onClose={() => setIsProductBuilderOpen(false)}
          countryRisks={countryRisks}
          products={products}
          onProductsChange={setProducts}
          onAddToInventory={handleAddToInventory}
          inventoryProductIds={inventoryProducts.map((p) => p.id)}
          mapAddRequest={mapAddRequest}
          onMapAddRequestHandled={() => setMapAddRequest(null)}
        /> */}

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
      </div>
    </div>
  )
}
