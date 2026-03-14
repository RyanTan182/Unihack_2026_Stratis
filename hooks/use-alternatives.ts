"use client"

import { useState, useCallback } from "react"

export interface AlternativeEntry {
  country: string
  risk: "low" | "medium" | "high"
  reason: string
}

export interface AlternativesResponse {
  alternatives: AlternativeEntry[]
}

export function useAlternatives() {
  const [loading, setLoading] = useState(false)
  const [alternatives, setAlternatives] = useState<AlternativeEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  const fetchAlternatives = useCallback(async (
    country: string,
    itemType?: string,
    itemName?: string,
    currentRisk?: number
  ) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/ai/alternatives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          country,
          itemType,
          itemName,
          currentRisk,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Failed to fetch alternatives (${res.status})`)
      }

      const data: AlternativesResponse = await res.json()
      setAlternatives(data.alternatives ?? [])
      return data.alternatives
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch alternatives"
      setError(message)
      setAlternatives([])
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const clearAlternatives = useCallback(() => {
    setAlternatives([])
    setError(null)
  }, [])

  return {
    alternatives,
    loading,
    error,
    fetchAlternatives,
    clearAlternatives,
  }
}
