"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  ChevronDown,
  ChevronRight,
  Package,
  Boxes,
  Box,
  Fuel,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
  Check,
  XCircle,
  Trash2,
  List,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { Product, SupplyChainItem } from "@/components/product-supply-chain"

interface CountryRisk {
  id: string
  name: string
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

type ItemType = "product" | "component" | "material" | "resource"

interface Recommendation {
  country: string
  risk: string
  reason: string
}

type RecommendationStatus = "idle" | "loading" | "recommended" | "accepted" | "declined"

interface RecommendationState {
  status: RecommendationStatus
  data: Recommendation | null
  error: string | null
}

const itemTypeConfig: Record<ItemType, { icon: typeof Package; label: string }> = {
  product: { icon: Package, label: "Product" },
  component: { icon: Boxes, label: "Component" },
  material: { icon: Box, label: "Material" },
  resource: { icon: Fuel, label: "Resource" },
}

function adjustColorAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const br = Math.round(r * alpha + 255 * (1 - alpha))
  const bg = Math.round(g * alpha + 255 * (1 - alpha))
  const bb = Math.round(b * alpha + 255 * (1 - alpha))
  return `rgb(${br},${bg},${bb})`
}

interface InventorySidebarProps {
  isOpen: boolean
  onClose: () => void
  countryRisks: CountryRisk[]
  inventoryProducts: Product[]
  onInventoryProductsChange: (products: Product[]) => void
  onProductUpdate?: (product: Product) => void
}

