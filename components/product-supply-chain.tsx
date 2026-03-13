"use client"

import { useState } from "react"
import {
  ChevronLeft,
  ChevronDown,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Package,
  Boxes,
  Box,
  Fuel,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  MapPin,
  Loader2,
  Globe,
  List,
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface CountryRisk {
  id: string
  name: string
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
  color: string
  riskPrediction: number
  riskDirection: "up" | "down"
  components: SupplyChainItem[]
}

interface ProductSupplyChainProps {
  isOpen: boolean
  onClose: () => void
  countryRisks: CountryRisk[]
  products: Product[]
  onProductsChange: (products: Product[]) => void
  onAddToInventory?: (product: Product) => void
  inventoryProductIds?: string[]
}

// Distinct product palette — each new product cycles through these
const PRODUCT_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#ea580c", // orange
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#db2777", // pink
  "#ca8a04", // yellow
  "#dc2626", // red
]

const itemTypeConfig: Record<ItemType, { icon: typeof Package; color: string; label: string }> = {
  product: { icon: Package, color: "text-white", label: "Product" },
  component: { icon: Boxes, color: "text-white", label: "Component" },
  material: { icon: Box, color: "text-white", label: "Material" },
  resource: { icon: Fuel, color: "text-white", label: "Resource" },
}

// Adjust hex color opacity by blending with white
function adjustColorAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const br = Math.round(r * alpha + 255 * (1 - alpha))
  const bg = Math.round(g * alpha + 255 * (1 - alpha))
  const bb = Math.round(b * alpha + 255 * (1 - alpha))
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

