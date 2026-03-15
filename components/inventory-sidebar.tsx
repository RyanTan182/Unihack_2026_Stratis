"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Plus,
  Package,
  Loader2,
  Shield,
  Clock,
  Hash,
  X,
  AlertTriangle,
  CheckCircle2,
  Search,
  Sparkles,
  PenLine,
  Trash2,
  Check,
  Navigation,
  Activity,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useDecompose } from "@/hooks/use-decompose"
import type {
  DecompositionTree,
  SupplyChainNode,
  StoredProduct,
} from "@/lib/decompose/types"
import { InsightsPanel } from "@/components/insights-panel"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RouteMode } from "@/lib/route-types"

type AlternativeEntry = { country: string; risk: string; reason: string }

interface CountryOption {
  id: string
  name: string
}

interface ManualComponent {
  id: string
  name: string
  type: "component" | "material" | "geography"
  country: string
}

interface CountryRiskData {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

// --- Color palette for geographic concentration bars ---
const CONCENTRATION_COLORS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
]

// --- Sub-components ---

function SupplierTagInput({
  tags,
  onTagsChange,
}: {
  tags: string[]
  onTagsChange: (tags: string[]) => void
}) {
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
      <label className="text-xs font-medium text-muted-foreground">
        Suppliers (optional)
      </label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 text-xs"
            >
              {tag}
              <button
                onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                className="ml-0.5 hover:text-destructive"
              >
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder="Add supplier..."
          className="h-8 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0"
          onClick={addTag}
          disabled={!input.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  )
}


