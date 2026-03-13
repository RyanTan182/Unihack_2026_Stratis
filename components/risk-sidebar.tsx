"use client"

import { useState, useEffect } from "react"
import { Search, Filter, BarChart3, AlertTriangle, Settings, ChevronDown, ChevronRight, ExternalLink, Star, Loader2, TrendingUp, TrendingDown, Radio, Zap } from "lucide-react"
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
    <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      {/* Header */}
      <div className="border-b border-sidebar-border px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold text-foreground">Crisis Monitor</h1>
              <p className="text-[10px] text-muted-foreground">Real-time intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-emerald-500 animate-pulse" />
            <span className="text-[10px] font-medium text-emerald-500">LIVE</span>
          </div>
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
              className="h-9 border-border/50 bg-muted/30 pl-9 text-sm transition-colors focus:border-primary/50 focus:bg-muted/50"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-9 px-3 text-xs text-primary hover:bg-primary/10 hover:text-primary"
          >
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
              "relative flex flex-1 cursor-pointer flex-col items-center gap-1 px-2 py-3 text-xs transition-colors",
              activeTab === tab.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" />
            )}
            <tab.icon className="h-4 w-4" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4">
          {activeTab === "risk" && (
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

              {/* Selected Country Details */}
              {countryForNews && (
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
              )}

              {/* Risk Metrics List */}
              <div className="space-y-1">
                {riskMetrics.map((metric) => (
                  <Collapsible
                    key={metric.id}
                    open={expandedMetrics.includes(metric.id)}
                    onOpenChange={() => toggleMetric(metric.id)}
                  >
                    <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/50">
                      <div className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                        metric.isActive ? "border-primary bg-primary text-primary-foreground" : "border-border bg-transparent text-muted-foreground group-hover:border-primary/50"
                      )}>
                        {expandedMetrics.includes(metric.id) ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <span className="flex-1 text-xs font-medium text-foreground">{metric.name}</span>
                      {metric.isActive && (
                        <span className="rounded-full border border-emerald-500/50 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                          Active
                        </span>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-8">
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-[10px] leading-relaxed text-muted-foreground">{metric.description}</p>
                        <a
                          href={metric.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1.5 text-[10px] text-primary transition-colors hover:underline"
                        >
                          Source: {metric.source}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>

              {/* Risk Legend */}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-4">
                <p className="mb-3 text-xs font-medium text-foreground">Risk Score Legend</p>
                <div className="space-y-2">
                  {[
                    { color: "bg-red-500", textColor: "text-red-400", label: "Critical", range: "80-100" },
                    { color: "bg-orange-500", textColor: "text-orange-400", label: "High", range: "60-79" },
                    { color: "bg-yellow-500", textColor: "text-yellow-400", label: "Medium", range: "40-59" },
                    { color: "bg-emerald-500", textColor: "text-emerald-400", label: "Low", range: "20-39" },
                    { color: "bg-cyan-500", textColor: "text-cyan-400", label: "Minimal", range: "0-19" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div
                        className="h-2.5 w-6 rounded-sm shadow-sm"
                        style={{
                          backgroundColor: item.color.includes('red') ? '#ef4444' :
                            item.color.includes('orange') ? '#f97316' :
                            item.color.includes('yellow') ? '#eab308' :
                            item.color.includes('emerald') ? '#22c55e' : '#06b6d4'
                        }}
                      />
                      <span className={cn("flex-1 text-xs font-medium", item.textColor)}>{item.label}</span>
                      <span className="text-[10px] text-muted-foreground">{item.range}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-4 w-full border-primary/30 bg-primary/5 text-xs font-medium text-primary hover:bg-primary/10">
                  Run Full Analysis
                </Button>
              </div>
            </div>
          )}

          {activeTab === "filters" && (
            <div className="space-y-4">
              <div>
                <p className="mb-3 text-xs font-medium text-foreground">High Risk Countries</p>
                <div className="space-y-1">
                  {filteredCountries
                    .filter((c) => c.overallRisk >= 60)
                    .sort((a, b) => b.overallRisk - a.overallRisk)
                    .map((country) => (
                      <button
                        key={country.id}
                        onClick={() => onCountrySelect(country.name)}
                        className={cn(
                          "group flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-xs transition-all",
                          selectedCountry === country.name
                            ? "bg-primary/10 text-primary"
                            : "text-foreground hover:bg-muted/50 hover:text-primary"
                        )}
                      >
                        <span className="font-medium">{country.name}</span>
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          country.overallRisk >= 80 ? "border-red-500/50 text-red-400" : "border-orange-500/50 text-orange-400"
                        )}>
                          {country.overallRisk}%
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "metrics" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Configure which metrics are used in risk calculations.
              </p>
              {riskMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:border-primary/30"
                >
                  <div>
                    <p className="text-xs font-medium text-foreground">{metric.name}</p>
                    <p className="text-[10px] text-muted-foreground">{metric.source}</p>
                  </div>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[9px] font-medium border",
                    metric.isActive ? "border-emerald-500/50 text-emerald-400" : "border-border text-muted-foreground"
                  )}>
                    {metric.isActive ? "Enabled" : "Disabled"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === "options" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Configure display and analysis options.
              </p>
              <div className="space-y-2">
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:border-primary/30">
                  <p className="text-xs font-medium text-foreground">Auto-refresh</p>
                  <p className="text-[10px] text-muted-foreground">Update risk scores every 15 minutes</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:border-primary/30">
                  <p className="text-xs font-medium text-foreground">News Sources</p>
                  <p className="text-[10px] text-muted-foreground">Reuters, AP, Financial Times, Bloomberg</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3 transition-colors hover:border-primary/30">
                  <p className="text-xs font-medium text-foreground">Alert Threshold</p>
                  <p className="text-[10px] text-muted-foreground">Notify when risk exceeds 70%</p>
                </div>
              </div>
            </div>
          )}
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
