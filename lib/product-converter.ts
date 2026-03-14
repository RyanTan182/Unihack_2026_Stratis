// lib/product-converter.ts
// Conversion utilities between StoredProduct (AI-decomposed) and Product (manual) types

import type { StoredProduct, DecompositionTree, SupplyChainNode } from "@/lib/decompose/types"

// Product types from product-supply-chain.tsx
export type ItemType = "product" | "component" | "material" | "resource"

export interface SupplyChainItem {
  id: string
  name: string
  type: ItemType
  country: string
  riskPrediction: number
  riskDirection: "up" | "down"
  children: SupplyChainItem[]
  isExpanded?: boolean
}

export interface ConvertedProduct {
  id: string
  name: string
  type: "product"
  country: string
  destinationCountry: string
  color: string
  riskPrediction: number
  riskDirection: "up" | "down"
  components: SupplyChainItem[]
  sourceProductId: string // Track origin
}

// Product color palette
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

// Map decomposition node type to ItemType
function mapNodeType(type: SupplyChainNode["type"]): ItemType {
  switch (type) {
    case "product":
      return "product"
    case "subsystem":
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

// Get the primary country from geographic concentration
function getPrimaryCountry(geoConcentration: Record<string, number>): string {
  const entries = Object.entries(geoConcentration)
  if (entries.length === 0) return "Unknown"

  // Sort by percentage descending
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

// Convert a single node and its children to SupplyChainItem
function convertNode(
  node: SupplyChainNode,
  tree: DecompositionTree,
  depth: number = 0
): SupplyChainItem {
  const country = getPrimaryCountry(node.geographic_concentration)
  const riskDirection = node.risk_score >= 50 ? "up" : "down"

  // Convert children recursively
  const children = node.children
    .map(childId => tree.nodes[childId])
    .filter(Boolean)
    .map(childNode => convertNode(childNode, tree, depth + 1))

  return {
    id: node.id,
    name: node.name,
    type: mapNodeType(node.type),
    country,
    riskPrediction: node.risk_score,
    riskDirection,
    children,
    isExpanded: depth < 2,
  }
}

// Get color based on product index
function getProductColor(index: number): string {
  return PRODUCT_COLORS[index % PRODUCT_COLORS.length]
}

/**
 * Convert a StoredProduct (from AI decomposition) to ConvertedProduct format
 * compatible with the Product Builder and Insights systems
 */
export function convertStoredProductToProduct(
  storedProduct: StoredProduct,
  index: number = 0
): ConvertedProduct {
  const tree = storedProduct.tree
  const rootNode = tree.nodes[tree.root_id]

  // Convert the tree structure
  const components = rootNode
    ? rootNode.children
        .map(childId => tree.nodes[childId])
        .filter(Boolean)
        .map(node => convertNode(node, tree, 0))
    : []

  // Calculate overall product risk
  const avgRisk = components.length > 0
    ? Math.round(components.reduce((sum, c) => sum + c.riskPrediction, 0) / components.length)
    : rootNode?.risk_score ?? 30

  const riskDirection = avgRisk >= 50 ? "up" : "down"

  return {
    id: `converted-${storedProduct.id}`,
    name: storedProduct.name,
    type: "product",
    country: components[0]?.country ?? "Unknown",
    destinationCountry: storedProduct.destinationCountry || "United States",
    color: getProductColor(index),
    riskPrediction: avgRisk,
    riskDirection,
    components,
    sourceProductId: storedProduct.id,
  }
}

/**
 * Extract high-risk countries from a StoredProduct for route finding
 */
export function extractHighRiskCountries(
  storedProduct: StoredProduct,
  threshold: number = 60
): Array<{ nodeId: string; nodeName: string; country: string; risk: number }> {
  const highRisk: Array<{ nodeId: string; nodeName: string; country: string; risk: number }> = []

  function traverseNode(node: SupplyChainNode, tree: DecompositionTree) {
    if (node.risk_score >= threshold) {
      const country = getPrimaryCountry(node.geographic_concentration)
      highRisk.push({
        nodeId: node.id,
        nodeName: node.name,
        country,
        risk: node.risk_score,
      })
    }

    // Traverse children
    node.children.forEach(childId => {
      const child = tree.nodes[childId]
      if (child) traverseNode(child, tree)
    })
  }

  const rootNode = storedProduct.tree.nodes[storedProduct.tree.root_id]
  if (rootNode) {
    traverseNode(rootNode, storedProduct.tree)
  }

  return highRisk.sort((a, b) => b.risk - a.risk)
}

/**
 * Convert a DecompositionTree directly to Product[] format for analyzeSupplyChain
 * This creates the format expected by lib/supply-chain-analyzer.ts
 */
export function convertTreeToAnalyzerProducts(
  tree: DecompositionTree
): Array<{
  id: string
  name: string
  country: string
  destinationCountry?: string
  components: Array<{
    id: string
    name: string
    type: 'product' | 'component' | 'material' | 'resource'
    country: string
    parentDestination?: string
    children?: Array<{
      id: string
      name: string
      type: 'product' | 'component' | 'material' | 'resource'
      country: string
    }>
  }>
}> {
  const rootNode = tree.nodes[tree.root_id]
  if (!rootNode) return []

  // Convert node to analyzer's SupplyChainItem format
  const convertNodeToItem = (node: SupplyChainNode): {
    id: string
    name: string
    type: 'product' | 'component' | 'material' | 'resource'
    country: string
    parentDestination?: string
    children?: Array<{
      id: string
      name: string
      type: 'product' | 'component' | 'material' | 'resource'
      country: string
    }>
  } => {
    const country = getPrimaryCountry(node.geographic_concentration)
    const itemType: 'product' | 'component' | 'material' | 'resource' = mapNodeType(node.type)

    const children = node.children
      .map(childId => tree.nodes[childId])
      .filter(Boolean)
      .map(childNode => convertNodeToItem(childNode))

    return {
      id: node.id,
      name: node.name,
      type: itemType,
      country,
      children: children.length > 0 ? children : undefined,
    }
  }

  // Get root country
  const rootCountry = getPrimaryCountry(rootNode.geographic_concentration)

  // Convert children as components
  const components = rootNode.children
    .map(childId => tree.nodes[childId])
    .filter(Boolean)
    .map(node => convertNodeToItem(node))

  return [{
    id: tree.root_id,
    name: tree.product,
    country: rootCountry,
    destinationCountry: 'United States',
    components,
  }]
}

/**
 * Get a summary of the supply chain for display
 */
export function getSupplyChainSummary(storedProduct: StoredProduct): {
  totalNodes: number
  highRiskCount: number
  topCountries: Array<{ country: string; count: number }>
  avgRisk: number
} {
  const tree = storedProduct.tree
  const countries: Record<string, number> = {}
  let totalRisk = 0
  let highRiskCount = 0

  Object.values(tree.nodes).forEach(node => {
    const country = getPrimaryCountry(node.geographic_concentration)
    countries[country] = (countries[country] || 0) + 1
    totalRisk += node.risk_score
    if (node.risk_score >= 60) highRiskCount++
  })

  const topCountries = Object.entries(countries)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }))

  return {
    totalNodes: tree.metadata.total_nodes,
    highRiskCount,
    topCountries,
    avgRisk: Math.round(totalRisk / Object.keys(tree.nodes).length),
  }
}