function TreeNodeRow({
  node,
  tree,
  depth,
  onNodeClick,
  alternativesMap,
}: {
  node: SupplyChainNode
  tree: DecompositionTree
  depth: number
  onNodeClick: (nodeId: string) => void
  alternativesMap: Record<string, AlternativeEntry[]>
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const geoCount = Object.keys(node.geographic_concentration).length

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onNodeClick(node.id)}
      >
        {hasChildren ? (
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setIsExpanded(!isExpanded)
              }
            }}
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="shrink-0 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        ) : (
          <div className="w-3.5" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-sidebar-foreground break-words">
            {node.name}
          </p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-[10px] text-muted-foreground capitalize">
              {node.type}
            </span>
            {geoCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {geoCount} {geoCount === 1 ? "country" : "countries"}
              </span>
            )}
            {(alternativesMap[node.id]?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-500">
                <Sparkles className="h-2.5 w-2.5" />
                AI alt
              </span>
            )}
          </div>
        </div>

        <Badge
          variant={node.risk_score >= 70 ? "destructive" : "secondary"}
          className={cn(
            "shrink-0 text-[10px]",
            node.risk_score >= 70
              ? ""
              : node.risk_score >= 40
                ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600"
          )}
        >
          {node.risk_score}
        </Badge>
      </button>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((childId) => {
            const child = tree.nodes[childId]
            if (!child) return null
            return (
              <TreeNodeRow
                key={childId}
                node={child}
                tree={tree}
                depth={depth + 1}
                onNodeClick={onNodeClick}
                alternativesMap={alternativesMap}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function NodeDetail({
  node,
  onBack,
  alternatives,
  altScanLoading,
  onApplyAlternative,
}: {
  node: SupplyChainNode
  onBack: () => void
  alternatives?: AlternativeEntry[]
  altScanLoading?: boolean
  onApplyAlternative?: (nodeId: string, country: string) => void
}) {
  const [declined, setDeclined] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const entries = Object.entries(node.geographic_concentration).sort(
    (a, b) => b[1] - a[1]
  )

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-sidebar-foreground">
            {node.name}
          </h3>
          <p className="text-[10px] text-muted-foreground capitalize">{node.type}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="space-y-4 p-4">
          {/* Scores */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Risk Score</p>
              <p className={cn(
                "text-xl font-bold",
                node.risk_score >= 70 ? "text-red-500" :
                node.risk_score >= 40 ? "text-amber-500" : "text-emerald-500"
              )}>
                {node.risk_score}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card/50 p-3">
              <p className="text-[10px] font-medium text-muted-foreground uppercase">Confidence</p>
              <p className="text-xl font-bold text-sidebar-foreground">
                {Math.round(node.confidence * 100)}%
              </p>
            </div>
          </div>

          {/* Geographic Concentration */}
          {entries.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Geographic Concentration
              </p>
              {/* Stacked bar */}
              <div className="flex h-4 overflow-hidden rounded-full">
                {entries.map(([country, pct], i) => (
                  <div
                    key={country}
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length],
                    }}
                  />
                ))}
              </div>
              {/* Legend */}
              <div className="mt-2 space-y-1">
                {entries.map(([country, pct], i) => (
                  <div key={country} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length],
                        }}
                      />
                      <span className="text-xs text-sidebar-foreground">{country}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Risk Factors */}
          {node.risk_factors.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Risk Factors
              </p>
              <div className="flex flex-wrap gap-1.5">
                {node.risk_factors.map((factor, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {factor}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Evidence */}
          {node.search_evidence && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Evidence
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {node.search_evidence}
              </p>
            </div>
          )}

          {/* Correction */}
          {node.correction && (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Correction
              </p>
              <p className="text-xs leading-relaxed text-amber-600">
                {node.correction}
              </p>
            </div>
          )}

          {/* AI Alternatives */}
          {altScanLoading && (
            <div className="flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
              <p className="text-xs text-violet-600">Scanning for alternative locations...</p>
            </div>
          )}
          {!declined && alternatives && alternatives.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  <p className="text-xs font-medium text-violet-600">
                    AI Recommended Alternatives
                  </p>
                </div>
                {alternatives.length === 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] text-muted-foreground hover:text-red-400"
                    onClick={() => setDeclined(true)}
                  >
                    Decline
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                {alternatives.map((alt, i) => {
                  const isSelected = selectedCountry === alt.country
                  const hasSelection = selectedCountry !== null
                  return (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border p-3 transition-all",
                        isSelected
                          ? "border-primary/50 bg-primary/10"
                          : "border-violet-500/20 bg-violet-500/5",
                        hasSelection && !isSelected && "opacity-50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-sidebar-foreground">
                          {alt.country}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            alt.risk === "low"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : alt.risk === "medium"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-red-500/10 text-red-600"
                          )}
                        >
                          {alt.risk} risk
                        </Badge>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {alt.reason}
                      </p>
                      <Button
                        size="sm"
                        className={cn(
                          "mt-2 h-7 w-full gap-1.5 text-xs",
                          isSelected && "bg-white text-black hover:bg-white/90",
                        )}
                        variant={isSelected ? "default" : "outline"}
                        disabled={hasSelection && !isSelected}
                        onClick={() => {
                          setSelectedCountry(alt.country)
                          onApplyAlternative?.(node.id, alt.country)
                        }}
                      >
                        <Check className="h-3 w-3" />
                        {isSelected ? "Selected" : "Select"}
                      </Button>
                    </div>
                  )
                })}
              </div>
              {alternatives.length > 1 && !selectedCountry && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs text-muted-foreground hover:text-red-400"
                  onClick={() => setDeclined(true)}
                >
                  Decline all
                </Button>
              )}
            </div>
          )}
          {declined && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card/50 p-3">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Alternatives declined</p>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-[10px] text-violet-500"
                onClick={() => setDeclined(false)}
              >
                Undo
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getPrimaryCountry(node: SupplyChainNode | undefined | null): string | null {
  if (!node) return null

  const entries = Object.entries(node.geographic_concentration ?? {})
  if (entries.length === 0) return null

  entries.sort((a, b) => b[1] - a[1])
  return entries[0][0] ?? null
}

function getLeafNodes(tree: DecompositionTree): SupplyChainNode[] {
  return Object.values(tree.nodes).filter((node) => node.children.length === 0)
}

function normalizeCountryName(name: string): string {
  return name.trim().toLowerCase()
}

function findCountryRisk(
  countryRisks: CountryRiskData[],
  countryName: string
): CountryRiskData | null {
  const normalized = normalizeCountryName(countryName)

  return (
    countryRisks.find(
      (r) =>
        r.type === "country" &&
        normalizeCountryName(r.name) === normalized
    ) ?? null
  )
}

function isRouteSafeByCountryRisk(
  originRisk: CountryRiskData | null,
  destinationRisk: CountryRiskData | null
) {
  if (!originRisk || !destinationRisk) return false

  return originRisk.overallRisk < 50 && destinationRisk.overallRisk < 50
}

interface CountryRiskData {
  id: string
  name: string
  type: "country" | "chokepoint"
  connections: string[]
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

function computeRouteRiskScore(
  originRisk: CountryRiskData | null,
  destinationRisk: CountryRiskData | null
): number {
  if (!originRisk || !destinationRisk) return 100
  return Math.round(originRisk.exportRisk * 0.6 + destinationRisk.importRisk * 0.4)
}

function ProductCard({
  product,
  onClick,
  onOpenInBuilder,
  onSafeRoutes,
  onRouteModeChange
}: {
  product: StoredProduct
  onClick: () => void
  onOpenInBuilder?: (product: StoredProduct) => void
  onSafeRoutes?: (product: StoredProduct) => void
  onRouteModeChange?: (mode: RouteMode) => void
}) {
  const rootNode = product.tree.nodes[product.tree.root_id]
  const score = rootNode?.risk_score ?? 0

  const topCountries = Object.entries(rootNode?.geographic_concentration ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 1)
    .map(([country]) => country)

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card/80 transition-all hover:border-primary/30 hover:bg-card">
      {/* Top clickable area */}
      <button
        className="flex w-full items-center gap-3 p-4 text-left"
        onClick={onClick}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Package className="h-5 w-5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">
            {product.name}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              {product.tree.metadata.total_nodes} nodes
            </span>

            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" />
              {Math.round(product.tree.metadata.avg_confidence * 100)}%
            </span>
          </div>
        </div>

        <div
          className={cn(
            "shrink-0 rounded-full border px-4 py-1.5 text-[10px] font-semibold",
            score >= 70
              ? "border-red-500/40 bg-red-500/10 text-red-400"
              : score >= 40
                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                : "border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
          )}
        >
          {score}%
        </div>
      </button>

      {/* Bottom action row */}
      <div className="grid grid-cols-2 border-t border-border">
        <button
          type="button"
          className="flex items-center justify-center gap-2 px-4 py-3 text-[10px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onOpenInBuilder?.(product)
            onRouteModeChange?.("shortest")
          }}
        >
          <Activity className="h-4 w-4" />
          Normal routes
        </button>

        <button
          type="button"
          className="flex items-center justify-center gap-2 border-l border-border px-4 py-3 text-[10px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={(e) => {
            e.stopPropagation()
            onSafeRoutes?.(product)
            onRouteModeChange?.("safest")
          }}
        >
          <Navigation className="h-4 w-4" />
          Safe Routes
        </button>
      </div>
    </div>
  )
}

