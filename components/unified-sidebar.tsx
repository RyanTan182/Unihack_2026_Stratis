"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  MapPin,
  List,
  Zap,
  Activity,
  Package,
  Plus,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Shield,
  Clock,
  Hash,
  X,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  BarChart3,
  Settings,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Radio,
  Navigation,
  MoreVertical,
  Eye,
  Factory,
  Flag,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { useDecompose } from "@/hooks/use-decompose"
import type {
  DecompositionTree,
  SupplyChainNode,
  StoredProduct,
} from "@/lib/decompose/types"
import type { FoundRoute, CountryRiskData } from "@/lib/route-types"
import { RouteFinderSection } from "@/components/sidebar-sections/route-finder-section"
import { RelocationSection } from "@/components/sidebar-sections/relocation-section"
import { InsightsSection, type SupplyChainInsightsData, type ComponentRiskForInsights } from "@/components/sidebar-sections/insights-section"
import { getDefaultDestination, setDefaultDestination } from "@/lib/demo-preferences"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// --- Types ---
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

interface UnifiedSidebarProps {
  countryRisks: CountryRisk[]
  selectedCountry: string | null
  onCountrySelect: (countryId: string | null) => void
  onReset: () => void
  products: StoredProduct[]
  onProductAdd: (product: StoredProduct) => void
  onTreeChange: (tree: DecompositionTree | null) => void
  onNodeSelect: (nodeId: string | null) => void
  productCount?: number
  riskLevel?: "low" | "medium" | "high"
  // Integration callbacks
  onOpenInBuilder?: (product: StoredProduct) => void
  onViewInsights?: (product: StoredProduct) => void
  onFindSafeRoute?: (product: StoredProduct, country?: string) => void
  // Routes section
  onRouteFound?: (routes: FoundRoute[]) => void
  preselectedOrigin?: string
  preselectedDestination?: string
  routeContext?: { componentId?: string; productId?: string } | null
  onApplyRoute?: (route: FoundRoute, context: { componentId: string; productId: string }) => void
  // Insights section
  insights: SupplyChainInsightsData | null
  onFindSafeRouteFromInsights?: (
    origin: string,
    destination: string,
    itemName: string,
    componentId?: string,
    productId?: string
  ) => void
  onViewAlternatives?: (component: ComponentRiskForInsights, parentCountry: string) => void
}

// --- Constants ---
const CONCENTRATION_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
]

const riskMetrics: RiskMetric[] = [
  { id: "political-stability", name: "Political Stability Index", description: "Measures likelihood of political instability or violence", source: "World Bank", sourceUrl: "https://worldbank.org", isActive: true },
  { id: "trade-barriers", name: "Trade Barriers & Tariffs", description: "Current import/export restrictions and tariff levels", source: "WTO Trade Monitor", sourceUrl: "https://wto.org", isActive: true },
  { id: "logistics-performance", name: "Logistics Performance Index", description: "Quality of trade and transport infrastructure", source: "World Bank LPI", sourceUrl: "https://worldbank.org", isActive: true },
  { id: "currency-volatility", name: "Currency Volatility", description: "Exchange rate stability and financial risk", source: "IMF Financial Stability", sourceUrl: "https://imf.org", isActive: false },
  { id: "natural-disasters", name: "Natural Disaster Risk", description: "Exposure to earthquakes, floods, storms", source: "UN OCHA", sourceUrl: "https://unocha.org", isActive: true },
  { id: "labor-disputes", name: "Labor Disputes & Strikes", description: "Industrial action affecting ports and manufacturing", source: "ILO Database", sourceUrl: "https://ilo.org", isActive: false },
  { id: "port-congestion", name: "Port Congestion Index", description: "Current delays at major shipping ports", source: "Marine Traffic Analytics", sourceUrl: "https://marinetraffic.com", isActive: true },
  { id: "geopolitical-tensions", name: "Geopolitical Tensions", description: "Regional conflicts and sanctions impact", source: "Global Conflict Tracker", sourceUrl: "https://cfr.org", isActive: true },
]

// --- News Caching ---
const NEWS_CACHE_TTL_MS = 5 * 60 * 1000
const NEWS_CACHE_PREFIX = "news-cache:"

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null
  try { return window.sessionStorage } catch { return null }
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
    } catch { storage.removeItem(key) }
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
  storage.setItem(getCacheKey(country), JSON.stringify({ timestamp: Date.now(), articles }))
}

