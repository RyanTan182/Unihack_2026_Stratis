"use client"

import { useState, useEffect, useRef } from "react"
import {
  ChevronLeft,
  ChevronDown,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Boxes,
  Box,
  Fuel,
  X,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Loader2,
  Globe,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FoundRoute } from "@/lib/route-types"
import type { SupplyChainInsights, ComponentRisk as ComponentRiskData } from "@/lib/supply-chain-analyzer"
import type { MapProduct, MapSupplyChainItem } from "@/lib/decompose/to-map-product"
import { EmptyState } from "./ui/empty-state"

export interface CountryRisk {
  id: string
  name: string
  type: "country" | "chokepoint"
  importRisk: number
  exportRisk: number
  overallRisk: number
  newsHighlights: string[]
}

type ItemType = "product" | "component" | "material" | "resource"

interface SupplyChainItem {
  id: string
  name: string
  type: ItemType
  country: string
  riskPrediction: number
  riskDirection: "up" | "down"
  children: SupplyChainItem[]
  isExpanded?: boolean
}

interface Product {
  id: string
  name: string
  type: "product"
  country: string
  destinationCountry: string // User-specified destination for route calculations
  color: string
  riskPrediction: number
  riskDirection: "up" | "down"
  components: SupplyChainItem[]
}

type AlternativeEntry = { country: string; risk: string; reason: string }

interface ProductSupplyChainProps {
  isOpen: boolean
  onClose: () => void
  countryRisks: CountryRisk[]
  products: Product[]
  onProductsChange: (products: Product[]) => void
  preloadedAlternatives?: Record<string, AlternativeEntry[]>
  altScanLoading?: boolean
  onAddToInventory?: (product: Product) => void
  inventoryProductIds?: string[]
  /** When set, add an item of this type in this country (from map right-click) */
  mapAddRequest?: { country: string; itemType: ItemType } | null
  onClearMapAddRequest?: () => void
  // New props for insights and route integration
  insights?: SupplyChainInsights
  onFindSafeRoute?: (origin: string, destination: string, itemName: string) => void
  foundRoutes?: FoundRoute[]
  selectedFoundRouteId?: string | null
  onClearFoundRoutes?: () => void
  onViewAlternatives?: (component: { componentId: string; componentName: string; country: string; risk: number }, parentCountry: string) => void
  mapProducts?: MapProduct[]
}

// Modern product palette with glow effects
const PRODUCT_COLORS = [
  "#06b6d4", // Cyan
  "#22c55e", // Green
  "#f59e0b", // Amber
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#ef4444", // Red
]

const itemTypeConfig: Record<ItemType, { icon: typeof Package; color: string; label: string }> = {
  product: { icon: Package, color: "text-white", label: "Product" },
  component: { icon: Boxes, color: "text-white", label: "Component" },
  material: { icon: Box, color: "text-white", label: "Material" },
  resource: { icon: Fuel, color: "text-white", label: "Resource" },
}

// Adjust hex color opacity by blending with dark background
function adjustColorAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const br = Math.round(r * alpha + 15 * (1 - alpha))
  const bg = Math.round(g * alpha + 23 * (1 - alpha))
  const bb = Math.round(b * alpha + 42 * (1 - alpha))
  return `rgb(${br},${bg},${bb})`
}

// Calculate risk for an item based on its children and country
const calculateItemRisk = (item: SupplyChainItem, countryRisks: CountryRisk[]): number => {
  const countryRisk = countryRisks.find(c => c.name === item.country)
  const baseRisk = countryRisk?.overallRisk || 30

  if (item.children.length === 0) {
    return baseRisk
  }

  // Calculate combined risk from children
  const childrenRisks = item.children.map(child => calculateItemRisk(child, countryRisks))
  const avgChildRisk = childrenRisks.reduce((sum, r) => sum + r, 0) / childrenRisks.length
  const maxChildRisk = Math.max(...childrenRisks)

  // Weighted combination: own country risk + children risk propagation
  return Math.round(baseRisk * 0.4 + avgChildRisk * 0.4 + maxChildRisk * 0.2)
}

// Analyze supply chain for dangerous routes
interface RouteAnalysis {
  totalRoutes: number
  dangerousRoutes: number
  safeRoutes: number
  highestRisk: number
  riskLocations: { country: string; risk: number; items: string[] }[]
}