// --- Main component ---

interface ComponentRiskForInsights {
  componentId: string
  componentName: string
  country: string
  risk: number
}

interface SupplyChainInsightsData {
  healthScore: number
  riskBreakdown: {
    geopolitical: number
    logistics: number
    priceVolatility: number
  }
  highRiskComponents: ComponentRiskForInsights[]
  priceImpact: {
    estimated: string
    factors: { source: string; impact: 'increase' | 'decrease' | 'neutral'; magnitude: number; description: string }[]
  }
  recommendations: { id: string; type: 'critical' | 'warning' | 'info' | 'opportunity'; title: string; description: string; action: string }[]
}

interface InventorySidebarProps {
  products: StoredProduct[]
  onProductAdd: (product: StoredProduct) => void
  onTreeChange: (tree: DecompositionTree | null) => void
  onNodeSelect: (nodeId: string | null) => void
  onOpenInBuilder?: (product: StoredProduct) => void
  onOpenSafeRoutes?: (product: StoredProduct) => void
  onProductSelect?: (product: StoredProduct) => void
  countryRisks: CountryRiskData[]
  countryOptions?: CountryOption[]
  alternativesMap?: Record<string, AlternativeEntry[]>
  altScanLoading?: boolean
  onApplyAlternative?: (nodeId: string, country: string) => void
  onFindSafeRoute?: (origin: string, destination: string, itemName: string) => void
  insights?: SupplyChainInsightsData
  onViewAlternatives?: (component: { componentId: string; componentName: string; country: string; risk: number }, parentCountry: string) => void
  rightPanelProducts?: { id: string; name: string; country: string; components: { name: string; type: string; country: string; children: any[] }[] }[]
  onRouteModeChange?: (mode: RouteMode) => void
}

