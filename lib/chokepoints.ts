/**
 * Shared chokepoint configuration. Risk values are sourced from analysis
 * and can be updated when real-time evaluation is available.
 */

export interface ChokepointConfig {
  id: string
  name: string
  risk: number
}

export const CHOKEPOINT_RISKS: Record<string, number> = {
  "Strait of Hormuz": 78,
  "Bab-el-Mandeb": 83,
  "Suez Canal": 64,
  "Strait of Malacca": 61,
  "Panama Canal": 58,
  "Bosphorus": 57,
}

export function getChokepointRisk(chokepointId: string): number {
  return CHOKEPOINT_RISKS[chokepointId] ?? 0
}
