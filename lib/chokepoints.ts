// lib/chokepoints.ts
// Shared chokepoint risk configuration

export interface ChokepointRisk {
  id: string
  name: string
  risk: number
  description: string
  affectedRoutes: string[]
}

export const CHOKEPOINT_RISKS: ChokepointRisk[] = [
  {
    id: "Strait of Hormuz",
    name: "Strait of Hormuz",
    risk: 78,
    description: "Critical oil and gas transit chokepoint. High geopolitical tension risk.",
    affectedRoutes: ["Middle East to Asia", "Middle East to Europe", "Persian Gulf exports"],
  },
  {
    id: "Bab-el-Mandeb",
    name: "Bab-el-Mandeb",
    risk: 83,
    description: "Southern gateway to Suez Canal. Houthi attacks disrupting traffic.",
    affectedRoutes: ["Europe to Asia via Suez", "East Africa trade"],
  },
  {
    id: "Suez Canal",
    name: "Suez Canal",
    risk: 64,
    description: "Major Europe-Asia shipping corridor. Recent disruptions from Red Sea tensions.",
    affectedRoutes: ["Europe to Asia", "Mediterranean trade"],
  },
  {
    id: "Strait of Malacca",
    name: "Strait of Malacca",
    risk: 61,
    description: "Primary Asia-Pacific shipping lane. Congestion and piracy concerns.",
    affectedRoutes: ["China to Europe", "Asia to Middle East", "Pacific-Indian Ocean transit"],
  },
  {
    id: "Panama Canal",
    name: "Panama Canal",
    risk: 58,
    description: "Atlantic-Pacific connector. Drought conditions affecting capacity.",
    affectedRoutes: ["US East Coast to Asia", "Americas trade", "Atlantic-Pacific transit"],
  },
  {
    id: "Bosphorus",
    name: "Bosphorus",
    risk: 57,
    description: "Black Sea outlet. Regional conflict affecting grain and energy shipments.",
    affectedRoutes: ["Black Sea to Mediterranean", "Russia/Ukraine exports"],
  },
]

/**
 * Get risk data for a specific chokepoint
 */
export function getChokepointRisk(chokepointId: string): ChokepointRisk | undefined {
  return CHOKEPOINT_RISKS.find(cp => cp.id === chokepointId || cp.name === chokepointId)
}

/**
 * Get all chokepoints above a risk threshold
 */
export function getHighRiskChokepoints(threshold: number = 70): ChokepointRisk[] {
  return CHOKEPOINT_RISKS.filter(cp => cp.risk >= threshold)
}

/**
 * Calculate average chokepoint risk along a route
 */
export function calculateRouteChokepointRisk(chokepointIds: string[]): number {
  if (chokepointIds.length === 0) return 0
  const risks = chokepointIds
    .map(id => getChokepointRisk(id))
    .filter(Boolean)
    .map(cp => cp!.risk)
  if (risks.length === 0) return 0
  return Math.round(risks.reduce((sum, r) => sum + r, 0) / risks.length)
}
