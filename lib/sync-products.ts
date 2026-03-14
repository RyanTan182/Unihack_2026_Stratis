import type { StoredProduct, DecompositionTree, SupplyChainNode } from "@/lib/decompose/types"
import type { Product, SupplyChainItem } from "@/components/product-supply-chain"

const PRODUCT_COLORS = [
  "#06b6d4", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#ef4444",
]

type ItemType = "product" | "component" | "material" | "resource"

function topCountry(node: SupplyChainNode): string {
  const entries = Object.entries(node.geographic_concentration)
  if (entries.length === 0) return "China"
  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0]
}

function mapNodeType(type: SupplyChainNode["type"]): ItemType {
  switch (type) {
    case "product": return "product"
    case "subsystem":
    case "component": return "component"
    case "material": return "material"
    case "geography": return "resource"
  }
}

function convertNode(node: SupplyChainNode, tree: DecompositionTree): SupplyChainItem {
  return {
    id: node.id,
    name: node.name,
    type: mapNodeType(node.type),
    country: topCountry(node),
    riskPrediction: node.risk_score,
    riskDirection: node.risk_score >= 50 ? "up" : "down",
    children: node.children
      .map((childId) => tree.nodes[childId])
      .filter(Boolean)
      .map((child) => convertNode(child, tree)),
    isExpanded: true,
  }
}

export function storedProductToProduct(stored: StoredProduct, index: number): Product {
  const tree = stored.tree
  const root = tree.nodes[tree.root_id]

  if (!root) {
    return {
      id: stored.id,
      name: stored.name,
      type: "product",
      country: "China",
      color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
      riskPrediction: 0,
      riskDirection: "down",
      components: [],
    }
  }

  return {
    id: stored.id,
    name: stored.name || root.name,
    type: "product",
    country: topCountry(root),
    color: PRODUCT_COLORS[index % PRODUCT_COLORS.length],
    riskPrediction: root.risk_score,
    riskDirection: root.risk_score >= 50 ? "up" : "down",
    components: root.children
      .map((childId) => tree.nodes[childId])
      .filter(Boolean)
      .map((child) => convertNode(child, tree)),
  }
}

export function syncStoredToProducts(
  storedProducts: StoredProduct[],
  existingProducts: Product[],
): Product[] {
  const existingIds = new Set(existingProducts.map((p) => p.id))
  const inventoryIds = new Set(storedProducts.map((sp) => sp.id))

  const kept = existingProducts.filter((p) => inventoryIds.has(p.id))

  const newProducts = storedProducts
    .filter((sp) => !existingIds.has(sp.id))
    .map((sp, i) => storedProductToProduct(sp, kept.length + i))

  return [...kept, ...newProducts]
}
