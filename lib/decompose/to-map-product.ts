/**
 * Transforms StoredProduct (from decomposition) into the map Product format
 * used by SupplyChainMap for rendering routes and markers.
 */

import type { StoredProduct, SupplyChainNode, DecompositionTree } from "./types"
import { normalizeCountryName } from "./country-aliases"

// Map Product / SupplyChainItem types for the map
export type MapItemType = "product" | "component" | "material" | "resource"

export interface MapSupplyChainItem {
  id: string
  name: string
  type: MapItemType
  country: string
  riskPrediction: number
  riskDirection: "up" | "down"
  children: MapSupplyChainItem[]
  isPredicted?: boolean
  confidence?: number
}

export interface MapProduct {
  id: string
  name: string
  type: "product"
  country: string
  color: string
  riskPrediction: number
  riskDirection: "up" | "down"
  components: MapSupplyChainItem[]
  isPredicted?: boolean
}

const PRODUCT_COLORS = [
  "#06b6d4", // Cyan
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#ef4444", // Red
]

// Countries that exist in nodeCoordinates / countryRisks - used to filter
const KNOWN_COUNTRIES = new Set([
  "China", "United States", "Germany", "India", "Vietnam", "Brazil", "Indonesia",
  "Japan", "South Korea", "Mexico", "Russia", "Ukraine", "Taiwan", "Saudi Arabia",
  "South Africa", "Turkey", "Thailand", "Malaysia", "Singapore", "Netherlands",
  "United Kingdom", "France", "Italy", "Spain", "Australia", "Canada", "Egypt",
  "Nigeria", "Argentina", "Chile", "Poland", "Bangladesh", "Pakistan", "Philippines",
  "Iran", "Panama", "United Arab Emirates", "Oman", "Qatar", "Yemen", "Congo",
  "Czechia", "Georgia", "Greece", "Bulgaria", "Romania", "Djibouti", "Peru", "Ethiopia",
  // New countries
  "Zambia", "Zimbabwe", "Morocco", "Kazakhstan", "Mongolia", "Tanzania", "Kenya",
  "Angola", "Ghana", "Namibia", "Myanmar", "Sudan", "Colombia", "Slovakia", "South Sudan",
])

function getTopCountry(geographicConcentration: Record<string, number>): string | null {
  const entries = Object.entries(geographicConcentration)
  if (entries.length === 0) return null
  const sorted = entries.sort((a, b) => b[1] - a[1])
  for (const [country] of sorted) {
    const normalized = normalizeCountryName(country)
    if (KNOWN_COUNTRIES.has(normalized)) return normalized
  }
  // Fallback: use first country even if not in known list (route may not render)
  return normalizeCountryName(sorted[0][0])
}

function mapNodeType(nodeType: SupplyChainNode["type"]): MapItemType {
  switch (nodeType) {
    case "product":
    case "subsystem":
      return "component"
    case "component":
      return "component"
    case "material":
      return "material"
    case "geography":
      return "resource"
    default:
      return "component"
  }
}

function nodeToSupplyChainItem(
  node: SupplyChainNode,
  tree: DecompositionTree
): MapSupplyChainItem | null {
  const country = getTopCountry(node.geographic_concentration)
  if (!country) return null

  // Determine if this is a probabilistic/predicted supplier
  const isPredicted = node.status === "inferred" || node.status === "searching"
  const confidence = node.confidence ?? 0.5

  // Calculate risk direction based on risk score and confidence
  const riskDirection = node.risk_score >= 50 ? "up" : "down"

  const children: MapSupplyChainItem[] = []

  for (const childId of node.children) {
    const child = tree.nodes[childId]
    if (!child) continue
    const childItem = nodeToSupplyChainItem(child, tree)
    if (childItem) children.push(childItem)
  }

  return {
    id: node.id,
    name: node.name,
    type: mapNodeType(node.type),
    country,
    riskPrediction: node.risk_score,
    riskDirection,
    children,
    isPredicted,
    confidence,
  }
}

/**
 * Converts a StoredProduct from the decomposition pipeline into the map Product format.
 * @param stored - The stored product with decomposition tree
 * @param colorIndex - Index for picking a color from the palette
 */
export function storedProductToMapProduct(
  stored: StoredProduct,
  colorIndex: number
): MapProduct | null {
  const { tree } = stored
  const rootNode = tree.nodes[tree.root_id]
  if (!rootNode) return null

  const rootCountry = getTopCountry(rootNode.geographic_concentration)
  if (!rootCountry) return null

  const components: MapSupplyChainItem[] = []
  for (const childId of rootNode.children) {
    const child = tree.nodes[childId]
    if (!child) continue
    const item = nodeToSupplyChainItem(child, tree)
    if (item) components.push(item)
  }

  const isPredicted = tree.phase !== "verified"
  const color = PRODUCT_COLORS[colorIndex % PRODUCT_COLORS.length]

  return {
    id: stored.id,
    name: stored.name,
    type: "product",
    country: rootCountry,
    color,
    riskPrediction: rootNode.risk_score,
    riskDirection: rootNode.risk_score >= 50 ? "up" : "down",
    components,
    isPredicted,
  }
}
