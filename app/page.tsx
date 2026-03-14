"use client"

import { useState, useEffect, useMemo } from "react"
import { NavSidebar } from "@/components/nav-sidebar"
import { RiskSidebar } from "@/components/risk-sidebar"
import { InventorySidebar } from "@/components/inventory-sidebar"
import { SupplyChainMap, type ProductSupplyRoute } from "@/components/supply-chain-map"
import type { ItemType } from "@/components/supply-chain-map"
import { RouteBuilder, type CustomRoute } from "@/components/route-builder"
import { ProductSupplyChain, type Product } from "@/components/product-supply-chain"
import type { StoredProduct, DecompositionTree } from "@/lib/decompose/types"
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
import { collectCountriesFromProducts } from "./lib/risk-country-utils"
import { getChokepointRisk } from "@/lib/chokepoints"
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
    importRisk: 42,
    exportRisk: 48,
    overallRisk: 45,
    newsHighlights: [
      "Port operations experiencing delays",
      "Mining sector exports fluctuating",
      "Load shedding, labor unrest, inequality",
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
    importRisk: 42,
    exportRisk: 48,
    overallRisk: 45,
    newsHighlights: [
      "Suez Canal operations normal",
      "Regional tensions monitoring",
      "Debt burden, labor rights concerns",
    ],
  },
  {
    id: "Nigeria",
    name: "Nigeria",
    type: "country",
    connections: ["Bab-el-Mandeb"],
    importRisk: 52,
    exportRisk: 58,
    overallRisk: 55,
    newsHighlights: [
      "Oil exports facing logistics challenges",
      "Currency volatility high",
      "Corruption, security in north, weak labor enforcement",
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
    importRisk: 38,
    exportRisk: 42,
    overallRisk: 40,
    newsHighlights: [
      "Important Red Sea logistics location",
      "Strategic shipping and port relevance remains elevated",
      "Heavy China debt dependency",
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
    importRisk: 48,
    exportRisk: 52,
    overallRisk: 50,
    newsHighlights: [
      "Trade access highly dependent on external port routes",
      "Logistics resilience tied to Red Sea corridor stability",
      "Conflict, debt, landlocked, labor rights concerns",
    ],
  },
  {
    id: "Congo",
    name: "Congo",
    type: "country",
    connections: ["South Africa", "Nigeria", "Bab-el-Mandeb", "Zambia", "Angola"],
    importRisk: 55,
    exportRisk: 70,
    overallRisk: 65,
    newsHighlights: [
      "Major cobalt and mineral producer",
      "Conflict, governance and child labor concerns in mining",
      "Supply chain opacity for battery materials",
    ],
  },
  {
    id: "Czechia",
    name: "Czechia",
    type: "country",
    connections: ["Germany", "Poland", "Austria", "Hungary"],
    importRisk: 15,
    exportRisk: 15,
    overallRisk: 15,
    newsHighlights: [
      "EU member, stable manufacturing hub",
      "Auto and electronics supply chain",
    ],
  },
  {
    id: "Congo",
    name: "Congo",
    type: "country",
    connections: ["South Africa", "Nigeria", "Bab-el-Mandeb", "Zambia", "Angola"],
    importRisk: 65,
    exportRisk: 78,
    overallRisk: 72,
    newsHighlights: [
      "Major cobalt and mineral producer",
      "Child labor, forced labor in artisanal mining",
      "Conflict, governance failure, supply chain opacity",
    ],
  },
  {
    id: "Zambia",
    name: "Zambia",
    type: "country",
    connections: ["Congo", "South Africa", "Zimbabwe", "Tanzania"],
    importRisk: 50,
    exportRisk: 58,
    overallRisk: 55,
    newsHighlights: ["Major copper and cobalt producer", "Child labor in mining, debt, China dependency"],
  },
  {
    id: "Zimbabwe",
    name: "Zimbabwe",
    type: "country",
    connections: ["South Africa", "Zambia"],
    importRisk: 70,
    exportRisk: 80,
    overallRisk: 75,
    newsHighlights: ["Lithium reserves growing", "Sanctions, currency collapse, weak labor rights"],
  },
  {
    id: "Morocco",
    name: "Morocco",
    type: "country",
    connections: ["Spain", "Suez Canal"],
    importRisk: 38,
    exportRisk: 45,
    overallRisk: 42,
    newsHighlights: ["World's largest phosphate exporter", "Western Sahara tensions, informal labor"],
  },
  {
    id: "Kazakhstan",
    name: "Kazakhstan",
    type: "country",
    connections: ["Russia", "China", "Iran"],
    importRisk: 45,
    exportRisk: 50,
    overallRisk: 48,
    newsHighlights: ["Uranium and critical minerals", "Russia dependency, political transition risk"],
  },
  {
    id: "Mongolia",
    name: "Mongolia",
    type: "country",
    connections: ["China", "Russia"],
    importRisk: 50,
    exportRisk: 55,
    overallRisk: 52,
    newsHighlights: ["Copper and coal exports", "Heavy China dependency, mining-dependent economy"],
  },
  {
    id: "Tanzania",
    name: "Tanzania",
    type: "country",
    connections: ["Kenya", "South Africa", "Bab-el-Mandeb", "Zambia"],
    importRisk: 48,
    exportRisk: 55,
    overallRisk: 52,
    newsHighlights: ["Critical minerals producer", "Resource nationalism, child labor in mining"],
  },
  {
    id: "Kenya",
    name: "Kenya",
    type: "country",
    connections: ["Tanzania", "Djibouti", "Bab-el-Mandeb"],
    importRisk: 48,
    exportRisk: 52,
    overallRisk: 50,
    newsHighlights: ["East African logistics hub", "Debt, corruption, informal labor"],
  },
  {
    id: "Angola",
    name: "Angola",
    type: "country",
    connections: ["Congo", "South Africa", "Nigeria", "Namibia"],
    importRisk: 60,
    exportRisk: 65,
    overallRisk: 63,
    newsHighlights: ["Oil and diamond exports", "Corruption, weak labor rights, oil dependency"],
  },
  {
    id: "Ghana",
    name: "Ghana",
    type: "country",
    connections: ["Nigeria", "Bab-el-Mandeb"],
    importRisk: 52,
    exportRisk: 58,
    overallRisk: 55,
    newsHighlights: ["Gold and cocoa exports", "Child labor in cocoa, debt restructuring"],
  },
  {
    id: "Bolivia",
    name: "Bolivia",
    type: "country",
    connections: ["Chile", "Peru", "Brazil", "Argentina"],
    importRisk: 45,
    exportRisk: 55,
    overallRisk: 50,
    newsHighlights: ["Major lithium reserves", "Resource nationalism, political volatility"],
  },
  {
    id: "Colombia",
    name: "Colombia",
    type: "country",
    connections: ["Panama", "Brazil", "Peru", "Panama Canal"],
    importRisk: 35,
    exportRisk: 40,
    overallRisk: 38,
    newsHighlights: ["Coffee and mineral exports", "Pacific and Atlantic access", "Security improving"],
  },
  {
    id: "Namibia",
    name: "Namibia",
    type: "country",
    connections: ["South Africa", "Angola", "Bab-el-Mandeb"],
    importRisk: 35,
    exportRisk: 42,
    overallRisk: 38,
    newsHighlights: ["Uranium and diamond producer", "Mining labor concerns, inequality"],
  },
  {
    id: "New Zealand",
    name: "New Zealand",
    type: "country",
    connections: ["Australia", "Indonesia", "Strait of Malacca"],
    importRisk: 10,
    exportRisk: 12,
    overallRisk: 10,
    newsHighlights: ["Dairy and agriculture exports", "Pacific trade routes", "Low risk jurisdiction"],
  },
  {
    id: "Belgium",
    name: "Belgium",
    type: "country",
    connections: ["Netherlands", "France", "Germany"],
    importRisk: 12,
    exportRisk: 15,
    overallRisk: 12,
    newsHighlights: ["EU logistics hub", "Antwerp port critical"],
  },
  {
    id: "Sweden",
    name: "Sweden",
    type: "country",
    connections: ["Germany", "Poland", "Netherlands"],
    importRisk: 8,
    exportRisk: 10,
    overallRisk: 8,
    newsHighlights: ["Battery and EV manufacturing", "Nordic supply chain hub", "Low risk"],
  },
  {
    id: "Austria",
    name: "Austria",
    type: "country",
    connections: ["Germany", "Italy", "Czechia", "Hungary"],
    importRisk: 10,
    exportRisk: 12,
    overallRisk: 10,
    newsHighlights: ["Central European logistics", "Alpine trade routes", "EU stable"],
  },
  {
    id: "Portugal",
    name: "Portugal",
    type: "country",
    connections: ["Spain", "Suez Canal"],
    importRisk: 18,
    exportRisk: 22,
    overallRisk: 20,
    newsHighlights: ["Atlantic port access", "EU trade gateway"],
  },
  {
    id: "Hungary",
    name: "Hungary",
    type: "country",
    connections: ["Austria", "Romania", "Ukraine", "Czechia"],
    importRisk: 40,
    exportRisk: 45,
    overallRisk: 42,
    newsHighlights: ["Central European manufacturing", "EV battery production", "EU rule-of-law concerns"],
  },
  {
    id: "Myanmar",
    name: "Myanmar",
    type: "country",
    connections: ["Thailand", "India", "Bangladesh", "Strait of Malacca"],
    importRisk: 70,
    exportRisk: 80,
    overallRisk: 75,
    newsHighlights: ["Rare earth elements", "Civil conflict, junta rule, sanctions risk"],
  },
  {
    id: "Sri Lanka",
    name: "Sri Lanka",
    type: "country",
    connections: ["India", "Strait of Malacca"],
    importRisk: 55,
    exportRisk: 60,
    overallRisk: 58,
    newsHighlights: ["Indian Ocean shipping hub", "2022 default, debt restructuring ongoing"],
  },

  // chokepoints
  {
    id: "Suez Canal",
    name: "Suez Canal",
    type: "chokepoint",
    connections: ["Bab-el-Mandeb", "Egypt", "Greece", "Italy", "France", "Netherlands", "Germany", "Turkey"],
    importRisk: 0,
    exportRisk: 0,
    overallRisk: getChokepointRisk("Suez Canal"),
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
    overallRisk: getChokepointRisk("Panama Canal"),
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
    overallRisk: getChokepointRisk("Strait of Hormuz"),
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
    overallRisk: getChokepointRisk("Strait of Malacca"),
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
    overallRisk: getChokepointRisk("Bab-el-Mandeb"),
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
    overallRisk: getChokepointRisk("Bosphorus"),
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
          `Import → tariff ${snapshot.importFactors.tariff.score}, conflict ${snapshot.importFactors.conflict.score}, policy ${snapshot.importFactors.policy.score}${snapshot.importFactors.labor != null ? `, labor ${snapshot.importFactors.labor.score}` : ""}`,
          `Export → tariff ${snapshot.exportFactors.tariff.score}, conflict ${snapshot.exportFactors.conflict.score}, policy ${snapshot.exportFactors.policy.score}${snapshot.exportFactors.labor != null ? `, labor ${snapshot.exportFactors.labor.score}` : ""}`,
        ],
      }
    })
  }, [countryRisks, riskSnapshots])

  // Merge decomposed products (from inventory) with manually added products for the map
  const mapProducts = useMemo(() => {
    const fromDecomposition = storedProducts
      .map((stored, i) => storedProductToMapProduct(stored, i))
      .filter((p): p is NonNullable<typeof p> => p !== null)
    const productIds = new Set(products.map((p) => p.id))
    // Prefer products list (has destinationCountry); add decomposition-only items to avoid duplicates
    return [...products, ...fromDecomposition.filter((p) => !productIds.has(p.id))]
  }, [storedProducts, products])

  // Filter products to selected node subtree (path from root + selected + children)
  const filteredMapProducts = useMemo(() => {
    if (!selectedDecompNodeId) return mapProducts

    function findPathToNode<T extends { id: string; children: T[] }>(
      items: T[],
      targetId: string
    ): T[] | null {
      for (const item of items) {
        if (item.id === targetId || item.id.startsWith(targetId + "-")) {
          return [item]
        }
        const childPath = findPathToNode(item.children, targetId)
        if (childPath) {
          return [{ ...item, children: childPath }]
        }
      }
      return null
    }

    const filtered: typeof mapProducts = []
    for (const product of mapProducts) {
      const path = findPathToNode(product.components, selectedDecompNodeId)
      if (path && path.length > 0) {
        filtered.push({ ...product, components: path })
      }
    }
    return filtered.length > 0 ? filtered : mapProducts
  }, [mapProducts, selectedDecompNodeId])

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

  const handleProductAdd = (stored: StoredProduct) => {
    setStoredProducts((prev) => [...prev, stored])
    // Also add to Product Supply Chain list so it appears in insights, route finder, etc.
    const mapProduct = storedProductToMapProduct(stored, storedProducts.length)
    if (mapProduct) {
      const product: Product = {
        ...mapProduct,
        destinationCountry: "United States",
      }
      setProducts((prev) => [...prev, product])
    }
  }

  const handleTreeChange = (tree: DecompositionTree | null) => {
    setActiveTree(tree)
  }

  const handleNodeSelect = (nodeId: string | null) => {
    setSelectedDecompNodeId(nodeId)
  }

  const handleAddToInventory = (product: Product) => {
    setIsInventorySidebarOpen(true)
  }

  const handleToggleInventory = () => {
    setIsInventorySidebarOpen((prev) => !prev)
  }

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
    <div className="grid h-screen w-full grid-cols-[56px_320px_1fr] overflow-hidden bg-background animate-page-load">
      {/* Left Navigation Sidebar */}
      <NavSidebar
        onInventoryClick={handleToggleInventory}
        isInventoryOpen={isInventorySidebarOpen}
        onLocationClick={() => setIsInventorySidebarOpen(false)}
        isLocationActive={!isInventorySidebarOpen}
      />

      {/* Left-side panel: either Inventory or Supply Chain Crisis (Risk) */}
      <div className="min-h-0 overflow-hidden animate-in fade-in-0 slide-in-from-left-2 duration-500">
      {isInventorySidebarOpen ? (
        <InventorySidebar
          products={storedProducts}
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
      <div className="relative h-full w-full overflow-hidden animate-map-in">
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
          products={filteredMapProducts}
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
        <div className="absolute left-4 top-4 z-10 flex gap-2 stagger-children-delayed">
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
