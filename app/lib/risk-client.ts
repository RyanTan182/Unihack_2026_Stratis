// app/lib/risk-client.ts
import { CountryRisk } from "@/components/product-supply-chain"

export interface Article {
  title: string
  url: string
  date: string
  source: string
}

export interface RiskFactorScore {
  score: number
  confidence: number
  rationale: string
  evidence: string[]
}

export interface CountryRiskEvaluation {
  nodeId: string
  nodeName: string
  nodeType: "country"
  importFactors: {
    tariff: RiskFactorScore
    conflict: RiskFactorScore
    policy: RiskFactorScore
  }
  exportFactors: {
    tariff: RiskFactorScore
    conflict: RiskFactorScore
    policy: RiskFactorScore
  }
  importRisk: number
  exportRisk: number
  overallRisk: number
  summary: string
  assumptions: string[]
  computedAt: string
  articles: Article[]
}

export async function fetchCountryNews(country: string) {
  const res = await fetch(`/api/news?country=${encodeURIComponent(country)}`)
  if (!res.ok) throw new Error("Failed to fetch country news")
  return res.json() as Promise<{
    country: string
    articles: Article[]
    source: string
  }>
}

export async function evaluateCountryRiskBatch(
  countries: {
    nodeId: string
    nodeName: string
  }[]
) {
  const countriesWithNews = await Promise.all(
    countries.map(async (country) => {
      const news = await fetchCountryNews(country.nodeName)
      return {
        nodeId: country.nodeId,
        nodeName: country.nodeName,
        nodeType: "country" as const,
        articles: news.articles,
      }
    })
  )

  const res = await fetch("/api/risk-evaluate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      countries: countriesWithNews,
    }),
  })

  if (!res.ok) {
    throw new Error("Failed to evaluate country risk batch")
  }

  const data = await res.json()

  const articlesByNodeId = new Map(
    countriesWithNews.map((country) => [country.nodeId, country.articles])
  )

  const mergedResults: CountryRiskEvaluation[] = data.results.map(
    (result: Omit<CountryRiskEvaluation, "articles">) => ({
      ...result,
      articles: articlesByNodeId.get(result.nodeId) ?? [],
    })
  )

  return mergedResults
}

export async function evaluateAllCountriesInChunks(params: {
  countryRisks: CountryRisk[]
  existingSnapshots: Record<string, CountryRiskEvaluation>
  chunkSize?: number
  forceRefresh?: boolean
  onChunkStart?: (countryIds: string[]) => void
  onChunkComplete?: (results: CountryRiskEvaluation[]) => void
  onProgress?: (info: {
    completedCountries: number
    totalCountries: number
    completedChunks: number
    totalChunks: number
  }) => void
}) {
  const {
    countryRisks,
    existingSnapshots,
    chunkSize = 5,
    forceRefresh = false,
    onChunkStart,
    onChunkComplete,
    onProgress,
  } = params

  const allCountries = countryRisks.filter((node) => node.type === "country")

  const targets = forceRefresh
    ? allCountries
    : allCountries.filter((country) => !existingSnapshots[country.id])

  const chunks: CountryRisk[][] = []
  for (let i = 0; i < targets.length; i += chunkSize) {
    chunks.push(targets.slice(i, i + chunkSize))
  }

  let completedCountries = 0
  let completedChunks = 0
  const allResults: CountryRiskEvaluation[] = []

  onProgress?.({
    completedCountries,
    totalCountries: targets.length,
    completedChunks,
    totalChunks: chunks.length,
  })

  for (const chunk of chunks) {
    const countryIds = chunk.map((c) => c.id)
    onChunkStart?.(countryIds)

    const results = await evaluateCountryRiskBatch(
      chunk.map((country) => ({
        nodeId: country.id,
        nodeName: country.name,
      }))
    )

    allResults.push(...results)

    completedCountries += results.length
    completedChunks += 1

    onChunkComplete?.(results)
    onProgress?.({
      completedCountries,
      totalCountries: targets.length,
      completedChunks,
      totalChunks: chunks.length,
    })
  }

  return allResults
}