// --- Sub-components ---
function SupplierTagInput({ tags, onTagsChange }: { tags: string[]; onTagsChange: (tags: string[]) => void }) {
  const [input, setInput] = useState("")

  const addTag = () => {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed])
    }
    setInput("")
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Suppliers (optional)</label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs">
              {tag}
              <button onClick={() => onTagsChange(tags.filter((t) => t !== tag))} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
          placeholder="Add supplier..."
          className="h-8 text-sm"
        />
        <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={addTag} disabled={!input.trim()}>
          Add
        </Button>
      </div>
    </div>
  )
}

function TreeNodeRow({ node, tree, depth, onNodeClick }: { node: SupplyChainNode; tree: DecompositionTree; depth: number; onNodeClick: (nodeId: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const geoCount = Object.keys(node.geographic_concentration).length

  return (
    <div>
      <button
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onNodeClick(node.id)}
      >
        {hasChildren ? (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setIsExpanded(!isExpanded) } }}
            onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
            className="shrink-0 cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        ) : (
          <div className="w-3.5" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{node.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground capitalize">{node.type}</span>
            {geoCount > 0 && <span className="text-[10px] text-muted-foreground">{geoCount} {geoCount === 1 ? "country" : "countries"}</span>}
          </div>
        </div>
        {node.risk_score >= 70 && <Badge variant="destructive" className="shrink-0 text-[10px]">{node.risk_score}</Badge>}
        {node.risk_score >= 40 && node.risk_score < 70 && <Badge variant="secondary" className="shrink-0 text-[10px] bg-amber-500/10 text-amber-600">{node.risk_score}</Badge>}
      </button>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((childId) => {
            const child = tree.nodes[childId]
            if (!child) return null
            return <TreeNodeRow key={childId} node={child} tree={tree} depth={depth + 1} onNodeClick={onNodeClick} />
          })}
        </div>
      )}
    </div>
  )
}

function NodeDetail({ node, onBack }: { node: SupplyChainNode; onBack: () => void }) {
  const entries = Object.entries(node.geographic_concentration).sort((a, b) => b[1] - a[1])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-sidebar-foreground">{node.name}</h3>
          <p className="text-[10px] text-muted-foreground capitalize">{node.type}</p>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Risk Score</p>
              <p className={cn("text-xl font-bold", node.risk_score >= 70 ? "text-red-500" : node.risk_score >= 40 ? "text-amber-500" : "text-emerald-500")}>
                {node.risk_score}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Confidence</p>
              <p className="text-xl font-bold text-sidebar-foreground">{Math.round(node.confidence * 100)}%</p>
            </div>
          </div>
          {entries.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Geographic Concentration</p>
              <div className="flex h-4 overflow-hidden rounded-full">
                {entries.map(([country, pct], i) => (
                  <div key={country} className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length] }} />
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {entries.map(([country, pct], i) => (
                  <div key={country} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length] }} />
                      <span className="text-xs text-sidebar-foreground">{country}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {node.risk_factors.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Risk Factors</p>
              <div className="flex flex-wrap gap-1.5">
                {node.risk_factors.map((factor, i) => <Badge key={i} variant="outline" className="text-[10px]">{factor}</Badge>)}
              </div>
            </div>
          )}
          {node.search_evidence && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Evidence</p>
              <p className="text-xs leading-relaxed text-muted-foreground">{node.search_evidence}</p>
            </div>
          )}
          {node.correction && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Correction</p>
              <p className="text-xs leading-relaxed text-amber-600">{node.correction}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function ProductCard({
  product,
  onClick,
  onOpenInBuilder,
  onViewInsights,
  onFindSafeRoute,
}: {
  product: StoredProduct
  onClick: () => void
  onOpenInBuilder?: () => void
  onViewInsights?: () => void
  onFindSafeRoute?: () => void
}) {
  const [showMenu, setShowMenu] = useState(false)

  // Calculate average risk for the product
  const avgRisk = Math.round(
    Object.values(product.tree.nodes).reduce((sum, node) => sum + node.risk_score, 0) /
    Object.keys(product.tree.nodes).length
  )

  return (
    <div className="group relative rounded-xl border border-border bg-card/80 transition-all hover:border-primary/30 hover:bg-card overflow-hidden">
      <button
        className="flex w-full items-center gap-3 p-3 text-left min-w-0"
        onClick={onClick}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{product.name}</p>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-0.5 whitespace-nowrap"><Hash className="h-2.5 w-2.5" />{product.tree.metadata.total_nodes} nodes</span>
            <span className="flex items-center gap-0.5 whitespace-nowrap"><Shield className="h-2.5 w-2.5" />{Math.round(product.tree.metadata.avg_confidence * 100)}%</span>
            {product.destinationCountry && (
              <span className="flex items-center gap-0.5 whitespace-nowrap"><Flag className="h-2.5 w-2.5" />{product.destinationCountry}</span>
            )}
          </div>
        </div>
        {/* Risk indicator */}
        <div className={cn(
          "shrink-0 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
          avgRisk >= 60 ? "border-red-500/50 text-red-400" :
          avgRisk >= 40 ? "border-amber-500/50 text-amber-400" :
          "border-emerald-500/50 text-emerald-400"
        )}>
          {avgRisk}%
        </div>
      </button>

      {/* Quick Actions - Show on hover */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onFindSafeRoute?.() }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer"
          title="Find Safe Routes"
        >
          <Navigation className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onViewInsights?.() }}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer"
          title="View Insights"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Action Bar - Always visible */}
      <div className="flex border-t border-border/50 divide-x divide-border/50">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenInBuilder?.() }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <Activity className="h-3 w-3" />
          Open in Builder
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onFindSafeRoute?.() }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <Navigation className="h-3 w-3" />
          Safe Routes
        </button>
      </div>
    </div>
  )
}

