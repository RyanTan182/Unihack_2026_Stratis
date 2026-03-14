// app/api/predict-mock/_store.ts
// Shared in-memory store for mock simulations

export interface MockSimulation {
  scenario: string
  countries: string[]
  startedAt: number
  totalRounds: number
}

export const mockSimulations = new Map<string, MockSimulation>()

// Simulation progresses 1 round per second
const ROUND_DURATION_MS = 1000

export function getMockRound(sim: MockSimulation): {
  currentRound: number
  isCompleted: boolean
} {
  const elapsed = Date.now() - sim.startedAt
  const currentRound = Math.min(
    sim.totalRounds,
    Math.floor(elapsed / ROUND_DURATION_MS)
  )
  return {
    currentRound,
    isCompleted: currentRound >= sim.totalRounds,
  }
}