function createManualStoredProduct(
  name: string,
  country: string,
  components: ManualComponent[],
): StoredProduct {
  const rootId = `root-${Date.now()}`
  const nodes: Record<string, SupplyChainNode> = {}
  const childIds = components.map((c) => c.id)

  nodes[rootId] = {
    id: rootId,
    name,
    tier: 0,
    type: "product",
    status: "verified",
    confidence: 1.0,
    geographic_concentration: { [country]: 100 },
    risk_score: 0,
    risk_factors: [],
    source: "industry",
    search_evidence: null,
    correction: null,
    children: childIds,
  }

  components.forEach((comp) => {
    nodes[comp.id] = {
      id: comp.id,
      name: comp.name,
      tier: 1,
      type: comp.type,
      status: "verified",
      confidence: 1.0,
      geographic_concentration: { [comp.country]: 100 },
      risk_score: 0,
      risk_factors: [],
      source: "industry",
      search_evidence: null,
      correction: null,
      children: [],
    }
  })

  return {
    id: crypto.randomUUID(),
    name,
    suppliers: [],
    tree: {
      product: name,
      phase: "verified",
      nodes,
      root_id: rootId,
      metadata: {
        total_nodes: Object.keys(nodes).length,
        verified_count: Object.keys(nodes).length,
        corrected_count: 0,
        avg_confidence: 1.0,
      },
    },
    durationMs: 0,
    createdAt: Date.now(),
  }
}