const analyzeSupplyChain = (products: Product[], countryRisks: CountryRisk[]): RouteAnalysis => {
  const DANGER_THRESHOLD = 60
  const routes: { from: string; to: string; risk: number }[] = []
  const locationRisks = new Map<string, { risk: number; items: string[] }>()

  const getCountryRisk = (country: string): number => {
    const risk = countryRisks.find(c => c.name === country)
    return risk?.overallRisk || 30
  }

  const addLocation = (country: string, itemName: string) => {
    const existing = locationRisks.get(country)
    const risk = getCountryRisk(country)
    if (existing) {
      existing.items.push(itemName)
    } else {
      locationRisks.set(country, { risk, items: [itemName] })
    }
  }

  const processItem = (item: SupplyChainItem, parentCountry: string) => {
    addLocation(item.country, item.name || item.type)
    if (item.country !== parentCountry) {
      const fromRisk = getCountryRisk(item.country)
      const toRisk = getCountryRisk(parentCountry)
      routes.push({ from: item.country, to: parentCountry, risk: Math.round((fromRisk + toRisk) / 2) })
    }
    item.children.forEach(child => processItem(child, item.country))
  }

  products.forEach(product => {
    addLocation(product.country, product.name || "Product")
    product.components.forEach(comp => processItem(comp, product.country))
  })

  const dangerousRoutes = routes.filter(r => r.risk >= DANGER_THRESHOLD).length
  const riskLocations = Array.from(locationRisks.entries())
    .map(([country, data]) => ({ country, ...data }))
    .filter(loc => loc.risk >= DANGER_THRESHOLD)
    .sort((a, b) => b.risk - a.risk)

  return {
    totalRoutes: routes.length,
    dangerousRoutes,
    safeRoutes: routes.length - dangerousRoutes,
    highestRisk: routes.length > 0 ? Math.max(...routes.map(r => r.risk)) : 0,
    riskLocations,
  }
}

