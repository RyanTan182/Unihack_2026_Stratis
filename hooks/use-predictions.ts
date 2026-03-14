// hooks/use-predictions.ts

"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import type {
  SimulationStatus,
  PredictionResult,
  TriggerResponse,
} from "@/lib/mirofish/types"

interface ActivePrediction {
  simulationId: string
  scenario: string
  countries: string[]
  status: SimulationStatus | null
}

interface PredictionsState {
  activePredictions: ActivePrediction[]
  completedPredictions: PredictionResult[]
  isTriggering: boolean
  error: string | null
}

const POLL_INTERVAL_MS = 5000

export function usePredictions() {
  const [state, setState] = useState<PredictionsState>({
    activePredictions: [],
    completedPredictions: [],
    isTriggering: false,
    error: null,
  })
  const pollTimers = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Poll a single simulation's status
  const pollStatus = useCallback((simulationId: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/predict/status?simulationId=${simulationId}`)
        if (!res.ok) return

        const status: SimulationStatus = await res.json()

        setState((prev) => ({
          ...prev,
          activePredictions: prev.activePredictions.map((p) =>
            p.simulationId === simulationId ? { ...p, status } : p
          ),
        }))

        // If completed, fetch results and move to completed list
        if (status.status === "completed") {
          // Stop polling
          const timer = pollTimers.current.get(simulationId)
          if (timer) {
            clearInterval(timer)
            pollTimers.current.delete(simulationId)
          }

          // Fetch results
          try {
            const resultsRes = await fetch(
              `/api/predict/results?simulationId=${simulationId}`
            )
            if (resultsRes.ok) {
              const result: PredictionResult = await resultsRes.json()
              setState((prev) => ({
                ...prev,
                activePredictions: prev.activePredictions.filter(
                  (p) => p.simulationId !== simulationId
                ),
                completedPredictions: [result, ...prev.completedPredictions],
              }))
            }
          } catch {
            // Results will be fetched on next attempt
          }
        }

        // If failed or timed out, stop polling
        if (status.status === "failed" || status.status === "timed_out") {
          const timer = pollTimers.current.get(simulationId)
          if (timer) {
            clearInterval(timer)
            pollTimers.current.delete(simulationId)
          }
        }
      } catch {
        // Polling error — will retry on next interval
      }
    }

    // Immediate first poll, then interval
    poll()
    const timer = setInterval(poll, POLL_INTERVAL_MS)
    pollTimers.current.set(simulationId, timer)
  }, [])

  // Trigger a new prediction
  const triggerPrediction = useCallback(
    async (scenario: string, countries: string[]) => {
      setState((prev) => ({ ...prev, isTriggering: true, error: null }))

      try {
        const res = await fetch("/api/predict/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario, countries, source: "manual" }),
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `HTTP ${res.status}`)
        }

        const data: TriggerResponse = await res.json()

        const newPrediction: ActivePrediction = {
          simulationId: data.simulationId,
          scenario,
          countries,
          status: null,
        }

        setState((prev) => ({
          ...prev,
          isTriggering: false,
          activePredictions: [newPrediction, ...prev.activePredictions],
        }))

        // Start polling
        pollStatus(data.simulationId)
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isTriggering: false,
          error: error instanceof Error ? error.message : "Failed to trigger prediction",
        }))
      }
    },
    [pollStatus]
  )

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      for (const timer of pollTimers.current.values()) {
        clearInterval(timer)
      }
      pollTimers.current.clear()
    }
  }, [])

  return {
    ...state,
    triggerPrediction,
  }
}
