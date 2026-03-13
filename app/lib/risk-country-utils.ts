// app/lib/risk-country-utils.ts
type ItemType = "product" | "component" | "material" | "resource"

interface SupplyChainItem {
  id: string
  name: string
  type: ItemType
  country: string
  riskPrediction: number
  riskDirection: "up" | "down"
  children: SupplyChainItem[]
  isExpanded?: boolean
}

interface Product {
  id: string
  name: string
  type: "product"
  country: string
  color: string
  riskPrediction: number
  riskDirection: "up" | "down"
  components: SupplyChainItem[]
}

interface CountryRiskNode {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

export function collectCountriesFromProducts(products: Product[]): string[] {
  const set = new Set<string>()

  function walk(item: SupplyChainItem) {
    set.add(item.country)
    item.children.forEach(walk)
  }

  products.forEach((product) => {
    set.add(product.country)
    product.components.forEach(walk)
  })

  return Array.from(set)
}

export function buildCountryInputsFromProducts(
  products: Product[],
  nodes: CountryRiskNode[]
) {
  const countryIds = collectCountriesFromProducts(products)

  return countryIds
    .map((id) => nodes.find((n) => n.id === id && n.type === "country"))
    .filter(Boolean)
    .map((node) => ({
      nodeId: node!.id,
      nodeName: node!.name,
      connections: node!.connections,
    }))
}