function SupplyChainItemRow({
  item,
  depth,
  countryRisks,
  productColor,
  onUpdate,
  onDelete,
  preloadedAlts,
  allPreloadedAlternatives,
  onAddChild,
  onFindSafeRoute,
  onViewAlternatives,
  parentDestination,
}: {
  item: SupplyChainItem
  depth: number
  countryRisks: CountryRisk[]
  productColor: string
  onUpdate: (item: SupplyChainItem) => void
  onDelete: () => void
  preloadedAlts?: AlternativeEntry[]
  allPreloadedAlternatives?: Record<string, AlternativeEntry[]>
  onAddChild: (parentId: string, type: ItemType) => void
  onFindSafeRoute?: (origin: string, destination: string, itemName: string) => void
  onViewAlternatives?: (component: { componentId: string; componentName: string; country: string; risk: number }, parentCountry: string) => void
  parentDestination?: string
}) {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded ?? true)
  const [alternatives, setAlternatives] = useState<AlternativeEntry[]>(preloadedAlts ?? [])
  const [altLoading, setAltLoading] = useState(false)
  const [altError, setAltError] = useState<string | null>(null)

  const prevPreloadedRef = useRef(preloadedAlts)
  if (preloadedAlts !== prevPreloadedRef.current) {
    prevPreloadedRef.current = preloadedAlts
    if (preloadedAlts && preloadedAlts.length > 0) {
      setAlternatives(preloadedAlts)
    }
  }
  const config = itemTypeConfig[item.type]
  const Icon = config.icon
  const hasChildren = item.children.length > 0

  const countryData = countryRisks.find((c) => c.name === item.country)
  const isHighRisk = (countryData?.overallRisk ?? 0) >= 60

  const fetchAlternatives = () => {
    setAltLoading(true)
    setAltError(null)
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
          setAltError(data.error)
        } else {
          setAlternatives(data.alternatives ?? [])
        }
      })
      .catch(() => setAltError("Failed to fetch alternatives"))
      .finally(() => setAltLoading(false))
  }

  // Style the product color based on depth
  const iconBg = item.type === "product" ? productColor : adjustColorAlpha(productColor, 0.7 - depth * 0.1)

  return (
    <div className="relative">
      {/* Connecting line for nested items */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 h-full border-l border-border/30"
          style={{ marginLeft: `${(depth - 1) * 16 + 12}px` }}
        />
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          className="group flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/50 p-2.5 transition-all hover:border-primary/30 hover:bg-card/80"
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 hover:bg-muted">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    !isExpanded && "-rotate-90"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-6" />
          )}

          {/* Icon */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-lg"
            style={{
              backgroundColor: iconBg,
              boxShadow: `0 4px 12px ${productColor}30`
            }}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>

          {/* Name + Risk */}
          <div className="min-w-0 flex-1">
            <Input
              value={item.name}
              onChange={(e) => onUpdate({ ...item, name: e.target.value })}
              className="h-auto border-0 bg-transparent p-0 text-sm font-medium shadow-none focus-visible:ring-0 whitespace-normal break-words"
              placeholder={`${config.label} name...`}
            />
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                "text-[10px] font-semibold",
                item.riskPrediction >= 70 ? "text-red-400" :
                item.riskPrediction >= 40 ? "text-yellow-400" : "text-emerald-400"
              )}>
                {item.riskPrediction}% risk
              </span>
              <span className="text-[10px] text-muted-foreground">{item.country}</span>
            </div>
          </div>

          {/* Location + Risk Badge */}
          <div className="flex items-center gap-1 min-w-0">
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-[10px] text-muted-foreground">Location</span>
              <Select
                value={item.country}
                onValueChange={(country) => onUpdate({ ...item, country })}
              >
                <SelectTrigger className="h-7 w-[90px] border-0 bg-transparent p-0 text-xs font-medium shadow-none focus:ring-0">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {countryRisks
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((country) => (
                      <SelectItem key={country.id} value={country.name}>
                        {country.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {isHighRisk && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="shrink-0 rounded-full">
                    <Badge
                      variant="destructive"
                      className="cursor-pointer gap-1 border-0 text-[10px] font-medium"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {countryData?.overallRisk}%
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 rounded-xl border-border/50 bg-card/95 p-3 shadow-xl backdrop-blur-xl" side="left">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.country}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Risk: {countryData!.overallRisk}% — Import: {countryData!.importRisk}% / Export: {countryData!.exportRisk}%
                      </p>
                    </div>

                    {alternatives.length === 0 && !altLoading && !altError && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                        onClick={fetchAlternatives}
                      >
                        <Globe className="h-3 w-3" />
                        Suggest alternative locations
                      </Button>
                    )}

                    {altLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Finding alternatives...
                      </div>
                    )}

                    {altError && (
                      <p className="text-xs text-red-400">{altError}</p>
                    )}

                    {alternatives.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Alternatives:</p>
                        {alternatives.map((alt, i) => (
                          <button
                            key={i}
                            className="flex w-full items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 text-left transition-colors hover:bg-muted/50 hover:border-primary/30"
                            onClick={() => onUpdate({ ...item, country: alt.country })}
                          >
                            <div>
                              <p className="text-xs font-medium text-foreground">{alt.country}</p>
                              <p className="text-[10px] text-muted-foreground">{alt.reason}</p>
                            </div>
                            <Badge
                              variant={alt.risk === "low" ? "secondary" : alt.risk === "high" ? "destructive" : "default"}
                              className="ml-2 shrink-0 border-0 text-[10px]"
                            >
                              {alt.risk}
                            </Badge>
                          </button>
                        ))}
                        <p className="text-[10px] text-muted-foreground">Click to switch location</p>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Delete button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 hover:text-red-400 transition-all"
            onClick={onDelete}
            aria-label={`Delete ${item.name || item.type}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Children */}
        <CollapsibleContent>
          <div className="mt-2 space-y-2">
            {item.children.map((child, index) => (
              <SupplyChainItemRow
                key={child.id}
                item={child}
                depth={depth + 1}
                countryRisks={countryRisks}
                productColor={productColor}
                onUpdate={(updated) => {
                  const newChildren = [...item.children]
                  newChildren[index] = updated
                  onUpdate({ ...item, children: newChildren })
                }}
                onDelete={() => {
                  const newChildren = item.children.filter((_, i) => i !== index)
                  onUpdate({ ...item, children: newChildren })
                }}
                preloadedAlts={allPreloadedAlternatives?.[child.id]}
                allPreloadedAlternatives={allPreloadedAlternatives}
                onAddChild={onAddChild}
                onFindSafeRoute={onFindSafeRoute}
                onViewAlternatives={onViewAlternatives}
                parentDestination={parentDestination}
              />
            ))}

            {/* Child-add removed: products are created via Inventory */}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function MapPreviewItem({
  item,
  depth,
  productColor,
}: {
  item: MapSupplyChainItem
  depth: number
  productColor: string
}) {
  const riskColor = item.riskPrediction >= 70 ? "text-red-400" :
    item.riskPrediction >= 40 ? "text-yellow-400" : "text-emerald-400"

  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-lg px-2 py-1.5"
        style={{ marginLeft: `${depth * 12}px` }}
      >
        <div
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: productColor }}
        />
        <span className="text-xs font-medium text-foreground flex-1 break-words">{item.name}</span>
        <span className="text-[10px] text-muted-foreground">{item.country}</span>
        <span className={cn("text-[10px] font-semibold", riskColor)}>
          {item.riskPrediction}%
        </span>
        {item.isPredicted && (
          <span className="text-[9px] text-muted-foreground italic">pred</span>
        )}
      </div>
      {item.children.map((child) => (
        <MapPreviewItem key={child.id} item={child} depth={depth + 1} productColor={productColor} />
      ))}
    </div>
  )
}

function ProductListItem({
  product,
  countryRisks,
  onClick,
}: {
  product: Product
  countryRisks: CountryRisk[]
  onClick: () => void
}) {
  const Icon = itemTypeConfig.product.icon

  const calculateTotalProductRisk = (product: Product): number => {
    const countryRisk = countryRisks.find(c => c.name === product.country)
    const baseRisk = countryRisk?.overallRisk || 30
    if (product.components.length === 0) return baseRisk
    const componentRisks = product.components.map(c => calculateItemRisk(c, countryRisks))
    const avgRisk = componentRisks.reduce((sum, r) => sum + r, 0) / componentRisks.length
    const maxRisk = Math.max(...componentRisks)
    return Math.round(baseRisk * 0.3 + avgRisk * 0.4 + maxRisk * 0.3)
  }

  const totalRisk = calculateTotalProductRisk(product)

  return (
    <button
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border/50 bg-card/50 p-4 text-left transition-all hover:border-primary/30 hover:bg-card/80"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg"
        style={{
          backgroundColor: product.color,
          boxShadow: `0 8px 20px ${product.color}25`
        }}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{product.name || "Unnamed Product"}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-muted-foreground">{product.components.length} component{product.components.length !== 1 ? "s" : ""}</span>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {product.country} → {product.destinationCountry}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[10px] text-muted-foreground">Prediction</span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-sm font-semibold",
              product.riskDirection === "up" ? "text-red-400" : "text-emerald-400"
            )}
          >
            {product.riskPrediction}%
          </span>
          {product.riskDirection === "up" ? (
            <TrendingUp className="h-4 w-4 text-red-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-emerald-400" />
          )}
        </div>
      </div>

      <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground group-hover:text-primary [@media(hover:none)]:text-primary transition-colors" />
    </button>
  )
}

export function ProductSupplyChain({
  isOpen,
  onClose,
  countryRisks,
  products,
  onProductsChange,
  preloadedAlternatives,
  altScanLoading,
  onAddToInventory,
  inventoryProductIds = [],
  mapAddRequest,
  onClearMapAddRequest,
  // New props for insights and route integration
  insights,
  onFindSafeRoute,
  foundRoutes,
  selectedFoundRouteId,
  onClearFoundRoutes,
  onViewAlternatives,
  mapProducts = [],
}: ProductSupplyChainProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [view, setView] = useState<"list" | "detail">("list")

  const selectedProduct = products.find((p) => p.id === selectedProductId)
  const selectedMapProduct = mapProducts.find((mp) => mp.id === selectedProductId)

  const generatePrediction = (base: number) => {
    const value = base + Math.floor(Math.random() * 20)
    const direction: "up" | "down" = Math.random() > 0.5 ? "up" : "down"
    return { value, direction }
  }

  // Handle map right-click add request
  useEffect(() => {
    if (!mapAddRequest || !onClearMapAddRequest) return

    const { country, itemType } = mapAddRequest
    const prediction = generatePrediction(45)

    if (itemType === "product") {
      const color = PRODUCT_COLORS[products.length % PRODUCT_COLORS.length]
      const newProduct: Product = {
        id: `product-${Date.now()}`,
        name: "",
        type: "product",
        country,
        destinationCountry: "United States",
        color,
        riskPrediction: prediction.value,
        riskDirection: prediction.direction,
        components: [],
      }
      onProductsChange([...products, newProduct])
      setSelectedProductId(newProduct.id)
      setView("detail")
    } else {
      const targetProduct = selectedProduct ?? products[0]
      if (!targetProduct) return

      const newItem: SupplyChainItem = {
        id: `${itemType}-${Date.now()}`,
        name: "",
        type: itemType,
        country,
        riskPrediction: prediction.value,
        riskDirection: prediction.direction,
        children: [],
        isExpanded: true,
      }

      onProductsChange(
        products.map((p) =>
          p.id === targetProduct.id
            ? { ...p, components: [...p.components, newItem] }
            : p
        )
      )
      setSelectedProductId(targetProduct.id)
      setView("detail")
    }

    onClearMapAddRequest()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run when mapAddRequest is set
  }, [mapAddRequest])

  const updateProduct = (updated: Product) => {
    onProductsChange(products.map((p) => (p.id === updated.id ? updated : p)))
  }

  const deleteProduct = (productId: string) => {
    onProductsChange(products.filter((p) => p.id !== productId))
    if (selectedProductId === productId) {
      setSelectedProductId(null)
      setView("list")
    }
  }

  const addChildToItem = (parentId: string, type: ItemType) => {
    if (!selectedProduct) return
    const prediction = generatePrediction(40)
    const newItem: SupplyChainItem = {
      id: `${type}-${Date.now()}`,
      name: "",
      type,
      country: "China",
      riskPrediction: prediction.value,
      riskDirection: prediction.direction,
      children: [],
      isExpanded: true,
    }
    const addChild = (items: SupplyChainItem[]): SupplyChainItem[] =>
      items.map((item) =>
        item.id === parentId
          ? { ...item, children: [...item.children, newItem], isExpanded: true }
          : { ...item, children: addChild(item.children) }
      )
    updateProduct({
      ...selectedProduct,
      components: selectedProduct.id === parentId
        ? [...selectedProduct.components, newItem]
        : addChild(selectedProduct.components),
    })
  }

  if (!isOpen) return null

  return (
    <div className="absolute right-4 top-100 z-20 w-[380px] animate-in slide-in-from-right-4">
      <Card className="max-h-[calc(100vh-6rem)] overflow-hidden border-border/50 bg-card/60 shadow-2xl backdrop-blur-xl">
        <CardContent className="p-0">
          {view === "list" ? (
            // Product List View
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-border/50 p-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Products</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Supply chain management</p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-muted">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
                {products.length === 0 ? (
                  <EmptyState
                    icon={<Package className="h-7 w-7 text-muted-foreground/50" />}
                    title="No products tracked yet"
                    description="Create a product in the Inventory panel to track its supply chain here"
                  />
                ) : (
                  products.map((product) => (
                    <ProductListItem
                      key={product.id}
                      product={product}
                      countryRisks={countryRisks}
                      onClick={() => {
                        setSelectedProductId(product.id)
                        setView("detail")
                      }}
                    />
                  ))
                )}

                {/* Risk Analysis Summary */}
                {products.length > 0 && (() => {
                  const analysis = analyzeSupplyChain(products, countryRisks)
                  if (analysis.totalRoutes === 0) return null

                  return (
                    <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <MapPin className="h-4 w-4 text-primary" />
                        Route Risk Analysis
                      </h3>

                      {/* Risk Stats */}
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-card/50 border border-border/30 p-3">
                          <p className="text-[10px] text-muted-foreground">Total Routes</p>
                          <p className="text-xl font-bold text-foreground mt-0.5">{analysis.totalRoutes}</p>
                        </div>
                        <div className="rounded-lg bg-card/50 border border-border/30 p-3">
                          <p className="text-[10px] text-muted-foreground">Highest Risk</p>
                          <p className={cn("text-xl font-bold mt-0.5", analysis.highestRisk >= 60 ? "text-red-400" : "text-emerald-400")}>
                            {analysis.highestRisk}%
                          </p>
                        </div>
                      </div>

                      {/* Route Status */}
                      <div className="mb-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <span className="text-red-400 font-medium">{analysis.dangerousRoutes}</span>
                          <span className="text-muted-foreground text-xs">dangerous</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                          <span className="text-emerald-400 font-medium">{analysis.safeRoutes}</span>
                          <span className="text-muted-foreground text-xs">safe</span>
                        </div>
                      </div>

                      {/* High Risk Locations */}
                      {analysis.riskLocations.length > 0 && (
                        <div className="border-t border-border/30 pt-3">
                          <p className="mb-2 text-xs font-medium text-red-400 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            High Risk Locations
                          </p>
                          <div className="space-y-1.5">
                            {analysis.riskLocations.slice(0, 3).map((loc) => (
                              <div key={loc.country} className="flex items-center justify-between rounded-lg bg-red-500/5 border border-red-500/10 px-3 py-2">
                                <span className="text-sm font-medium text-foreground">{loc.country}</span>
                                <span className="text-xs font-semibold text-red-400">{loc.risk}% risk</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              {altScanLoading && (
                <div className="mx-4 mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-primary font-medium">
                      Scanning for alternative locations...
                    </span>
                  </div>
                </div>
              )}

            </div>
          ) : (
            // Product Detail View
            <div className="flex flex-col">
              <div className="border-b border-border/50 p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-3 -ml-2 gap-1 text-muted-foreground hover:text-foreground"
                  onClick={() => setView("list")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Product list
                </Button>

                {selectedProduct && (
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg"
                      style={{
                        backgroundColor: selectedProduct.color,
                        boxShadow: `0 8px 20px ${selectedProduct.color}25`
                      }}
                    >
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Input
                          value={selectedProduct.name}
                          onChange={(e) =>
                            updateProduct({ ...selectedProduct, name: e.target.value })
                          }
                          className="h-auto border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                          placeholder="Product name..."
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10px] text-muted-foreground">Origin</span>
                          <Select
                            value={selectedProduct.country}
                            onValueChange={(country) =>
                              updateProduct({ ...selectedProduct, country })
                            }
                          >
                            <SelectTrigger className="h-7 w-[100px] border-0 bg-transparent p-0 text-xs font-medium shadow-none focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {countryRisks
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((country) => (
                                  <SelectItem key={country.id} value={country.name}>
                                    {country.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10px] text-muted-foreground">Destination</span>
                          <Select
                            value={selectedProduct.destinationCountry}
                            onValueChange={(destinationCountry) =>
                              updateProduct({ ...selectedProduct, destinationCountry })
                            }
                          >
                            <SelectTrigger className="h-7 w-[100px] border-0 bg-transparent p-0 text-xs font-medium shadow-none focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {countryRisks
                                .filter(c => c.type === "country")
                                .sort((a, b) => a.name.localeCompare(b.name))
                                .map((country) => (
                                  <SelectItem key={country.id} value={country.name}>
                                    {country.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-red-400"
                      onClick={() => deleteProduct(selectedProduct.id)}
                      aria-label={`Delete ${selectedProduct.name || 'product'}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {altScanLoading && (
                  <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-[10px] text-primary font-medium">
                        Scanning for alternative locations...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="max-h-[50vh] space-y-2 overflow-y-auto p-4">
                {selectedProduct?.components.map((component, index) => (
                  <SupplyChainItemRow
                    key={component.id}
                    item={component}
                    depth={0}
                    countryRisks={countryRisks}
                    productColor={selectedProduct.color}
                    onUpdate={(updated) => {
                      const newComponents = [...selectedProduct.components]
                      newComponents[index] = updated
                      updateProduct({ ...selectedProduct, components: newComponents })
                    }}
                    onDelete={() => {
                      const newComponents = selectedProduct.components.filter(
                        (_, i) => i !== index
                      )
                      updateProduct({ ...selectedProduct, components: newComponents })
                    }}
                    preloadedAlts={preloadedAlternatives?.[component.id]}
                    allPreloadedAlternatives={preloadedAlternatives}
                    onAddChild={addChildToItem}
                    onFindSafeRoute={onFindSafeRoute}
                    onViewAlternatives={onViewAlternatives}
                    parentDestination={selectedProduct.destinationCountry}
                  />
                ))}

                {selectedProduct && selectedProduct.components.length === 0 && (
                  <EmptyState
                    icon={<Boxes className="h-7 w-7 text-muted-foreground/50" />}
                    title="No components"
                    description="This product has no supply chain components yet"
                  />
                )}

                {/* Map Product Preview */}
                {selectedMapProduct && selectedMapProduct.components.length > 0 && (
                  <div className="mt-4 rounded-xl border border-border/50 bg-muted/30 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="h-4 w-4 text-primary" />
                      Map Supply Chain
                    </h3>
                    <div className="space-y-2">
                      {selectedMapProduct.components.map((item) => (
                        <MapPreviewItem key={item.id} item={item} depth={0} productColor={selectedMapProduct.color} />
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: selectedMapProduct.color }} />
                        {selectedMapProduct.country}
                      </span>
                      <span>
                        Risk: <span className={cn(
                          "font-semibold",
                          selectedMapProduct.riskPrediction >= 50 ? "text-red-400" : "text-emerald-400"
                        )}>
                          {selectedMapProduct.riskPrediction}%
                        </span>
                      </span>
                      {selectedMapProduct.isPredicted && (
                        <Badge variant="secondary" className="text-[10px]">Predicted</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export type { Product, SupplyChainItem }
