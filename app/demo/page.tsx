"use client"

import { useState } from "react"
import {
  MapPin,
  List,
  Sparkles,
  Zap,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Route,
  Package,
  Factory,
  Navigation,
  Globe,
  Layers,
  BarChart3,
  AlertTriangle,
  Filter,
  Settings,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Mock Data ───────────────────────────────────────────────────────────────

const riskMetrics = [
  { id: "political-stability", name: "Political Stability Index", source: "World Bank", sourceUrl: "#", isActive: true, riskLevel: "high" as const },
  { id: "trade-barriers", name: "Trade Barriers & Tariffs", source: "WTO Trade Monitor", sourceUrl: "#", isActive: true, riskLevel: "critical" as const },
  { id: "logistics-performance", name: "Logistics Performance Index", source: "World Bank LPI", sourceUrl: "#", isActive: true, riskLevel: "medium" as const },
  { id: "currency-volatility", name: "Currency Volatility", source: "IMF Financial Stability", sourceUrl: "#", isActive: false, riskLevel: "low" as const },
  { id: "natural-disasters", name: "Natural Disaster Risk", source: "UN OCHA", sourceUrl: "#", isActive: true, riskLevel: "high" as const },
  { id: "labor-disputes", name: "Labor Disputes & Strikes", source: "ILO Database", sourceUrl: "#", isActive: false, riskLevel: "minimal" as const },
  { id: "port-congestion", name: "Port Congestion Index", source: "Freightos", sourceUrl: "#", isActive: true, riskLevel: "medium" as const },
  { id: "geopolitical", name: "Geopolitical Tensions", source: "ACLED", sourceUrl: "#", isActive: true, riskLevel: "critical" as const },
  { id: "climate", name: "Climate & Weather Risk", source: "NOAA", sourceUrl: "#", isActive: true, riskLevel: "medium" as const },
  { id: "sanctions", name: "Sanctions & Compliance", source: "OFAC", sourceUrl: "#", isActive: true, riskLevel: "high" as const },
]

const riskLevelColors: Record<string, string> = {
  critical: "bg-risk-critical",
  high: "bg-risk-high",
  medium: "bg-risk-medium",
  low: "bg-risk-low",
  minimal: "bg-risk-minimal",
}

const riskLevelDotColors: Record<string, string> = {
  critical: "bg-risk-critical/80",
  high: "bg-risk-high/80",
  medium: "bg-risk-medium/80",
  low: "bg-risk-low/60",
  minimal: "bg-risk-minimal/60",
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function DemoNavSidebar({
  activeItem,
  onItemClick,
}: {
  activeItem: string
  onItemClick: (id: string) => void
}) {
  const navItems = [
    { id: "risk", icon: MapPin, label: "Risk Monitor" },
    { id: "inventory", icon: List, label: "Inventory" },
    { id: "predictions", icon: Sparkles, label: "Predictions" },
  ]

  return (
    <div className="flex h-full w-full flex-col items-center border-r border-sidebar-border bg-sidebar py-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-1">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg glow-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">
          Stratis
        </span>
      </div>

      {/* Only functional nav items */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        {navItems.map((item) => {
          const isActive = activeItem === item.id
          return (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              aria-label={item.label}
              className={cn(
                "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <item.icon className="h-5 w-5" />
            </button>
          )
        })}
      </nav>

      {/* Live status */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="relative flex h-10 w-10 items-center justify-center">
          <div className="absolute h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
          <div className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-500/50" />
        </div>
        <span className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
          Live
        </span>
      </div>
    </div>
  )
}

function DemoRiskSidebar() {
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"risk" | "filters" | "options">("risk")
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null)
  const [metrics, setMetrics] = useState(riskMetrics)

  const tabs = [
    { id: "filters" as const, label: "Filters", icon: Filter },
    { id: "risk" as const, label: "Risk Factors", icon: AlertTriangle },
    { id: "options" as const, label: "Options", icon: Settings },
  ]

  const filteredMetrics = metrics.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = metrics.filter((m) => m.isActive).length

  return (
    <div className="flex h-full flex-col border-r border-border bg-card/50">
      {/* Compact header — search only, no redundant "Crisis Monitor" */}
      <div className="flex flex-col gap-3 p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Simplified tab bar — 3 tabs instead of 4 (merged Metrics into Risk) */}
      <div className="flex border-b border-border px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Risk factors content */}
      {activeTab === "risk" && (
        <div className="flex-1 overflow-y-auto">
          {/* AI Analysis banner — compact */}
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg border border-border bg-muted/30 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-medium text-foreground">AI-Powered Analysis</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Risk scores from real-time news. Results may require verification.
              </p>
            </div>
          </div>

          {/* Active count summary */}
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {activeCount} of {metrics.length} active
            </span>
            <button className="text-[11px] font-medium text-primary hover:text-primary/80 cursor-pointer">
              Reset
            </button>
          </div>

          {/* Metric list — compact rows with toggle switches */}
          <div className="flex flex-col gap-0.5 px-2">
            {filteredMetrics.map((metric) => {
              const isExpanded = expandedMetric === metric.id
              return (
                <div key={metric.id} className="group">
                  <div
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors cursor-pointer",
                      isExpanded
                        ? "bg-muted/50"
                        : "hover:bg-muted/30"
                    )}
                    onClick={() =>
                      setExpandedMetric(isExpanded ? null : metric.id)
                    }
                  >
                    {/* Risk level dot */}
                    <div
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        metric.isActive
                          ? riskLevelDotColors[metric.riskLevel]
                          : "bg-muted-foreground/30"
                      )}
                    />

                    {/* Chevron */}
                    <div className="shrink-0 text-muted-foreground">
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </div>

                    {/* Name */}
                    <span
                      className={cn(
                        "flex-1 text-sm font-medium",
                        metric.isActive
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {metric.name}
                    </span>

                    {/* Toggle switch */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setMetrics((prev) =>
                          prev.map((m) =>
                            m.id === metric.id
                              ? { ...m, isActive: !m.isActive }
                              : m
                          )
                        )
                      }}
                      className={cn(
                        "relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200",
                        metric.isActive ? "bg-primary" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200",
                          metric.isActive && "translate-x-4"
                        )}
                      />
                    </button>
                  </div>

                  {/* Expanded details — source link only */}
                  {isExpanded && (
                    <div className="ml-[3.25rem] pb-2 pr-3">
                      <a
                        href={metric.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                      >
                        Source: {metric.source}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === "filters" && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Filter controls
        </div>
      )}

      {activeTab === "options" && (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Options panel
        </div>
      )}
    </div>
  )
}

function DemoActionBar() {
  const [activeActions, setActiveActions] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setActiveActions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isActive = (id: string) => activeActions.has(id)

  return (
    <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5">
      {/* Primary action group — Route building */}
      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/80 p-1 shadow-lg backdrop-blur-xl">
        <ActionButton
          icon={Route}
          label="Build Route"
          active={isActive("route")}
          onClick={() => toggle("route")}
        />
        <ActionButton
          icon={Navigation}
          label="Safe Routes"
          active={isActive("safe")}
          onClick={() => toggle("safe")}
        />
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border/30" />

      {/* Secondary action group — Analysis */}
      <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card/80 p-1 shadow-lg backdrop-blur-xl">
        <ActionButton
          icon={Package}
          label="Products"
          active={isActive("products")}
          onClick={() => toggle("products")}
        />
        <ActionButton
          icon={Factory}
          label="Relocation"
          active={isActive("relocation")}
          onClick={() => toggle("relocation")}
        />
        <ActionButton
          icon={Globe}
          label="Risk Zones"
          active={isActive("zones")}
          onClick={() => toggle("zones")}
        />
      </div>

      {/* Separator */}
      <div className="h-6 w-px bg-border/30" />

      {/* Clear — visually distinct ghost button */}
      <button
        onClick={() => setActiveActions(new Set())}
        className="flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <Layers className="h-3.5 w-3.5" />
        Clear
      </button>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
          : "text-secondary-foreground hover:bg-muted/60"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function MapSkeleton() {
  return (
    <div className="relative h-full w-full map-container overflow-hidden">
      {/* Skeleton landmasses — abstract shapes */}
      <svg
        viewBox="0 0 1200 700"
        className="absolute inset-0 h-full w-full opacity-[0.06]"
        fill="currentColor"
      >
        {/* Abstract continent shapes */}
        <ellipse cx="280" cy="280" rx="140" ry="100" className="text-primary" />
        <ellipse cx="560" cy="250" rx="80" ry="120" className="text-primary" />
        <ellipse cx="700" cy="300" rx="120" ry="80" className="text-primary" />
        <ellipse cx="900" cy="320" rx="100" ry="90" className="text-primary" />
        <ellipse cx="400" cy="450" rx="90" ry="60" className="text-primary" />
        <ellipse cx="800" cy="480" rx="70" ry="50" className="text-primary" />
      </svg>

      {/* Skeleton route lines */}
      <svg
        viewBox="0 0 1200 700"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="route-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="oklch(0.72 0.14 195)" stopOpacity="0" />
            <stop offset="50%" stopColor="oklch(0.72 0.14 195)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="oklch(0.72 0.14 195)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M280,280 Q420,180 560,250"
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          className="animate-pulse"
        />
        <path
          d="M560,250 Q630,270 700,300"
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          className="animate-pulse"
          style={{ animationDelay: "0.3s" }}
        />
        <path
          d="M700,300 Q800,280 900,320"
          fill="none"
          stroke="url(#route-grad)"
          strokeWidth="1.5"
          strokeDasharray="6 4"
          className="animate-pulse"
          style={{ animationDelay: "0.6s" }}
        />
      </svg>

      {/* Skeleton node dots */}
      {[
        { x: "23%", y: "40%" },
        { x: "47%", y: "36%" },
        { x: "58%", y: "43%" },
        { x: "75%", y: "46%" },
        { x: "33%", y: "64%" },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute h-3 w-3 rounded-full animate-pulse"
          style={{
            left: pos.x,
            top: pos.y,
            background: "oklch(0.72 0.14 195 / 0.2)",
            border: "1px solid oklch(0.72 0.14 195 / 0.3)",
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}

      {/* Center loading indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <span className="text-sm font-medium text-muted-foreground">
          Loading map...
        </span>
      </div>

      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.72 0.14 195) 1px, transparent 1px), linear-gradient(90deg, oklch(0.72 0.14 195) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />
    </div>
  )
}

// ─── Main Demo Page ──────────────────────────────────────────────────────────

export default function DemoPage() {
  const [activeNav, setActiveNav] = useState("risk")

  return (
    <div className="grid h-screen w-full grid-cols-[56px_320px_1fr] overflow-hidden bg-background">
      {/* Left Nav — cleaned up, only functional items */}
      <DemoNavSidebar activeItem={activeNav} onItemClick={setActiveNav} />

      {/* Sidebar — Risk panel shown */}
      <DemoRiskSidebar />

      {/* Map area with improved action bar + skeleton loading */}
      <div className="relative h-full w-full overflow-hidden">
        <DemoActionBar />
        <MapSkeleton />
      </div>
    </div>
  )
}
