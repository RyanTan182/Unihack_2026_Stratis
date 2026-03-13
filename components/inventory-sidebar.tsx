// components/inventory-sidebar.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  ChevronDown,
  Loader2,
  Zap,
  CheckCircle,
  AlertTriangle,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useDecompose } from "@/hooks/use-decompose";
import type {
  DecompositionTree,
  SupplyChainNode,
  StoredProduct,
} from "@/lib/decompose/types";

// --- Props ---

interface InventorySidebarProps {
  products: StoredProduct[];
  onProductAdd: (product: StoredProduct) => void;
  onTreeChange: (tree: DecompositionTree | null) => void;
  onNodeSelect: (nodeId: string | null) => void;
}

type View = "list" | "form" | "tree" | "detail";

// --- Supplier Tag Input (reused from product-decomposition) ---

function SupplierTagInput({
  suppliers,
  onChange,
}: {
  suppliers: string[];
  onChange: (suppliers: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const addSupplier = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !suppliers.includes(trimmed)) {
      onChange([...suppliers, trimmed]);
      setInputValue("");
    }
  };

  const removeSupplier = (supplier: string) => {
    onChange(suppliers.filter((s) => s !== supplier));
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {suppliers.map((supplier) => (
          <Badge
            key={supplier}
            variant="secondary"
            className="gap-1 bg-primary/10 text-primary"
          >
            {supplier}
            <button
              onClick={() => removeSupplier(supplier)}
              className="ml-0.5 opacity-60 hover:opacity-100"
            >
              ×
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            addSupplier();
          }
        }}
        placeholder="Add supplier…"
        className="h-9"
      />
    </div>
  );
}

// --- Tree Node Row (reused from product-decomposition) ---

function TreeNodeRow({
  node,
  tree,
  depth,
  selectedNodeId,
  onSelect,
}: {
  node: SupplyChainNode;
  tree: DecompositionTree;
  depth: number;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedNodeId === node.id;

  return (
    <div>
      <button
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/50",
          isSelected && "border-l-2 border-primary bg-primary/5"
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {hasChildren ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="shrink-0 text-muted-foreground"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                !isExpanded && "-rotate-90"
              )}
            />
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <span
          className={cn(
            "truncate",
            isSelected ? "font-semibold text-primary" : "text-foreground"
          )}
        >
          {node.name}
        </span>
        {node.risk_score >= 70 && (
          <span className="ml-auto shrink-0 text-xs text-red-500">
            {node.risk_score}
          </span>
        )}
      </button>

      {isExpanded &&
        hasChildren &&
        node.children.map((childId) => {
          const child = tree.nodes[childId];
          if (!child) return null;
          return (
            <TreeNodeRow
              key={childId}
              node={child}
              tree={tree}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
            />
          );
        })}
    </div>
  );
}

// --- Node Detail (reused from product-decomposition) ---

const CONCENTRATION_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
];