// --- Inventory View Component ---
function InventoryView({
  products,
  onProductAdd,
  onTreeChange,
  onNodeSelect,
  onOpenInBuilder,
  onViewInsights,
  onFindSafeRoute,
  showAddForm,
  onAddFormShown,
  countries,
}: {
  products: StoredProduct[]
  onProductAdd: (product: StoredProduct) => void
  onTreeChange: (tree: DecompositionTree | null) => void
  onNodeSelect: (nodeId: string | null) => void
  onOpenInBuilder?: (product: StoredProduct) => void
  onViewInsights?: (product: StoredProduct) => void
  onFindSafeRoute?: (product: StoredProduct) => void
  showAddForm?: boolean
  onAddFormShown?: () => void
  countries: CountryRisk[]
}) {
  const [view, setView] = useState<"list" | "form" | "tree" | "detail">("list")
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [productName, setProductName] = useState("")
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [destination, setDestination] = useState<string>("")

  const { tree, isLoading, error, durationMs, decompose, abort } = useDecompose()

  // Load default destination on mount
  useEffect(() => {
    const defaultDest = getDefaultDestination()
    setDestination(defaultDest)
  }, [])

  // Handle external trigger to show add form
  useEffect(() => {
    if (showAddForm && view !== "form") {
      setView("form")
      onAddFormShown?.()
    }
  }, [showAddForm, view, onAddFormShown])

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null
  const activeTree = view === "form" ? tree : activeProduct?.tree ?? null

  const viewProduct = useCallback((product: StoredProduct) => {
    setActiveProductId(product.id)
    setView("tree")
    onTreeChange(product.tree)
    onNodeSelect(null)
  }, [onTreeChange, onNodeSelect])

  const viewNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setView("detail")
    onNodeSelect(nodeId)
  }, [onNodeSelect])

  const handleDecompose = useCallback(async () => {
    if (!productName.trim()) return
    // Save destination as default for future products
    if (destination) {
      setDefaultDestination(destination)
    }
    await decompose(productName.trim(), suppliers, destination)
  }, [productName, suppliers, destination, decompose])

  const prevTreeRef = useRef<DecompositionTree | null>(null)
  useEffect(() => {
    if (view === "form" && tree && !isLoading && tree !== prevTreeRef.current) {
      prevTreeRef.current = tree
      const newProduct: StoredProduct = {
        id: crypto.randomUUID(),
        name: productName.trim(),
        suppliers,
        destinationCountry: destination,
        tree,
        durationMs: durationMs ?? 0,
        createdAt: Date.now(),
      }
      onProductAdd(newProduct)
      setActiveProductId(newProduct.id)
      setView("tree")
      onTreeChange(tree)
      setProductName("")
      setSuppliers([])
    }
  }, [view, tree, isLoading, productName, suppliers, destination, durationMs, onProductAdd, onTreeChange])

  const goToList = useCallback(() => {
    if (isLoading) abort()
    setView("list")
    setActiveProductId(null)
    setSelectedNodeId(null)
    onTreeChange(null)
    onNodeSelect(null)
    prevTreeRef.current = null
  }, [isLoading, abort, onTreeChange, onNodeSelect])

  const goToTree = useCallback(() => {
    setView("tree")
    setSelectedNodeId(null)
    onNodeSelect(null)
  }, [onNodeSelect])

  if (view === "list") {
    return (
      <>
        <div className="flex items-center justify-between border-b border-sidebar-border p-4 min-w-0">
          <h2 className="text-sm font-semibold text-sidebar-foreground truncate">Your Products</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setView("form")}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0 min-w-0">
          <div className="space-y-2 p-4 min-w-0">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/20" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">No products yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Decompose a product to analyze its supply chain</p>
                <Button size="sm" className="mt-4 gap-1.5" onClick={() => setView("form")}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Product
                </Button>
              </div>
            ) : (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => viewProduct(product)}
                  onOpenInBuilder={() => onOpenInBuilder?.(product)}
                  onViewInsights={() => onViewInsights?.(product)}
                  onFindSafeRoute={() => onFindSafeRoute?.(product)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </>
    )
  }

  if (view === "form") {
    return (
      <>
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-semibold text-sidebar-foreground truncate">New Product</h2>
        </div>
        <div className="space-y-4 p-4 min-w-0">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Product Name</label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. iPhone 17, Tesla Model Y"
              className="h-9 w-full"
              disabled={isLoading}
              onKeyDown={(e) => { if (e.key === "Enter" && productName.trim() && !isLoading) handleDecompose() }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Destination Market</label>
              <span className="text-[10px] text-muted-foreground/60">Saved as default</span>
            </div>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select destination..." />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    <div className="flex items-center gap-2">
                      <Flag className="h-3 w-3 text-muted-foreground" />
                      {c.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SupplierTagInput tags={suppliers} onTagsChange={setSuppliers} />
          <Button className="w-full gap-2" onClick={handleDecompose} disabled={!productName.trim() || isLoading}>
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Decomposing...</>
            ) : (
              <><Search className="h-4 w-4" />Decompose Supply Chain</>
            )}
          </Button>
          {isLoading && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">Analyzing supply chain with AI...</span>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">This may take 30-60 seconds</p>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive font-medium">Decomposition failed</span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={handleDecompose}>Retry</Button>
            </div>
          )}
        </div>
      </>
    )
  }

  if (view === "tree" && activeTree) {
    const rootNode = activeTree.nodes[activeTree.root_id]
    return (
      <>
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4 min-w-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-sidebar-foreground">{activeProduct?.name ?? productName}</h3>
          </div>
          <Badge variant="secondary" className="gap-1 text-[10px] shrink-0">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            Verified
          </Badge>
        </div>
        <div className="flex items-center gap-4 border-b border-sidebar-border px-4 py-2 min-w-0">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"><Hash className="h-2.5 w-2.5" />{activeTree.metadata.total_nodes} nodes</span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"><Shield className="h-2.5 w-2.5" />{Math.round(activeTree.metadata.avg_confidence * 100)}% conf</span>
          {activeProduct?.durationMs && <span className="flex items-center gap-1 text-[10px] text-muted-foreground whitespace-nowrap"><Clock className="h-2.5 w-2.5" />{(activeProduct.durationMs / 1000).toFixed(0)}s</span>}
        </div>
        <ScrollArea className="flex-1 min-h-0 min-w-0">
          <div className="py-2 min-w-0">
            {rootNode && <TreeNodeRow node={rootNode} tree={activeTree} depth={0} onNodeClick={viewNode} />}
          </div>
        </ScrollArea>
      </>
    )
  }

  if (view === "detail" && activeTree && selectedNodeId) {
    const node = activeTree.nodes[selectedNodeId]
    if (node) return <NodeDetail node={node} onBack={goToTree} />
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <Button variant="ghost" onClick={goToList}>Back to Inventory</Button>
    </div>
  )
}

