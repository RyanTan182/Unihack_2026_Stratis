/**
 * Shared alert generation from products and country risks.
 * Used by AlertBanner and AlertsSidebar.
 */

const HIGH_RISK_THRESHOLD = 60

interface SupplyChainItemLike {
  id: string
  name: string
  country: string
  children?: SupplyChainItemLike[]
}

interface ProductLike {
  id: string
  name: string
  components: SupplyChainItemLike[]
}

interface CountryRiskLike {
  id: string
  name: string
  overallRisk: number
}

export interface AlertComponentDetail {
  componentName: string
  /** One or more (country, risk) - grouped when same component from multiple countries */
  locations: { country: string; risk: number }[]
}

export interface AlertData {
  id: string
  productId: string
  productName: string
  type: "high_risk"
  severity: "warning" | "critical"
  title: string
  description: string
  /** Percentage of supply chain nodes that pass through high-risk countries */
  simulationPercent: number
  /** Expandable: component, country, risk for each high-risk node */
  details: AlertComponentDetail[]
  action?: string
  relatedComponentId?: string
}

/** Country-grouped view: country → products (with components) */
export interface AlertByCountry {
  country: string
  risk: number
  severity: "warning" | "critical"
  products: {
    productId: string
    productName: string
    components: string[]
    /** First alert for this product (for onAlertClick) */
    alert: AlertData
  }[]
}

export function groupAlertsByCountry(alerts: AlertData[]): AlertByCountry[] {
  const byCountry = new Map<
    string,
    { risk: number; products: Map<string, { productName: string; components: Set<string>; alert: AlertData }> }
  >()

  for (const alert of alerts) {
    for (const d of alert.details) {
      for (const loc of d.locations) {
        const existing = byCountry.get(loc.country)
        const severity = alert.severity
        if (!existing) {
          byCountry.set(loc.country, {
            risk: loc.risk,
            products: new Map([
              [
                alert.productId,
                {
                  productName: alert.productName,
                  components: new Set([d.componentName]),
                  alert,
                },
              ],
            ]),
          })
        } else {
          existing.risk = Math.max(existing.risk, loc.risk)
          const prod = existing.products.get(alert.productId)
          if (!prod) {
            existing.products.set(alert.productId, {
              productName: alert.productName,
              components: new Set([d.componentName]),
              alert,
            })
          } else {
            prod.components.add(d.componentName)
          }
        }
      }
    }
  }

  return Array.from(byCountry.entries())
    .map(([country, data]) => ({
      country,
      risk: data.risk,
      severity: data.risk >= 70 ? "critical" : "warning",
      products: Array.from(data.products.values()).map((p) => ({
        productId: p.alert.productId,
        productName: p.productName,
        components: Array.from(p.components),
        alert: p.alert,
      })),
    }))
    .sort((a, b) => b.risk - a.risk)
}

function flattenComponents(
  items: SupplyChainItemLike[]
): { id: string; name: string; country: string }[] {
  const out: { id: string; name: string; country: string }[] = []
  const walk = (list: SupplyChainItemLike[]) => {
    for (const item of list) {
      out.push({ id: item.id, name: item.name, country: item.country })
      if (item.children?.length) walk(item.children)
    }
  }
  walk(items)
  return out
}

function getCountryRisk(country: string, countryRisks: CountryRiskLike[]): number {
  const r = countryRisks.find((c) => c.id === country || c.name === country)
  return r?.overallRisk ?? 0
}

export function generateAlertsFromProducts(
  products: ProductLike[],
  countryRisks: CountryRiskLike[]
): AlertData[] {
  if (!products?.length || !countryRisks?.length) return []

  const alerts: AlertData[] = []

  for (const product of products) {
    const allNodes = flattenComponents(product.components)
    if (allNodes.length === 0) continue

    // Collect high-risk nodes, dedupe by (name, country), then group by name
    const byKey = new Map<string, { country: string; risk: number }[]>()
    let firstHighRiskId: string | undefined
    const seenKeys = new Set<string>()
    for (const node of allNodes) {
      const risk = getCountryRisk(node.country, countryRisks)
      if (risk >= HIGH_RISK_THRESHOLD) {
        if (!firstHighRiskId) firstHighRiskId = node.id
        const key = `${node.name}|${node.country}`
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        const arr = byKey.get(node.name) ?? []
        arr.push({ country: node.country, risk })
        byKey.set(node.name, arr)
      }
    }
    const highRiskDetails: AlertComponentDetail[] = Array.from(byKey.entries()).map(
      ([componentName, locations]) => ({ componentName, locations })
    )

    if (highRiskDetails.length === 0) continue

    const simulationPercent = Math.round(
      (highRiskDetails.length / allNodes.length) * 100
    )
    const severity = simulationPercent >= 50 ? "critical" : "warning"

    alerts.push({
      id: `product-high-risk-${product.id}`,
      productId: product.id,
      productName: product.name,
      type: "high_risk",
      severity,
      title: product.name,
      description: `Your product ${product.name} goes through several high risk countries in ${simulationPercent}% of our simulations.`,
      simulationPercent,
      details: highRiskDetails,
      action: "View alternatives",
      relatedComponentId: firstHighRiskId,
    })
  }

  return alerts
}