function NodeDetail({ node }: { node: SupplyChainNode }) {
  const concentrationEntries = Object.entries(
    node.geographic_concentration
  ).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-primary">{node.name}</h3>
        <p className="text-xs text-muted-foreground">
          {node.type} · Tier {node.tier} ·{" "}
          <span
            className={cn(
              node.status === "verified" && "text-blue-500",
              node.status === "corrected" && "text-emerald-500",
              node.status === "inferred" && "text-orange-500"
            )}
          >
            {node.status}
          </span>
        </p>
      </div>

      {/* Geographic Concentration */}
      {concentrationEntries.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">
            Geographic Concentration
          </p>
          <div className="mb-1.5 flex h-5 overflow-hidden rounded">
            {concentrationEntries.map(([country, pct], i) => (
              <div
                key={country}
                style={{
                  width: `${pct}%`,
                  backgroundColor:
                    CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length],
                }}
                title={`${country} ${pct}%`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {concentrationEntries.map(([country, pct], i) => (
              <span key={country}>
                <span
                  style={{
                    color:
                      CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length],
                  }}
                >
                  ●
                </span>{" "}
                <span className="text-muted-foreground">
                  {country} {pct}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk + Confidence */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-muted/50 p-3">
          <p className="text-[10px] uppercase text-muted-foreground">Risk</p>
          <p
            className={cn(
              "text-xl font-bold",
              node.risk_score >= 70
                ? "text-red-500"
                : node.risk_score >= 40
                  ? "text-amber-500"
                  : "text-green-500"
            )}
          >
            {node.risk_score}
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-muted/50 p-3">
          <p className="text-[10px] uppercase text-muted-foreground">
            Confidence
          </p>
          <p className="text-xl font-bold text-blue-500">{node.confidence}</p>
        </div>
      </div>

      {/* Risk Factors */}
      {node.risk_factors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Risk Factors
          </p>
          <div className="flex flex-wrap gap-1">
            {node.risk_factors.map((factor) => (
              <Badge
                key={factor}
                variant="destructive"
                className="text-[10px]"
              >
                {factor}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search Evidence */}
      {node.search_evidence && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Search Evidence
          </p>
          <p className="whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-muted-foreground">
            {node.search_evidence}
          </p>
        </div>
      )}

      {/* Correction */}
      {node.correction && (
        <div>
          <p className="mb-1 text-xs font-medium uppercase text-emerald-500">
            Adversarial Correction
          </p>
          <p className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2 text-xs text-emerald-400">
            {node.correction}
          </p>
        </div>
      )}
    </div>
  );
}

// --- Product Card ---

function ProductCard({
  product,
  onClick,
}: {
  product: StoredProduct;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col gap-1 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">{product.name}</span>
        {product.tree.phase === "verified" && (
          <Badge
            variant="secondary"
            className="gap-1 bg-emerald-500/10 text-emerald-500 text-[10px]"
          >
            <CheckCircle className="h-2.5 w-2.5" />
            Verified
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        {product.tree.metadata.total_nodes} nodes · confidence{" "}
        {product.tree.metadata.avg_confidence} ·{" "}
        {(product.durationMs / 1000).toFixed(1)}s
      </div>
    </button>
  );
}

// --- Main Component ---

export function InventorySidebar({
  products,
  onProductAdd,
  onTreeChange,
  onNodeSelect,
}: InventorySidebarProps) {
  const [view, setView] = useState<View>("list");
  const [activeProductId, setActiveProductId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Form state
  const [productName, setProductName] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);

  // useDecompose is ONLY for new decompositions (View 2 / form).
  // Note: the hook also returns selectNode/selectedNodeId which we ignore —
  // node selection is managed as local state in this component instead.
  const { tree: hookTree, isLoading, error, durationMs, decompose, abort } =
    useDecompose();

  // Capture form values at decompose-time so the completion effect has stable refs
  const pendingFormRef = useRef<{ name: string; suppliers: string[] } | null>(null);

  // Abort any in-flight decomposition on unmount (e.g. sidebar view switch)
  useEffect(() => {
    return () => abort();
  }, [abort]);

  // When hook completes a decomposition, save it and navigate to tree view
  useEffect(() => {
    if (hookTree && !isLoading && !error && hookTree.phase === "verified" && durationMs !== null && pendingFormRef.current) {
      const { name, suppliers: savedSuppliers } = pendingFormRef.current;
      const newProduct: StoredProduct = {
        id: crypto.randomUUID(),
        name,
        suppliers: savedSuppliers,
        tree: hookTree,
        durationMs,
        createdAt: Date.now(),
      };
      pendingFormRef.current = null;
      onProductAdd(newProduct);
      setActiveProductId(newProduct.id);
      onTreeChange(hookTree);
      onNodeSelect(null);
      setView("tree");
      // Reset form
      setProductName("");
      setSuppliers([]);
    }
  }, [hookTree, isLoading, error, durationMs, onProductAdd, onTreeChange, onNodeSelect]);

  // Get the active product from the products array
  const activeProduct = activeProductId
    ? products.find((p) => p.id === activeProductId) ?? null
    : null;

  // Navigate to product list
  const goToList = () => {
    abort();
    setView("list");
    setActiveProductId(null);
    setSelectedNodeId(null);
    onTreeChange(null);
    onNodeSelect(null);
  };

  // Navigate to tree view for a product
  const goToTree = (product: StoredProduct) => {
    setActiveProductId(product.id);
    setSelectedNodeId(null);
    onTreeChange(product.tree);
    onNodeSelect(null);
    setView("tree");
  };

  // Navigate to node detail
  const goToDetail = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    onNodeSelect(nodeId);
    setView("detail");
  };

  // Navigate back from detail to tree
  const goBackToTree = () => {
    setSelectedNodeId(null);
    onNodeSelect(null);
    setView("tree");
  };

  const handleDecompose = () => {
    if (productName.trim()) {
      pendingFormRef.current = { name: productName.trim(), suppliers: [...suppliers] };
      decompose(productName.trim(), suppliers);
    }
  };

  // --- Header ---
  const renderHeader = () => {
    switch (view) {
      case "list":
        return (
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">Inventory</h2>
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
        );
      case "form":
        return (
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToList}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">New Product</h2>
          </div>
        );
      case "tree":
        return (
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goToList}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="flex-1 truncate text-lg font-semibold text-foreground">
              {activeProduct?.name}
            </h2>
            {activeProduct?.tree.phase === "verified" && (
              <Badge
                variant="secondary"
                className="gap-1 bg-emerald-500/10 text-emerald-500"
              >
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
        );
      case "detail": {
        const node = activeProduct
          ? activeProduct.tree.nodes[selectedNodeId!]
          : null;
        return (
          <div className="flex items-center gap-2 border-b border-border p-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={goBackToTree}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="flex-1 truncate text-lg font-semibold text-foreground">
              {node?.name}
            </h2>
          </div>
        );
      }
    }
  };

  // --- Content ---
  const renderContent = () => {
    switch (view) {
      case "list":
        return (
          <ScrollArea className="flex-1">
            <div className="space-y-2 p-4">
              {products.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Package className="h-10 w-10 text-muted-foreground/50" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      No products yet
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Add a product to decompose its supply chain
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setView("form")}
                  >
                    <Plus className="h-4 w-4" />
                    Add Product
                  </Button>
                </div>
              ) : (
                products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => goToTree(product)}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        );

      case "form":
        if (isLoading) {
          return (
            <div className="flex flex-col items-center gap-3 p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-primary">
                {hookTree?.phase === "skeleton"
                  ? "Building skeleton…"
                  : "Refining with deep research…"}
              </span>
            </div>
          );
        }

        if (error) {
          return (
            <div className="p-4">
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={handleDecompose}
              >
                Retry
              </Button>
            </div>
          );
        }

        return (
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                Product Name
              </label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleDecompose();
                }}
                placeholder="e.g. Tesla Model 3"
                className="h-10"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase text-muted-foreground">
                First-Tier Suppliers
              </label>
              <SupplierTagInput
                suppliers={suppliers}
                onChange={setSuppliers}
              />
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleDecompose}
              disabled={!productName.trim()}
            >
              <Zap className="h-4 w-4" />
              Decompose Supply Chain
            </Button>
          </div>
        );

      case "tree": {
        if (!activeProduct) return null;
        const rootNode = activeProduct.tree.nodes[activeProduct.tree.root_id];
        if (!rootNode) return null;

        return (
          <div className="flex flex-1 flex-col">
            {/* Metadata bar */}
            <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              {activeProduct.tree.metadata.total_nodes} nodes · avg confidence{" "}
              {activeProduct.tree.metadata.avg_confidence} ·{" "}
              {(activeProduct.durationMs / 1000).toFixed(1)}s
            </div>

            {/* Tree */}
            <ScrollArea className="flex-1">
              <div className="py-2">
                <TreeNodeRow
                  node={rootNode}
                  tree={activeProduct.tree}
                  depth={0}
                  selectedNodeId={selectedNodeId}
                  onSelect={goToDetail}
                />
              </div>
            </ScrollArea>
          </div>
        );
      }

      case "detail": {
        if (!activeProduct || !selectedNodeId) return null;
        const node = activeProduct.tree.nodes[selectedNodeId];
        if (!node) return null;

        return (
          <ScrollArea className="flex-1">
            <div className="p-4">
              <NodeDetail node={node} />
            </div>
          </ScrollArea>
        );
      }
    }
  };

  return (
    <div className="flex h-full w-80 flex-col border-r border-border bg-card">
      {renderHeader()}
      {renderContent()}
      <p className="border-t border-border p-3 text-center text-[10px] text-muted-foreground">
        Supply Chain Crisis Detector v1.0
      </p>
    </div>
  );
}