// --- Main Unified Sidebar ---
export function UnifiedSidebar({
  countryRisks,
  selectedCountry,
  onCountrySelect,
  onReset,
  products,
  onProductAdd,
  onTreeChange,
  onNodeSelect,
  productCount = 0,
  riskLevel = "low",
  onOpenInBuilder,
  onViewInsights,
  onFindSafeRoute,
  onRouteFound,
  preselectedOrigin,
  preselectedDestination,
  routeContext,
  onApplyRoute,
  insights,
  onFindSafeRouteFromInsights,
  onViewAlternatives,
}: UnifiedSidebarProps) {
  // Collapsible section states
  const [inventoryOpen, setInventoryOpen] = useState(true)
  const [routesOpen, setRoutesOpen] = useState(false)
  const [relocationOpen, setRelocationOpen] = useState(false)
  const [insightsOpen, setInsightsOpen] = useState(false)

  // Trigger for showing add product form
  const [showAddProductForm, setShowAddProductForm] = useState(false)

  // Auto-open Routes section when safe route context is set
  useEffect(() => {
    if (preselectedOrigin && preselectedDestination) {
      setRoutesOpen(true)
    }
  }, [preselectedOrigin, preselectedDestination])

  const riskColors = {
    low: "text-emerald-500",
    medium: "text-amber-500",
    high: "text-red-500",
  }

  // Convert countryRisks to CountryRiskData format for RouteFinderSection
  const countryRiskData: CountryRiskData[] = countryRisks.map(c => ({
    id: c.id,
    name: c.name,
    type: 'country' as const,
    connections: [],
    importRisk: c.importRisk,
    exportRisk: c.exportRisk,
    overallRisk: c.overallRisk,
    newsHighlights: c.newsHighlights,
  }))

  return (
    <div className="z-30 shrink-0 flex h-full min-w-0 flex-col border-r border-sidebar-border bg-sidebar relative overflow-hidden" style={{ width: 'var(--sidebar-width)', maxWidth: '100%' }}>
      {/* Header with Logo */}
      <div className="flex items-center justify-between border-b border-sidebar-border px-4 py-3 min-w-0">
        <button onClick={onReset} className="flex cursor-pointer items-center gap-2.5 transition-opacity hover:opacity-80 min-w-0" aria-label="Home">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-md">
            <Zap className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col items-start min-w-0">
            <span className="text-sm font-semibold tracking-tight truncate">Stratis</span>
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">Supply Chain Intelligence</span>
          </div>
        </button>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Activity className={cn("h-4 w-4", riskColors[riskLevel])} />
            <div className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          </div>
        </div>
      </div>

      {/* Collapsible Sections */}
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="space-y-1 p-2 min-w-0">
          {/* Inventory Section */}
          <Collapsible open={inventoryOpen} onOpenChange={setInventoryOpen}>
            <div className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 hover:bg-muted/50">
              <CollapsibleTrigger className="flex flex-1 cursor-pointer items-center gap-2 text-left">
                <List className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Inventory</span>
                {productCount > 0 && (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {productCount}
                  </Badge>
                )}
                {inventoryOpen ? (
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                )}
              </CollapsibleTrigger>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 ml-2 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  setInventoryOpen(true)
                  setShowAddProductForm(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CollapsibleContent className="min-w-0 pt-1">
              <div className="min-w-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                <InventoryView
                  products={products}
                  onProductAdd={onProductAdd}
                  onTreeChange={onTreeChange}
                  onNodeSelect={onNodeSelect}
                  onOpenInBuilder={onOpenInBuilder}
                  onViewInsights={onViewInsights}
                  onFindSafeRoute={onFindSafeRoute}
                  showAddForm={showAddProductForm}
                  onAddFormShown={() => setShowAddProductForm(false)}
                  countries={countryRisks}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Routes Section */}
          <Collapsible open={routesOpen} onOpenChange={setRoutesOpen}>
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Routes</span>
              </div>
              {routesOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <div className="min-w-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20 p-3">
                <RouteFinderSection
                  countryRisks={countryRiskData}
                  onRouteFound={onRouteFound}
                  preselectedOrigin={preselectedOrigin}
                  preselectedDestination={preselectedDestination}
                  routeContext={routeContext}
                  onApplyRoute={onApplyRoute}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Relocation Section */}
          <Collapsible open={relocationOpen} onOpenChange={setRelocationOpen}>
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Factory className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Relocation</span>
              </div>
              {relocationOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <div className="min-w-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20 p-3">
                <RelocationSection
                  countryRisks={countryRisks}
                  onCountrySelect={(id) => onCountrySelect(id)}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Insights Section */}
          <Collapsible open={insightsOpen} onOpenChange={setInsightsOpen}>
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Insights</span>
              </div>
              {insightsOpen ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <div className="min-w-0 overflow-hidden rounded-lg border border-border/50 bg-muted/20 p-3">
                <InsightsSection
                  insights={insights}
                  onFindSafeRoute={onFindSafeRouteFromInsights}
                  onViewAlternatives={onViewAlternatives}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border px-4 py-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">Stratis v1.0</p>
          <p className="text-[10px] text-muted-foreground">Last sync: just now</p>
        </div>
      </div>
    </div>
  )
}