export function InventorySidebar({
  products,
  onProductAdd,
  onTreeChange,
  onNodeSelect,
  onProductSelect,
  onOpenInBuilder,
  onOpenSafeRoutes,
  countryRisks,
  countryOptions = [],
  alternativesMap = {},
  altScanLoading = false,
  onApplyAlternative,
  onFindSafeRoute,
  insights,
  onViewAlternatives,
  rightPanelProducts = [],
  onRouteModeChange
}: InventorySidebarProps) {
  const [view, setView] = useState<"list" | "chooser" | "form" | "manual" | "tree" | "detail">("list")
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [productName, setProductName] = useState("")
  const [suppliers, setSuppliers] = useState<string[]>([])

  const [manualName, setManualName] = useState("")
  const [manualCountry, setManualCountry] = useState("China")
  const [manualComponents, setManualComponents] = useState<ManualComponent[]>([])

  const [showInsightsPanel, setShowInsightsPanel] = useState(false)
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const { tree, isLoading, error, durationMs, decompose, abort } = useDecompose()

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null
  const activeTree = view === "form" ? tree : activeProduct?.tree ?? null

  const handleSafeRoutesForProduct = useCallback(
    (product: StoredProduct) => {
      if (!onFindSafeRoute) return

      const rootNode = product.tree.nodes[product.tree.root_id]
      const destination = getPrimaryCountry(rootNode)

      if (!destination) return

      const destinationRisk = findCountryRisk(countryRisks, destination)
      if (!destinationRisk) return

      const leafNodes = getLeafNodes(product.tree)

      console.log("------ SAFE ROUTE ANALYSIS ------")
      console.log("Product:", product.name)
      console.log("Destination:", destination)

      const seen = new Set<string>()

      leafNodes.forEach((node) => {
        const origin = getPrimaryCountry(node)
        if (!origin) return
        if (origin === destination) return

        const originRisk = findCountryRisk(countryRisks, origin)

        const score = computeRouteRiskScore(originRisk, destinationRisk)

        console.log(
          `[Route Check] ${origin} → ${destination} | component=${node.name} | risk=${score}`
        )

        if (score >= 50) {
          console.log("❌ Rejected (risk too high)")
          return
        }

        const key = `${node.name}__${origin}__${destination}`
        if (seen.has(key)) return
        seen.add(key)

        console.log("✅ SAFE ROUTE:", {
          origin,
          destination,
          component: node.name,
          riskScore: score,
        })

        onFindSafeRoute(origin, destination, node.name)
      })

      console.log("------ END SAFE ROUTE ANALYSIS ------")
    },
    [onFindSafeRoute, countryRisks]
  )

  // Navigate to product tree and notify parent for alternatives scan
  const viewProduct = useCallback(
    (product: StoredProduct) => {
      setActiveProductId(product.id)
      setView("tree")
      onTreeChange(product.tree)
      onNodeSelect(null)
      onProductSelect?.(product)
    },
    [onTreeChange, onNodeSelect, onProductSelect]
  )

  // Navigate to node detail
  const viewNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId)
      setView("detail")
      onNodeSelect(nodeId)
    },
    [onNodeSelect]
  )

  // Start decomposition
  const handleDecompose = useCallback(async () => {
    if (!productName.trim()) return
    await decompose(productName.trim(), suppliers)
  }, [productName, suppliers, decompose])

  // Handle decomposition completing — check if tree arrived
  const prevTreeRef = useRef<DecompositionTree | null>(null)
  useEffect(() => {
    if (view === "form" && tree && !isLoading && tree !== prevTreeRef.current) {
      prevTreeRef.current = tree
      const newProduct: StoredProduct = {
        id: crypto.randomUUID(),
        name: productName.trim(),
        suppliers,
        tree,
        durationMs: durationMs ?? 0,
        createdAt: Date.now(),
      }
      onProductAdd(newProduct)
      setActiveProductId(newProduct.id)
      setView("tree")
      onTreeChange(tree)
      onProductSelect?.(newProduct)
      setProductName("")
      setSuppliers([])
    }
  }, [view, tree, isLoading, productName, suppliers, durationMs, onProductAdd, onTreeChange])

  const handleManualSave = useCallback(() => {
    if (!manualName.trim()) return
    const stored = createManualStoredProduct(manualName.trim(), manualCountry, manualComponents)
    onProductAdd(stored)
    setActiveProductId(stored.id)
    setView("tree")
    onTreeChange(stored.tree)
    onProductSelect?.(stored)
    setManualName("")
    setManualCountry("China")
    setManualComponents([])
  }, [manualName, manualCountry, manualComponents, onProductAdd, onTreeChange, onProductSelect])

  const handleAiOptimize = useCallback(() => {
    const currentProduct = rightPanelProducts.find((p) => {
      const stored = products.find((sp) => sp.id === p.id)
      return stored?.id === activeProductId
    }) ?? rightPanelProducts[0]

    if (!currentProduct) return
    setAiDialogOpen(true)
    setAiLoading(true)
    setAiResult(null)

    const serializeItem = (item: { name: string; type: string; country: string; children: any[] }): unknown => ({
      name: item.name || item.type,
      type: item.type,
      country: item.country,
      children: item.children.map(serializeItem),
    })

    fetch("/api/ai/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: {
          name: currentProduct.name || "Unnamed",
          country: currentProduct.country,
          components: currentProduct.components.map(serializeItem),
        },
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.result) {
          setAiResult(data.result)
        } else {
          const detail = data.detail ? `\n\n${data.detail}` : ""
          setAiResult(`Error: ${data.error ?? "No response"}${detail}`)
        }
      })
      .catch(() => setAiResult("Failed to get AI response. Check your API key."))
      .finally(() => setAiLoading(false))
  }, [rightPanelProducts, products, activeProductId])

  const addManualComponent = useCallback(() => {
    setManualComponents((prev) => [
      ...prev,
      { id: `comp-${Date.now()}`, name: "", type: "component", country: "China" },
    ])
  }, [])

  const removeManualComponent = useCallback((id: string) => {
    setManualComponents((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const updateManualComponent = useCallback(
    (id: string, update: Partial<ManualComponent>) => {
      setManualComponents((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...update } : c)),
      )
    },
    [],
  )

  // Back navigation
  const goToList = useCallback(() => {
    if (isLoading) abort()
    setView("list")
    setActiveProductId(null)
    setSelectedNodeId(null)
    onTreeChange(null)
    onNodeSelect(null)
    prevTreeRef.current = null
    setManualName("")
    setManualCountry("China")
    setManualComponents([])
  }, [isLoading, abort, onTreeChange, onNodeSelect])

  const goToTree = useCallback(() => {
    setView("tree")
    setSelectedNodeId(null)
    onNodeSelect(null)
  }, [onNodeSelect])

  // --- View 1: Product List ---
  if (view === "list") {
    return (
      <div className="flex h-screen w-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
        <div className="flex items-center justify-between border-b border-sidebar-border p-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-sidebar-foreground">Inventory</h2>
            {products.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {products.length}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setView("chooser")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-2 p-4">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/20" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  No products yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Create a product to analyze its supply chain
                </p>
                <Button
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setView("chooser")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New Product
                </Button>
              </div>
            ) : (
              products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onClick={() => viewProduct(product)}
                  onOpenInBuilder={(p) => onOpenInBuilder?.(p)}
                  onSafeRoutes={(p) => handleSafeRoutesForProduct(p)}
                  onRouteModeChange={onRouteModeChange}
                />
              ))
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- View 2: Creation Mode Chooser ---
  if (view === "chooser") {
    return (
      <div className="flex h-screen w-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-sidebar-foreground">Create New Product</h2>
        </div>

        <div className="space-y-3 p-4">
          <button
            className="w-full rounded-xl border border-border bg-card/80 p-4 text-left transition-all hover:border-primary/30 hover:bg-card"
            onClick={() => setView("form")}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-sidebar-foreground">
                  Predict supply chain using AI
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  AI will decompose and predict the full supply chain
                </p>
              </div>
            </div>
          </button>

          <button
            className="w-full rounded-xl border border-border bg-card/80 p-4 text-left transition-all hover:border-primary/30 hover:bg-card"
            onClick={() => setView("manual")}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <PenLine className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-sidebar-foreground">
                  Create product supply chain manually
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Define your supply chain structure by hand
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // --- View 2b: Manual Product Builder ---
  if (view === "manual") {
    return (
      <div className="flex h-screen w-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setView("chooser")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-sidebar-foreground">Manual Product</h2>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Product Name</label>
              <Input
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. iPhone 17, Tesla Model Y"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Assembly Country</label>
              {countryOptions.length > 0 ? (
                <Select value={manualCountry} onValueChange={setManualCountry}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countryOptions
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={manualCountry}
                  onChange={(e) => setManualCountry(e.target.value)}
                  placeholder="Country..."
                  className="h-9"
                />
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">
                  Components ({manualComponents.length})
                </label>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={addManualComponent}>
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              </div>

              {manualComponents.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground/70">
                  No components yet. Add components to define supply chain.
                </p>
              )}

              <div className="space-y-2">
                {manualComponents.map((comp) => (
                  <div
                    key={comp.id}
                    className="rounded-lg border border-border bg-card/50 p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={comp.name}
                        onChange={(e) => updateManualComponent(comp.id, { name: e.target.value })}
                        placeholder="Component name..."
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-red-400"
                        onClick={() => removeManualComponent(comp.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Select
                        value={comp.type}
                        onValueChange={(v) =>
                          updateManualComponent(comp.id, { type: v as ManualComponent["type"] })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="component">Component</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="geography">Resource</SelectItem>
                        </SelectContent>
                      </Select>
                      {countryOptions.length > 0 ? (
                        <Select
                          value={comp.country}
                          onValueChange={(v) => updateManualComponent(comp.id, { country: v })}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {countryOptions
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((c) => (
                                <SelectItem key={c.id} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={comp.country}
                          onChange={(e) => updateManualComponent(comp.id, { country: e.target.value })}
                          placeholder="Country..."
                          className="h-7 text-xs flex-1"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {onFindSafeRoute && manualComponents.length > 0 && (
              <Button
                variant="outline"
                className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  manualComponents.forEach((comp) => {
                    if (comp.name.trim() && comp.country) {
                      onFindSafeRoute(comp.country, manualCountry, comp.name)
                    }
                  })
                }}
              >
                <Navigation className="h-4 w-4" />
                Analyse Component Routes
              </Button>
            )}

            <Button
              className="w-full gap-2"
              onClick={handleManualSave}
              disabled={!manualName.trim()}
            >
              <Package className="h-4 w-4" />
              Create Product
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // --- View 3: AI Decomposition Form ---
  if (view === "form") {
    return (
      <div className="flex h-screen w-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { if (isLoading) abort(); setView("chooser") }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-sidebar-foreground">AI Prediction</h2>
        </div>

        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Product Name
            </label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g. iPhone 17, Tesla Model Y"
              className="h-9"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && productName.trim() && !isLoading) {
                  handleDecompose()
                }
              }}
            />
          </div>

          <SupplierTagInput tags={suppliers} onTagsChange={setSuppliers} />

          <Button
            className="w-full gap-2"
            onClick={handleDecompose}
            disabled={!productName.trim() || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Decomposing...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Decompose Supply Chain
              </>
            )}
          </Button>

          {isLoading && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-xs text-primary font-medium">
                  Analyzing supply chain with AI...
                </span>
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                This may take 30-60 seconds
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-xs text-destructive font-medium">
                  Decomposition failed
                </span>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 h-7 text-xs"
                onClick={handleDecompose}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- View 3: Tree ---
  if (view === "tree" && activeTree) {
    const rootNode = activeTree.nodes[activeTree.root_id]

    return (
      <div className="flex h-screen w-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-sidebar-foreground">
              {activeProduct?.name ?? productName}
            </h3>
          </div>
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500" />
            Verified
          </Badge>
        </div>

        {/* Metadata bar */}
        <div className="flex items-center gap-4 border-b border-sidebar-border px-4 py-2">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Hash className="h-2.5 w-2.5" />
            {activeTree.metadata.total_nodes} nodes
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Shield className="h-2.5 w-2.5" />
            {Math.round(activeTree.metadata.avg_confidence * 100)}% conf
          </span>
          {activeProduct?.durationMs && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {(activeProduct.durationMs / 1000).toFixed(0)}s
            </span>
          )}
        </div>

        {altScanLoading && (
          <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/5 px-4 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
            <p className="text-[10px] font-medium text-violet-600">
              Scanning for AI alternatives...
            </p>
          </div>
        )}
        {!altScanLoading && Object.keys(alternativesMap).length > 0 && (
          <div className="flex items-center gap-2 border-b border-violet-500/20 bg-violet-500/5 px-4 py-2">
            <Sparkles className="h-3 w-3 text-violet-500" />
            <p className="text-[10px] font-medium text-violet-600">
              {Object.keys(alternativesMap).length} components have AI alternatives
            </p>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="py-2">
            {rootNode && (
              <TreeNodeRow
                node={rootNode}
                tree={activeTree}
                depth={0}
                onNodeClick={viewNode}
                alternativesMap={alternativesMap}
              />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="border-t border-sidebar-border p-4 space-y-2">
          {insights && (
            <Button
              variant="outline"
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => setShowInsightsPanel(true)}
            >
              <Activity className="h-4 w-4" />
              Analyse Supply Chain
              <Badge className={cn(
                "ml-auto border-0 text-[10px]",
                insights.healthScore >= 70 ? "bg-emerald-500/20 text-emerald-400" :
                insights.healthScore >= 40 ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400"
              )}>
                {insights.healthScore}%
              </Badge>
            </Button>
          )}

          <Button
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
            onClick={handleAiOptimize}
            disabled={aiLoading || rightPanelProducts.length === 0}
          >
            {aiLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Ask AI to optimize plan
          </Button>
        </div>

        {showInsightsPanel && insights && (
          <InsightsPanel
            isOpen={showInsightsPanel}
            onClose={() => setShowInsightsPanel(false)}
            insights={insights}
            onFindSafeRoute={onFindSafeRoute}
            onViewAlternatives={onViewAlternatives}
          />
        )}

        <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
          <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto rounded-xl border-border/50 bg-card/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Sparkles className="h-5 w-5 text-primary" />
                AI Optimization — {activeProduct?.name || "Product"}
              </DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {aiLoading ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Analyzing your supply chain...</p>
                </div>
              ) : aiResult ? (
                <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                  {aiResult.split("\n").map((line, i) => {
                    if (line.startsWith("# ")) return <h3 key={i} className="mt-3 text-base font-semibold text-foreground">{line.slice(2)}</h3>
                    if (line.startsWith("## ")) return <h4 key={i} className="mt-2 text-sm font-semibold text-foreground">{line.slice(3)}</h4>
                    if (line.startsWith("### ")) return <h4 key={i} className="mt-2 text-sm font-medium text-foreground">{line.slice(4)}</h4>
                    if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="ml-3 text-sm text-muted-foreground">{line}</p>
                    if (line.startsWith("**")) return <p key={i} className="text-sm font-semibold text-foreground">{line.replace(/\*\*/g, "")}</p>
                    if (line.trim() === "") return <div key={i} className="h-2" />
                    return <p key={i} className="text-sm text-muted-foreground">{line}</p>
                  })}
                </div>
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // --- View 4: Node Detail ---
  if (view === "detail" && activeTree && selectedNodeId) {
    const node = activeTree.nodes[selectedNodeId]
    if (node) {
      return (
        <div className="flex h-screen w-full flex-col border-r border-sidebar-border bg-sidebar overflow-hidden">
          <NodeDetail
            node={node}
            onBack={goToTree}
            alternatives={alternativesMap[node.id]}
            altScanLoading={altScanLoading}
            onApplyAlternative={onApplyAlternative}
          />
        </div>
      )
    }
  }

  // Fallback — shouldn't reach here
  return (
    <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-1 items-center justify-center">
        <Button variant="ghost" onClick={goToList}>
          Back to Inventory
        </Button>
      </div>
    </div>
  )
}
