"use client"

import { useState, useEffect } from "react"
import { Search, Filter, BarChart3, AlertTriangle, Settings, ChevronDown, ChevronRight, ExternalLink, Star, Loader2, TrendingUp, TrendingDown, Radio, Zap, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { InventorySidebar } from "./inventory-sidebar"
import { PredictionAlert } from "@/components/prediction-alert"
import type { PredictionResult } from "@/lib/mirofish/types"

interface CountryRisk {
  id: string
  name: string
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

interface NewsArticle {
  title: string
  url: string
  date: string
  source: string
}

interface RiskMetric {
  id: string
  name: string
  description: string
  source: string
  sourceUrl: string
  isActive: boolean
}

interface RiskSidebarProps {
  countryRisks: CountryRisk[]
  selectedCountry: string | null
  onCountrySelect: (countryId: string | null) => void
  onInventoryClick?: () => void
  isInventoryOpen?: boolean
  onReset: () => void
  predictions?: PredictionResult[]
  onPredictionClick?: () => void
}

const riskMetrics: RiskMetric[] = [
  {
    id: "political-stability",
    name: "Political Stability Index",
    description: "Measures likelihood of political instability or violence",
    source: "World Bank",
    sourceUrl: "https://worldbank.org",
    isActive: true,
  },
  {
    id: "trade-barriers",
    name: "Trade Barriers & Tariffs",
    description: "Current import/export restrictions and tariff levels",
    source: "WTO Trade Monitor",
    sourceUrl: "https://wto.org",
    isActive: true,
  },
  {
    id: "logistics-performance",
    name: "Logistics Performance Index",
    description: "Quality of trade and transport infrastructure",
    source: "World Bank LPI",
    sourceUrl: "https://worldbank.org",
    isActive: true,
  },
  {
    id: "currency-volatility",
    name: "Currency Volatility",
    description: "Exchange rate stability and financial risk",
    source: "IMF Financial Stability",
    sourceUrl: "https://imf.org",
    isActive: false,
  },
  {
    id: "natural-disasters",
    name: "Natural Disaster Risk",
    description: "Exposure to earthquakes, floods, storms",
    source: "UN OCHA",
    sourceUrl: "https://unocha.org",
    isActive: true,
  },
  {
    id: "labor-disputes",
    name: "Labor Disputes & Strikes",
    description: "Industrial action affecting ports and manufacturing",
    source: "ILO Database",
    sourceUrl: "https://ilo.org",
    isActive: false,
  },
  {
    id: "port-congestion",
    name: "Port Congestion Index",
    description: "Current delays at major shipping ports",
    source: "Marine Traffic Analytics",
    sourceUrl: "https://marinetraffic.com",
    isActive: true,
  },
  {
    id: "geopolitical-tensions",
    name: "Geopolitical Tensions",
    description: "Regional conflicts and sanctions impact",
    source: "Global Conflict Tracker",
    sourceUrl: "https://cfr.org",
    isActive: true,
  },
]

const getRiskBadgeVariant = (risk: number): "default" | "secondary" | "destructive" | "outline" => {
  if (risk >= 70) return "destructive"
  if (risk >= 40) return "default"
  return "secondary"
}

const getRiskLabel = (risk: number): string => {
  if (risk >= 80) return "Critical"
  if (risk >= 60) return "High"
  if (risk >= 40) return "Medium"
  if (risk >= 20) return "Low"
  return "Minimal"
}

const getRiskColor = (risk: number): string => {
  if (risk >= 80) return "text-red-400"
  if (risk >= 60) return "text-orange-400"
  if (risk >= 40) return "text-yellow-400"
  if (risk >= 20) return "text-emerald-400"
  return "text-cyan-400"
}

const NEWS_CACHE_TTL_MS = 5 * 60 * 1000 // change to 30 * 1000 for 30s
const NEWS_CACHE_PREFIX = "news-cache:"

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

const getCacheKey = (country: string) => `${NEWS_CACHE_PREFIX}${country.toLowerCase()}`

const sweepNewsCache = (storage: Storage) => {
  const now = Date.now()
  for (let i = storage.length - 1; i >= 0; i -= 1) {
    const key = storage.key(i)
    if (!key || !key.startsWith(NEWS_CACHE_PREFIX)) continue
    try {
      const raw = storage.getItem(key)
      if (!raw) continue
      const data = JSON.parse(raw) as { timestamp?: number }
      if (!data.timestamp || now - data.timestamp > NEWS_CACHE_TTL_MS) {
        storage.removeItem(key)
      }
    } catch {
      storage.removeItem(key)
    }
  }
}

const readCachedNews = (country: string): NewsArticle[] | null => {
  const storage = getSessionStorage()
  if (!storage) return null
  const raw = storage.getItem(getCacheKey(country))
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as { timestamp: number; articles: NewsArticle[] }
    if (!data.timestamp || Date.now() - data.timestamp > NEWS_CACHE_TTL_MS) {
      storage.removeItem(getCacheKey(country))
      return null
    }
    return data.articles ?? null
  } catch {
    storage.removeItem(getCacheKey(country))
    return null
  }
}

const writeCachedNews = (country: string, articles: NewsArticle[]) => {
  const storage = getSessionStorage()
  if (!storage) return
  storage.setItem(
    getCacheKey(country),
    JSON.stringify({ timestamp: Date.now(), articles }),
  )
}

export function RiskSidebar({ countryRisks, selectedCountry, onCountrySelect, onInventoryClick, isInventoryOpen, onReset, predictions, onPredictionClick }: RiskSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"inventory" | "risk">("risk")
  const [expandedMetrics, setExpandedMetrics] = useState<string[]>(["political-stability", "trade-barriers"])
  const [liveNews, setLiveNews] = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)

  const filteredCountries = countryRisks.filter((country) =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedCountryData = countryRisks.find((c) => c.id === selectedCountry || c.name === selectedCountry)
  const countryForNews = selectedCountryData?.name ?? selectedCountry

  const newsCacheKey = countryForNews || "__global__"

  useEffect(() => {
    const storage = getSessionStorage()
    if (storage) {
      sweepNewsCache(storage)
      const cached = readCachedNews(newsCacheKey)
      if (cached) {
        setLiveNews(cached)
        setNewsLoading(false)
        return
      }
    }

    const controller = new AbortController()
    setNewsLoading(true)

    const fetchNews = async (attempt: number): Promise<void> => {
      try {
        const url = countryForNews
          ? `/api/news?country=${encodeURIComponent(countryForNews)}`
          : `/api/news`
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!controller.signal.aborted) {
          const articles = data.articles ?? []
          setLiveNews(articles)
          writeCachedNews(newsCacheKey, articles)
          setNewsLoading(false)
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return
        if (attempt < 1) {
          await new Promise((r) => setTimeout(r, 1500))
          if (!controller.signal.aborted) return fetchNews(attempt + 1)
        }
        if (!controller.signal.aborted) {
          setLiveNews([])
          setNewsLoading(false)
        }
      }
    }

    fetchNews(0)

    return () => controller.abort()
  }, [countryForNews, newsCacheKey])

  const toggleMetric = (metricId: string) => {
    setExpandedMetrics((prev) =>
      prev.includes(metricId) ? prev.filter((id) => id !== metricId) : [...prev, metricId]
    )
  }

  const tabs = [
    { id: "inventory" as const, icon: Package, label: "Inventory", onClick: onInventoryClick },
    { id: "risk" as const, icon: AlertTriangle, label: "Risk", onClick: () => {} },
  ]

  return (
    <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
            <div className="space-y-4">
              {/* Risk Beta Notice */}
              <div className="rounded-xl border border-border/50 bg-card/30 p-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">AI-Powered Analysis</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                      Risk scores calculated from real-time news analysis. Results may require verification.
                    </p>
                  </div>
                </div>
              </div>

              {/* Selected Country Details or Global News */}
              {countryForNews ? (
                <div className="rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/30">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">{selectedCountryData?.name ?? countryForNews}</h3>
                    {selectedCountryData && (
                      <div className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                        selectedCountryData.overallRisk >= 60 ? "border-red-500/50 text-red-400" :
                        selectedCountryData.overallRisk >= 40 ? "border-yellow-500/50 text-yellow-400" :
                        "border-emerald-500/50 text-emerald-400"
                      )}>
                        {selectedCountryData.overallRisk >= 60 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {selectedCountryData.overallRisk}%
                      </div>
                    )}
                  </div>

                  {selectedCountryData ? (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-[10px] text-muted-foreground">Import Risk</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${selectedCountryData.importRisk}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-foreground">{selectedCountryData.importRisk}%</span>
                        </div>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-2.5">
                        <p className="text-[10px] text-muted-foreground">Export Risk</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-chart-2 transition-all duration-500"
                              style={{ width: `${selectedCountryData.exportRisk}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-foreground">{selectedCountryData.exportRisk}%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No risk data available — showing supply chain news only.</p>
                  )}

                  {/* Prediction Alerts for Selected Country */}
                  {predictions?.map((result) => {
                    const match = result.prediction.affectedCountries.find(
                      (c) => c.country.toLowerCase() === (selectedCountryData?.name ?? countryForNews ?? "").toLowerCase()
                    )
                    if (!match) return null
                    return (
                      <PredictionAlert
                        key={result.simulationId}
                        prediction={match}
                        onClick={onPredictionClick}
                      />
                    )
                  })}

                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <Radio className="h-3 w-3 text-primary" />
                      <p className="text-[10px] font-medium text-muted-foreground">Live News Feed</p>
                    </div>
                    {newsLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Fetching latest news...
                      </div>
                    ) : liveNews.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {liveNews.slice(0, 3).map((article, i) => (
                          <li key={i} className="group">
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 rounded-lg p-2 text-xs text-foreground transition-colors hover:bg-muted/50"
                            >
                              <span className="mt-0.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                              <div className="flex-1">
                                <p className="line-clamp-2 leading-relaxed group-hover:text-primary">{article.title}</p>
                                {article.source && (
                                  <p className="mt-1 text-[10px] text-muted-foreground">{article.source}</p>
                                )}
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No recent news found.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/30">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-foreground">Global Monitor</h3>
                    <div className="flex items-center gap-1 rounded-full border border-primary/50 px-2 py-0.5 text-xs font-medium text-primary">
                      <Radio className="h-3 w-3 animate-pulse" />
                      Live
                    </div>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    Select a country on the map for detailed risk analysis. Showing global supply chain news.
                  </p>

                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <Radio className="h-3 w-3 text-primary" />
                      <p className="text-[10px] font-medium text-muted-foreground">Global News Feed</p>
                    </div>
                    {newsLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Fetching global news...
                      </div>
                    ) : liveNews.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {liveNews.slice(0, 5).map((article, i) => (
                          <li key={i} className="group">
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-2 rounded-lg p-2 text-xs text-foreground transition-colors hover:bg-muted/50"
                            >
                              <span className="mt-0.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                              <div className="flex-1">
                                <p className="line-clamp-2 leading-relaxed group-hover:text-primary">{article.title}</p>
                                {article.source && (
                                  <p className="mt-1 text-[10px] text-muted-foreground">{article.source}</p>
                                )}
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No recent global news found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Stratis v1.0
          </p>
          <p className="text-[10px] text-muted-foreground">
            Last sync: just now
          </p>
        </div>
      </div>
    </div>
  )
}
