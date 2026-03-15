// lib/alerts.ts
// Shared alert generation logic for the supply chain risk platform

export interface AlertComponentDetail {
  componentId: string
  componentName: string
  risk: number
  productId?: string
}

export interface AlertData {
  id: string
  type: 'high_risk' | 'price_spike' | 'route_disruption' | 'critical_recommendation'
  severity: 'warning' | 'critical' | 'info'
  title: string
  description: string
  action?: string
  relatedComponentId?: string
  country?: string
  components?: AlertComponentDetail[]
}

export interface AlertByCountry {
  countryId: string
  countryName: string
  overallRisk: number
  alerts: AlertData[]
  affectedProducts: string[]
  affectedComponents: AlertComponentDetail[]
}

/**
 * Generates alerts from products and country risks
 */
export function generateAlertsFromProducts(
  products: Array<{
    id: string
    name: string
    tree: {
      root_id: string
      nodes: Record<string, {
        name: string
        risk_score: number
        geographic_concentration: Record<string, number>
        children: string[]
      }>
    }
  }>,
  countryRisks: Array<{
    id: string
    name: string
    overallRisk: number
  }>
): AlertData[] {
  const alerts: AlertData[] = []
  let alertId = 0

  for (const product of products) {
    const { tree } = product
    const rootNode = tree.nodes[tree.root_id]
    if (!rootNode) continue

    // Check each node for high risk
    for (const [nodeId, node] of Object.entries(tree.nodes)) {
      if (node.risk_score >= 70) {
        const topCountry = Object.keys(node.geographic_concentration)[0] || 'Unknown'
        const countryRisk = countryRisks.find(c => c.name === topCountry || c.id === topCountry)

        alerts.push({
          id: `alert-${++alertId}`,
          type: 'high_risk',
          severity: node.risk_score >= 85 ? 'critical' : 'warning',
          title: `${node.name} - High Risk Supplier`,
          description: `${node.name} from ${topCountry} has ${node.risk_score}% risk. Consider alternative suppliers.`,
          action: 'View alternatives',
          relatedComponentId: nodeId,
          country: topCountry,
          components: [{
            componentId: nodeId,
            componentName: node.name,
            risk: node.risk_score,
            productId: product.id,
          }],
        })
      }
    }
  }

  // Deduplicate alerts by country and type
  const uniqueAlerts = new Map<string, AlertData>()
  for (const alert of alerts) {
    const key = `${alert.type}-${alert.country}`
    if (!uniqueAlerts.has(key)) {
      uniqueAlerts.set(key, alert)
    } else {
      const existing = uniqueAlerts.get(key)!
      // Merge components
      if (alert.components) {
        existing.components = [...(existing.components || []), ...alert.components]
      }
      // Update severity to highest
      if (alert.severity === 'critical' && existing.severity !== 'critical') {
        existing.severity = 'critical'
      }
    }
  }

  return Array.from(uniqueAlerts.values())
}

/**
 * Groups alerts by country for the sidebar view
 */
export function groupAlertsByCountry(
  alerts: AlertData[],
  countryRisks: Array<{
    id: string
    name: string
    overallRisk: number
  }>
): AlertByCountry[] {
  const countryMap = new Map<string, AlertByCountry>()

  for (const alert of alerts) {
    const countryId = alert.country || 'Unknown'
    const countryRisk = countryRisks.find(c => c.name === countryId || c.id === countryId)

    if (!countryMap.has(countryId)) {
      countryMap.set(countryId, {
        countryId,
        countryName: countryRisk?.name || countryId,
        overallRisk: countryRisk?.overallRisk || 0,
        alerts: [],
        affectedProducts: [],
        affectedComponents: [],
      })
    }

    const countryGroup = countryMap.get(countryId)!
    countryGroup.alerts.push(alert)

    if (alert.components) {
      for (const comp of alert.components) {
        if (comp.productId && !countryGroup.affectedProducts.includes(comp.productId)) {
          countryGroup.affectedProducts.push(comp.productId)
        }
        countryGroup.affectedComponents.push(comp)
      }
    }
  }

  // Sort by risk (highest first)
  return Array.from(countryMap.values()).sort((a, b) => b.overallRisk - a.overallRisk)
}