// Generate a random but consistent prediction
const generatePrediction = (baseRisk: number): { value: number; direction: "up" | "down" } => {
  const variance = Math.floor(Math.random() * 15) + 3
  const direction = baseRisk > 50 ? "up" : Math.random() > 0.5 ? "up" : "down"
  return { value: variance, direction }
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
  onAddChild,
}: {
  item: SupplyChainItem
  depth: number
  countryRisks: CountryRisk[]
  productColor: string
  onUpdate: (item: SupplyChainItem) => void
  onDelete: () => void
  onAddChild: (parentId: string, type: ItemType) => void
}) {
  const [isExpanded, setIsExpanded] = useState(item.isExpanded ?? true)
  const [alternatives, setAlternatives] = useState<{ country: string; risk: string; reason: string }[]>([])
  const [altLoading, setAltLoading] = useState(false)
  const [altError, setAltError] = useState<string | null>(null)
  const config = itemTypeConfig[item.type]
  const Icon = config.icon
  const hasChildren = item.children.length > 0
  const canAddChildren = item.type !== "resource" && depth < 4

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

  // Lighten the product color for child items based on depth
  const iconBg = item.type === "product" ? productColor : adjustColorAlpha(productColor, 0.7 - depth * 0.1)

  const availableChildTypes: ItemType[] =
    item.type === "product"
      ? ["component", "material", "resource"]
      : item.type === "component"
        ? ["material", "resource"]
        : item.type === "material"
          ? ["resource"]
          : []

  return (
    <div className="relative">
      {/* Connecting line for nested items */}
      {depth > 0 && (
        <div
          className="absolute left-0 top-0 h-full border-l-2 border-border"
          style={{ marginLeft: `${(depth - 1) * 24 + 20}px` }}
        />
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div
          className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-sm"
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
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
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: iconBg }}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>

          {/* Name */}
          <div className="min-w-0 flex-1">
            <Input
              value={item.name}
              onChange={(e) => onUpdate({ ...item, name: e.target.value })}
              className="h-8 border-0 bg-transparent p-0 text-base font-medium shadow-none focus-visible:ring-0"
              placeholder={`${config.label} name...`}
            />
          </div>

          {/* Location + Risk Badge */}
          <div className="flex items-center gap-1.5">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs text-muted-foreground">Location</span>
              <Select
                value={item.country}
                onValueChange={(country) => onUpdate({ ...item, country })}
              >
                <SelectTrigger className="h-7 w-[130px] border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0">
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
                    <Badge variant="destructive" className="cursor-pointer gap-1 text-[10px]">
                      <AlertTriangle className="h-3 w-3" />
                      {countryData?.overallRisk}%
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3" side="left">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.country}</p>
                      <p className="text-xs text-muted-foreground">
                        Risk: {countryData!.overallRisk}% — Import: {countryData!.importRisk}% / Export: {countryData!.exportRisk}%
                      </p>
                    </div>

                    {alternatives.length === 0 && !altLoading && !altError && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-xs"
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
                      <p className="text-xs text-destructive">{altError}</p>
                    )}

                    {alternatives.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground">Alternatives:</p>
                        {alternatives.map((alt, i) => (
                          <button
                            key={i}
                            className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                            onClick={() => onUpdate({ ...item, country: alt.country })}
                          >
                            <div>
                              <p className="text-xs font-medium text-foreground">{alt.country}</p>
                              <p className="text-[10px] text-muted-foreground">{alt.reason}</p>
                            </div>
                            <Badge
                              variant={alt.risk === "low" ? "secondary" : alt.risk === "high" ? "destructive" : "default"}
                              className="ml-2 shrink-0 text-[10px]"
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
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>

          <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
                onAddChild={onAddChild}
              />
            ))}

            {/* Add child button */}
            {canAddChildren && (
              <div
                className="flex items-center gap-2"
                style={{ marginLeft: `${(depth + 1) * 24}px` }}
              >
                {availableChildTypes.map((type) => (
                  <Button
                    key={type}
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => onAddChild(item.id, type)}
                  >
                    <Plus className="h-3 w-3" />
                    Add {itemTypeConfig[type].label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
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
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: product.color }}
      >
        <Icon className="h-6 w-6 text-white" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{product.name || "Unnamed Product"}</p>
        <p className="text-sm text-muted-foreground">
          {product.components.length} component{product.components.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-muted-foreground">Prediction</span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "text-sm font-semibold",
              product.riskDirection === "up" ? "text-red-500" : "text-green-500"
            )}
          >
            {product.riskPrediction}%
          </span>
          {product.riskDirection === "up" ? (
            <TrendingUp className="h-4 w-4 text-red-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-green-500" />
          )}
        </div>
      </div>

      <ChevronDown className="-rotate-90 h-4 w-4 text-muted-foreground" />
    </button>
  )
}

export function ProductSupplyChain({
  isOpen,
  onClose,
  countryRisks,
  products,
  onProductsChange,
  onAddToInventory,
  inventoryProductIds = [],
}: ProductSupplyChainProps) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [view, setView] = useState<"list" | "detail">("list")
  const [aiDialogOpen, setAiDialogOpen] = useState(false)
  const [aiResult, setAiResult] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const selectedProduct = products.find((p) => p.id === selectedProductId)

  const handleAiOptimize = () => {
    if (!selectedProduct) return
    setAiDialogOpen(true)
    setAiLoading(true)
    setAiResult(null)

    const serializeItem = (item: SupplyChainItem): unknown => ({
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
          name: selectedProduct.name || "Unnamed",
          country: selectedProduct.country,
          components: selectedProduct.components.map(serializeItem),
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
  }

  const addProduct = () => {
    const prediction = generatePrediction(35)
    const color = PRODUCT_COLORS[products.length % PRODUCT_COLORS.length]
    const newProduct: Product = {
      id: `product-${Date.now()}`,
      name: "",
      type: "product",
      country: "China",
      color,
      riskPrediction: prediction.value,
      riskDirection: prediction.direction,
      components: [],
    }
    onProductsChange([...products, newProduct])
    setSelectedProductId(newProduct.id)
    setView("detail")
  }

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

    const prediction = generatePrediction(45)
    const newItem: SupplyChainItem = {
      id: `${type}-${Date.now()}`,
      name: "",
      type,
      country: "India",
      riskPrediction: prediction.value,
      riskDirection: prediction.direction,
      children: [],
      isExpanded: true,
    }

    const addToChildren = (items: SupplyChainItem[]): SupplyChainItem[] => {
      return items.map((item) => {
        if (item.id === parentId) {
          return { ...item, children: [...item.children, newItem] }
        }
        return { ...item, children: addToChildren(item.children) }
      })
    }

    if (parentId === selectedProduct.id) {
      // Adding directly to product
      updateProduct({
        ...selectedProduct,
        components: [...selectedProduct.components, newItem],
      })
    } else {
      // Adding to a nested item
      updateProduct({
        ...selectedProduct,
        components: addToChildren(selectedProduct.components),
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="absolute right-4 top-4 z-20 w-[400px] animate-in slide-in-from-right-4">
      <Card className="max-h-[calc(100vh-2rem)] overflow-hidden border-border bg-card/98 shadow-xl backdrop-blur-sm">
        <CardContent className="p-0">
          {view === "list" ? (
            // Product List View
            <div className="flex flex-col">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-lg font-semibold text-foreground">Products</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="max-h-[60vh] space-y-3 overflow-y-auto p-4">
                {products.length === 0 ? (
                  <div className="py-8 text-center">
                    <Package className="mx-auto h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      No products added yet
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Add a product to analyze its supply chain risk
                    </p>
                  </div>
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
                    <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                        <MapPin className="h-4 w-4" />
                        Route Risk Analysis
                      </h3>
                      
                      {/* Risk Stats */}
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-card p-2.5">
                          <p className="text-xs text-muted-foreground">Total Routes</p>
                          <p className="text-lg font-semibold text-foreground">{analysis.totalRoutes}</p>
                        </div>
                        <div className="rounded-lg bg-card p-2.5">
                          <p className="text-xs text-muted-foreground">Highest Risk</p>
                          <p className={cn("text-lg font-semibold", analysis.highestRisk >= 60 ? "text-red-500" : "text-green-500")}>
                            {analysis.highestRisk}%
                          </p>
                        </div>
                      </div>

                      {/* Route Status */}
                      <div className="mb-3 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500/10">
                            <AlertTriangle className="h-3 w-3 text-red-500" />
                          </div>
                          <span className="text-red-500 font-medium">{analysis.dangerousRoutes}</span>
                          <span className="text-muted-foreground">dangerous</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/10">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          </div>
                          <span className="text-green-500 font-medium">{analysis.safeRoutes}</span>
                          <span className="text-muted-foreground">safe</span>
                        </div>
                      </div>

                      {/* High Risk Locations */}
                      {analysis.riskLocations.length > 0 && (
                        <div className="border-t border-border pt-3">
                          <p className="mb-2 text-xs font-medium text-red-500 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            High Risk Locations
                          </p>
                          <div className="space-y-1.5">
                            {analysis.riskLocations.slice(0, 3).map((loc) => (
                              <div key={loc.country} className="flex items-center justify-between rounded-lg bg-red-500/5 px-2.5 py-1.5">
                                <span className="text-sm font-medium text-foreground">{loc.country}</span>
                                <span className="text-xs font-semibold text-red-500">{loc.risk}% risk</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div className="border-t border-border p-4">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={addProduct}
                >
                  <Plus className="h-4 w-4" />
                  Add another product
                </Button>
              </div>
            </div>
          ) : (
            // Product Detail View
            <div className="flex flex-col">
              <div className="border-b border-border p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-3 -ml-2 gap-1 text-muted-foreground"
                  onClick={() => setView("list")}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Product list
                </Button>

                {selectedProduct && (
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: selectedProduct.color }}
                    >
                      <Package className="h-6 w-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Input
                        value={selectedProduct.name}
                        onChange={(e) =>
                          updateProduct({ ...selectedProduct, name: e.target.value })
                        }
                        className="h-auto border-0 bg-transparent p-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                        placeholder="Product name..."
                      />
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-muted-foreground">Location</span>
                      <Select
                        value={selectedProduct.country}
                        onValueChange={(country) =>
                          updateProduct({ ...selectedProduct, country })
                        }
                      >
                        <SelectTrigger className="h-7 w-[110px] border-0 bg-transparent p-0 text-sm font-medium shadow-none focus:ring-0">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteProduct(selectedProduct.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {selectedProduct && onAddToInventory && (
                  <Button
                    variant={inventoryProductIds.includes(selectedProduct.id) ? "secondary" : "outline"}
                    size="sm"
                    className="mt-2 w-full gap-2 text-xs"
                    onClick={() => onAddToInventory(selectedProduct)}
                    disabled={inventoryProductIds.includes(selectedProduct.id)}
                  >
                    <List className="h-3.5 w-3.5" />
                    {inventoryProductIds.includes(selectedProduct.id)
                      ? "Already in Inventory"
                      : "Add to Inventory"}
                  </Button>
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
                    onAddChild={addChildToItem}
                  />
                ))}

                {selectedProduct && selectedProduct.components.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-border py-8 text-center">
                    <Boxes className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">
                      No components added
                    </p>
                  </div>
                )}

                {selectedProduct && (
                  <Button
                    variant="outline"
                    className="mt-2 w-full gap-2"
                    onClick={() => addChildToItem(selectedProduct.id, "component")}
                  >
                    <Plus className="h-4 w-4" />
                    Add another component
                  </Button>
                )}
              </div>

              <div className="border-t border-border p-4">
                <Button
                  className="w-full gap-2 bg-foreground text-background hover:bg-foreground/90"
                  onClick={handleAiOptimize}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Ask AI to optimize plan
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Optimization — {selectedProduct?.name || "Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {aiLoading ? (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analyzing your supply chain...</p>
              </div>
            ) : aiResult ? (
              <div className="prose prose-sm max-w-none dark:prose-invert text-sm">
                {aiResult.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) return <h3 key={i} className="mt-3 text-base font-semibold">{line.slice(2)}</h3>
                  if (line.startsWith("## ")) return <h4 key={i} className="mt-2 text-sm font-semibold">{line.slice(3)}</h4>
                  if (line.startsWith("### ")) return <h4 key={i} className="mt-2 text-sm font-medium">{line.slice(4)}</h4>
                  if (line.startsWith("- ") || line.startsWith("* ")) return <p key={i} className="ml-3 text-sm text-foreground">{line}</p>
                  if (line.startsWith("**")) return <p key={i} className="text-sm font-semibold text-foreground">{line.replace(/\*\*/g, "")}</p>
                  if (line.trim() === "") return <div key={i} className="h-2" />
                  return <p key={i} className="text-sm text-foreground">{line}</p>
                })}
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export type { Product, SupplyChainItem }
