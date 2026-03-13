"use client"

import { useState, useEffect } from "react"
import { Search, Filter, BarChart3, AlertTriangle, Settings, ChevronDown, ChevronRight, ExternalLink, Star, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"

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
  onReset: () => void
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

export function RiskSidebar({ countryRisks, selectedCountry, onCountrySelect, onReset }: RiskSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"filters" | "metrics" | "risk" | "options">("risk")
  const [expandedMetrics, setExpandedMetrics] = useState<string[]>(["political-stability", "trade-barriers"])
  const [liveNews, setLiveNews] = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)

  const filteredCountries = countryRisks.filter((country) =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const selectedCountryData = countryRisks.find((c) => c.id === selectedCountry || c.name === selectedCountry)
  const countryForNews = selectedCountryData?.name ?? selectedCountry

  useEffect(() => {
    if (!countryForNews) {
      setLiveNews([])
      return
    }

    const storage = getSessionStorage()
    if (storage) {
      sweepNewsCache(storage)
      const cached = readCachedNews(countryForNews)
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
        const res = await fetch(
          `/api/news?country=${encodeURIComponent(countryForNews)}`,
          { signal: controller.signal },
        )
        const data = await res.json()
        if (!controller.signal.aborted) {
          const articles = data.articles ?? []
          setLiveNews(articles)
          writeCachedNews(countryForNews, articles)
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
  }, [countryForNews])

  const toggleMetric = (metricId: string) => {
    setExpandedMetrics((prev) =>
      prev.includes(metricId) ? prev.filter((id) => id !== metricId) : [...prev, metricId]
    )
  }

  const tabs = [
    { id: "filters" as const, icon: Filter, label: "Filters" },
    { id: "metrics" as const, icon: BarChart3, label: "Metrics" },
    { id: "risk" as const, icon: AlertTriangle, label: "Risk" },
    { id: "options" as const, icon: Settings, label: "Options" },
  ]

  return (
    <div className="flex h-full w-80 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-sidebar-foreground">Supply Chain Crisis</h1>
          <Star className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Search */}
      <div className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={onReset} className="text-primary hover:text-primary/80">
            Reset
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-sidebar-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 px-2 py-3 text-xs transition-colors",
              activeTab === tab.id
                ? "border-b-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50"
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {activeTab === "risk" && (
            <div className="space-y-4">
              {/* Risk Beta Notice */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-sm font-medium text-foreground">Risk Analysis (Beta)</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Risk scores are calculated from real-time news analysis and may require verification.
                </p>
                <a href="#" className="mt-1 text-xs text-primary hover:underline">
                  Learn more about methodology
                </a>
              </div>

              {/* Selected Country Details */}
              {countryForNews && (
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold text-card-foreground">{countryForNews}</h3>
                  {selectedCountryData ? (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Import Risk</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{ width: `${selectedCountryData.importRisk}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{selectedCountryData.importRisk}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Export Risk</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 flex-1 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-chart-2"
                              style={{ width: `${selectedCountryData.exportRisk}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{selectedCountryData.exportRisk}%</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No risk data — showing supply chain news only.</p>
                  )}
                  <div className="mt-4">
                    <p className="text-xs font-medium text-muted-foreground">Recent News (Live)</p>
                    {newsLoading ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading news...
                      </div>
                    ) : liveNews.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {liveNews.map((article, i) => (
                          <li key={i} className="text-xs text-foreground">
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-primary hover:underline"
                            >
                              • {article.title}
                            </a>
                            {article.source && (
                              <span className="ml-1 text-muted-foreground">({article.source})</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No recent news found.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Risk Metrics List */}
              <div className="space-y-2">
                {riskMetrics.map((metric) => (
                  <Collapsible
                    key={metric.id}
                    open={expandedMetrics.includes(metric.id)}
                    onOpenChange={() => toggleMetric(metric.id)}
                  >
                    <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-sidebar-accent">
                      {expandedMetrics.includes(metric.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="flex-1 text-sm font-medium text-sidebar-foreground">{metric.name}</span>
                      {metric.isActive && (
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6">
                      <div className="rounded-md border border-border bg-card/50 p-3">
                        <p className="text-xs text-muted-foreground">{metric.description}</p>
                        <a
                          href={metric.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Source: {metric.source}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {/* Risk Legend */}
              <div className="rounded-lg border border-primary bg-primary/5 p-4">
                <p className="mb-3 text-sm font-medium text-foreground">Overall Risk Score</p>
                <div className="space-y-2">
                  {[
                    { color: "#7c3aed", label: "Worst", range: "80-100" },
                    { color: "#a78bfa", label: "Worse", range: "60-79" },
                    { color: "#c4b5fd", label: "Bad", range: "40-59" },
                    { color: "#ddd6fe", label: "Good", range: "20-39" },
                    { color: "#ede9fe", label: "Best", range: "0-19" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div
                        className="h-4 w-6 rounded-sm border border-border"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="flex-1 text-xs text-foreground">{item.label}</span>
                      <span className="text-xs text-muted-foreground">{item.range}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full">
                  Process Risk Analysis
                </Button>
              </div>
            </div>
          )}

          {activeTab === "filters" && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">High Risk Countries</p>
                <div className="space-y-1">
                  {filteredCountries
                    .filter((c) => c.overallRisk >= 60)
                    .map((country) => (
                      <button
                        key={country.id}
                        onClick={() => onCountrySelect(country.name)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
                          selectedCountry === country.name
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-sidebar-accent"
                        )}
                      >
                        <span>{country.name}</span>
                        <Badge variant={getRiskBadgeVariant(country.overallRisk)}>
                          {getRiskLabel(country.overallRisk)}
                        </Badge>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "metrics" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure which metrics are used in risk calculations.
              </p>
              {riskMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between rounded-md border border-border bg-card p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{metric.name}</p>
                    <p className="text-xs text-muted-foreground">{metric.source}</p>
                  </div>
                  <Badge variant={metric.isActive ? "default" : "outline"}>
                    {metric.isActive ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {activeTab === "options" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure display and analysis options.
              </p>
              <div className="space-y-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">Auto-refresh</p>
                  <p className="text-xs text-muted-foreground">Update risk scores every 15 minutes</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">News Sources</p>
                  <p className="text-xs text-muted-foreground">Reuters, AP, Financial Times, Bloomberg</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="text-sm font-medium text-foreground">Alert Threshold</p>
                  <p className="text-xs text-muted-foreground">Notify when risk exceeds 70%</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <p className="text-center text-xs text-muted-foreground">
          Supply Chain Crisis Detector v1.0
        </p>
      </div>
    </div>
  )
}
