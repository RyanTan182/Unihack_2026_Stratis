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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { useDecompose } from "@/hooks/use-decompose"
import type {
  DecompositionTree,
  SupplyChainNode,
  StoredProduct,
} from "@/lib/decompose/types"

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
}: {
  node: SupplyChainNode
  tree: DecompositionTree
  depth: number
  onNodeClick: (nodeId: string) => void
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
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {node.name}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground capitalize">
              {node.type}
            </span>
            {geoCount > 0 && (
              <span className="text-[10px] text-muted-foreground">
                {geoCount} {geoCount === 1 ? "country" : "countries"}
              </span>
            )}
          </div>
        </div>

        {node.risk_score >= 70 && (
          <Badge variant="destructive" className="shrink-0 text-[10px]">
            {node.risk_score}
          </Badge>
        )}
        {node.risk_score >= 40 && node.risk_score < 70 && (
          <Badge variant="secondary" className="shrink-0 text-[10px] bg-amber-500/10 text-amber-600">
            {node.risk_score}
          </Badge>
        )}
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
}: {
  node: SupplyChainNode
  onBack: () => void
}) {
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

      <ScrollArea className="flex-1 min-h-0">
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
        </div>
      </ScrollArea>
    </div>
  )
}

function ProductCard({
  product,
  onClick,
}: {
  product: StoredProduct
  onClick: () => void
}) {
  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/80 p-3 text-left transition-all hover:border-primary/30 hover:bg-card"
      onClick={onClick}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Package className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-sidebar-foreground">
          {product.name}
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Hash className="h-2.5 w-2.5" />
            {product.tree.metadata.total_nodes} nodes
          </span>
          <span className="flex items-center gap-0.5">
            <Shield className="h-2.5 w-2.5" />
            {Math.round(product.tree.metadata.avg_confidence * 100)}%
          </span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {(product.durationMs / 1000).toFixed(0)}s
          </span>
        </div>
      </div>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
    </button>
  )
}

// --- Main component ---

interface InventorySidebarProps {
  products: StoredProduct[]
  onProductAdd: (product: StoredProduct) => void
  onTreeChange: (tree: DecompositionTree | null) => void
  onNodeSelect: (nodeId: string | null) => void
}

export function InventorySidebar({
  products,
  onProductAdd,
  onTreeChange,
  onNodeSelect,
}: InventorySidebarProps) {
  const [view, setView] = useState<"list" | "form" | "tree" | "detail">("list")
  const [activeProductId, setActiveProductId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [productName, setProductName] = useState("")
  const [suppliers, setSuppliers] = useState<string[]>([])

  const { tree, isLoading, error, durationMs, decompose, abort } = useDecompose()

  const activeProduct = products.find((p) => p.id === activeProductId) ?? null
  const activeTree = view === "form" ? tree : activeProduct?.tree ?? null

  // Navigate to product tree
  const viewProduct = useCallback(
    (product: StoredProduct) => {
      setActiveProductId(product.id)
      setView("tree")
      onTreeChange(product.tree)
      onNodeSelect(null)
    },
    [onTreeChange, onNodeSelect]
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
      setProductName("")
      setSuppliers([])
    }
  }, [view, tree, isLoading, productName, suppliers, durationMs, onProductAdd, onTreeChange])

  // Back navigation
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

  // --- View 1: Product List ---
  if (view === "list") {
    return (
      <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
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
            onClick={() => setView("form")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-2 p-4">
            {products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Package className="h-12 w-12 text-muted-foreground/20" />
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  No products yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Decompose a product to analyze its supply chain
                </p>
                <Button
                  size="sm"
                  className="mt-4 gap-1.5"
                  onClick={() => setView("form")}
                >
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
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // --- View 2: Input Form ---
  if (view === "form") {
    return (
      <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
        <div className="flex items-center gap-2 border-b border-sidebar-border p-4">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={goToList}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold text-sidebar-foreground">New Product</h2>
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
      <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
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

        <ScrollArea className="flex-1 min-h-0">
          <div className="py-2">
            {rootNode && (
              <TreeNodeRow
                node={rootNode}
                tree={activeTree}
                depth={0}
                onNodeClick={viewNode}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    )
  }

  // --- View 4: Node Detail ---
  if (view === "detail" && activeTree && selectedNodeId) {
    const node = activeTree.nodes[selectedNodeId]
    if (node) {
      return (
        <div className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar">
          <NodeDetail node={node} onBack={goToTree} />
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