function InventoryItemRow({
  item,
  depth,
  countryRisks,
  productColor,
  recommendations,
  onRecommendationFetched,
  onAccept,
  onDecline,
}: {
  item: SupplyChainItem
  depth: number
  countryRisks: CountryRisk[]
  productColor: string
  recommendations: Record<string, RecommendationState>
  onRecommendationFetched: (itemId: string, rec: RecommendationState) => void
  onAccept: (itemId: string) => void
  onDecline: (itemId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const fetchedRef = useRef(false)
  const config = itemTypeConfig[item.type]
  const Icon = config.icon
  const hasChildren = item.children.length > 0

  const countryData = countryRisks.find((c) => c.name === item.country)
  const isHighRisk = (countryData?.overallRisk ?? 0) >= 60
  const recState = recommendations[item.id]

  const iconBg = adjustColorAlpha(productColor, 0.7 - depth * 0.1)

  useEffect(() => {
    if (!isHighRisk || fetchedRef.current || recState) return
    fetchedRef.current = true

    onRecommendationFetched(item.id, { status: "loading", data: null, error: null })

    fetch("/api/ai/alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: item.country,
        itemType: item.type,
        itemName: item.name,
        currentRisk: countryData?.overallRisk ?? 50,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          onRecommendationFetched(item.id, { status: "idle", data: null, error: data.error })
        } else {
          const alt = data.alternatives?.[0]
          if (alt) {
            onRecommendationFetched(item.id, {
              status: "recommended",
              data: { country: alt.country, risk: alt.risk, reason: alt.reason },
              error: null,
            })
          } else {
            onRecommendationFetched(item.id, { status: "idle", data: null, error: "No alternatives found" })
          }
        }
      })
      .catch(() => {
        onRecommendationFetched(item.id, { status: "idle", data: null, error: "Failed to fetch recommendation" })
      })
  }, [isHighRisk, item.id, item.country, item.type, item.name, countryData?.overallRisk, recState, onRecommendationFetched])

  return (
    <div>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          className="rounded-lg border border-border bg-card p-2.5 transition-all"
          style={{ marginLeft: `${depth * 16}px` }}
        >
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isExpanded && "rotate-90"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            ) : (
              <div className="w-5" />
            )}

            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: iconBg }}
            >
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {item.name || `Unnamed ${config.label}`}
              </p>
              <p className="text-[10px] text-muted-foreground">{item.country}</p>
            </div>

            {isHighRisk && (
              <Badge variant="destructive" className="shrink-0 gap-0.5 text-[10px]">
                <AlertTriangle className="h-2.5 w-2.5" />
                {countryData?.overallRisk}%
              </Badge>
            )}
          </div>

          {/* Recommendation card for high-risk items */}
          {isHighRisk && recState && (
            <div className="mt-2">
              {recState.status === "loading" && (
                <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">Getting AI recommendation...</span>
                </div>
              )}

              {recState.status === "recommended" && recState.data && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Recommendation
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{recState.data.country}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{recState.data.reason}</p>
                    </div>
                    <Badge
                      variant={recState.data.risk === "low" ? "secondary" : recState.data.risk === "high" ? "destructive" : "default"}
                      className="shrink-0 text-[10px]"
                    >
                      {recState.data.risk} risk
                    </Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 flex-1 gap-1 bg-green-600 text-xs text-white hover:bg-green-700"
                      onClick={() => onAccept(item.id)}
                    >
                      <Check className="h-3 w-3" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 gap-1 text-xs"
                      onClick={() => onDecline(item.id)}
                    >
                      <XCircle className="h-3 w-3" />
                      Decline
                    </Button>
                  </div>
                </div>
              )}

              {recState.status === "accepted" && recState.data && (
                <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs text-green-700">
                    Relocated to <span className="font-semibold">{recState.data.country}</span>
                  </span>
                </div>
              )}

              {recState.status === "declined" && (
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Recommendation declined — keeping {item.country}
                  </span>
                </div>
              )}

              {recState.error && recState.status === "idle" && (
                <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs text-destructive">{recState.error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasChildren && (
          <CollapsibleContent>
            <div className="mt-1.5 space-y-1.5">
              {item.children.map((child) => (
                <InventoryItemRow
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  countryRisks={countryRisks}
                  productColor={productColor}
                  recommendations={recommendations}
                  onRecommendationFetched={onRecommendationFetched}
                  onAccept={onAccept}
                  onDecline={onDecline}
                />
              ))}
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </div>
  )
}

function InventoryProductCard({
  product,
  countryRisks,
  onProductUpdate,
  onRemove,
}: {
  product: Product
  countryRisks: CountryRisk[]
  onProductUpdate: (product: Product) => void
  onRemove: () => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [recommendations, setRecommendations] = useState<Record<string, RecommendationState>>({})
  const productFetchedRef = useRef(false)

  const countryData = countryRisks.find((c) => c.name === product.country)
  const isProductHighRisk = (countryData?.overallRisk ?? 0) >= 60

  const productRecState = recommendations[product.id]

  useEffect(() => {
    if (!isProductHighRisk || productFetchedRef.current || productRecState) return
    productFetchedRef.current = true

    setRecommendations((prev) => ({
      ...prev,
      [product.id]: { status: "loading", data: null, error: null },
    }))

    fetch("/api/ai/alternatives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        country: product.country,
        itemType: "product",
        itemName: product.name,
        currentRisk: countryData?.overallRisk ?? 50,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setRecommendations((prev) => ({
            ...prev,
            [product.id]: { status: "idle", data: null, error: data.error },
          }))
        } else {
          const alt = data.alternatives?.[0]
          if (alt) {
            setRecommendations((prev) => ({
              ...prev,
              [product.id]: {
                status: "recommended",
                data: { country: alt.country, risk: alt.risk, reason: alt.reason },
                error: null,
              },
            }))
          } else {
            setRecommendations((prev) => ({
              ...prev,
              [product.id]: { status: "idle", data: null, error: "No alternatives found" },
            }))
          }
        }
      })
      .catch(() => {
        setRecommendations((prev) => ({
          ...prev,
          [product.id]: { status: "idle", data: null, error: "Failed to fetch recommendation" },
        }))
      })
  }, [isProductHighRisk, product.id, product.country, product.name, countryData?.overallRisk, productRecState])

  const handleRecommendationFetched = useCallback((itemId: string, rec: RecommendationState) => {
    setRecommendations((prev) => ({ ...prev, [itemId]: rec }))
  }, [])

  const updateItemCountry = (itemId: string, newCountry: string): SupplyChainItem[] => {
    const update = (items: SupplyChainItem[]): SupplyChainItem[] =>
      items.map((item) => {
        if (item.id === itemId) return { ...item, country: newCountry }
        return { ...item, children: update(item.children) }
      })
    return update(product.components)
  }

  const handleAccept = useCallback((itemId: string) => {
    const rec = recommendations[itemId]
    if (!rec?.data) return

    setRecommendations((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status: "accepted" },
    }))

    if (itemId === product.id) {
      onProductUpdate({ ...product, country: rec.data.country })
    } else {
      onProductUpdate({ ...product, components: updateItemCountry(itemId, rec.data.country) })
    }
  }, [recommendations, product, onProductUpdate])

  const handleDecline = useCallback((itemId: string) => {
    setRecommendations((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], status: "declined" },
    }))
  }, [])

  const totalComponents = product.components.length
  const countAllItems = (items: SupplyChainItem[]): number =>
    items.reduce((sum, item) => sum + 1 + countAllItems(item.children), 0)
  const totalItems = countAllItems(product.components)

  return (
    <div className="rounded-xl border border-border bg-card/80">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center gap-3 p-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: product.color }}
          >
            <Package className="h-5 w-5 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {product.name || "Unnamed Product"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {product.country} &middot; {totalComponents} component{totalComponents !== 1 ? "s" : ""} &middot; {totalItems} item{totalItems !== 1 ? "s" : ""}
            </p>
          </div>

          {isProductHighRisk && (
            <Badge variant="destructive" className="shrink-0 gap-0.5 text-[10px]">
              <AlertTriangle className="h-2.5 w-2.5" />
              {countryData?.overallRisk}%
            </Badge>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Product-level recommendation */}
        {isProductHighRisk && productRecState && (
          <div className="px-3 pb-2">
            {productRecState.status === "loading" && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Getting AI recommendation...</span>
              </div>
            )}

            {productRecState.status === "recommended" && productRecState.data && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Recommendation for product location
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{productRecState.data.country}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{productRecState.data.reason}</p>
                  </div>
                  <Badge
                    variant={productRecState.data.risk === "low" ? "secondary" : productRecState.data.risk === "high" ? "destructive" : "default"}
                    className="shrink-0 text-[10px]"
                  >
                    {productRecState.data.risk} risk
                  </Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 flex-1 gap-1 bg-green-600 text-xs text-white hover:bg-green-700"
                    onClick={() => handleAccept(product.id)}
                  >
                    <Check className="h-3 w-3" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 gap-1 text-xs"
                    onClick={() => handleDecline(product.id)}
                  >
                    <XCircle className="h-3 w-3" />
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {productRecState.status === "accepted" && productRecState.data && (
              <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2">
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs text-green-700">
                  Relocated to <span className="font-semibold">{productRecState.data.country}</span>
                </span>
              </div>
            )}

            {productRecState.status === "declined" && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Recommendation declined — keeping {product.country}
                </span>
              </div>
            )}

            {productRecState.error && productRecState.status === "idle" && (
              <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs text-destructive">{productRecState.error}</span>
              </div>
            )}
          </div>
        )}

        <CollapsibleContent>
          <div className="space-y-1.5 border-t border-border px-3 py-2.5">
            {product.components.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">No components</p>
            ) : (
              product.components.map((component) => (
                <InventoryItemRow
                  key={component.id}
                  item={component}
                  depth={0}
                  countryRisks={countryRisks}
                  productColor={product.color}
                  recommendations={recommendations}
                  onRecommendationFetched={handleRecommendationFetched}
                  onAccept={handleAccept}
                  onDecline={handleDecline}
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

export function InventorySidebar({
  isOpen,
  onClose,
  countryRisks,
  inventoryProducts,
  onInventoryProductsChange,
  onProductUpdate,
}: InventorySidebarProps) {
  if (!isOpen) return null

  const handleProductUpdate = (updated: Product) => {
    onInventoryProductsChange(
      inventoryProducts.map((p) => (p.id === updated.id ? updated : p))
    )

    if (onProductUpdate) {
      onProductUpdate(updated)
    }
  }

  const handleRemoveProduct = (productId: string) => {
    onInventoryProductsChange(inventoryProducts.filter((p) => p.id !== productId))
  }

  return (
    <div className="flex h-full w-80 flex-col border-r border-sidebar-border bg-sidebar animate-in slide-in-from-left-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <List className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-sidebar-foreground">Inventory</h2>
          {inventoryProducts.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {inventoryProducts.length}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-3 p-4">
          {inventoryProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/20" />
              <p className="mt-3 text-sm font-medium text-muted-foreground">No products in inventory</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Add products from the Products panel to track them here
              </p>
            </div>
          ) : (
            inventoryProducts.map((product) => (
              <InventoryProductCard
                key={product.id}
                product={product}
                countryRisks={countryRisks}
                onProductUpdate={handleProductUpdate}
                onRemove={() => handleRemoveProduct(product.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <p className="text-center text-[10px] text-muted-foreground">
          High-risk items automatically receive AI relocation recommendations
        </p>
      </div>
    </div>
  )
}
