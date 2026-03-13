// components/product-decomposition.tsx

"use client";

import { useState, useEffect } from "react";
import {
  X,
  ChevronDown,
  Loader2,
  Zap,
  Search,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDecompose } from "@/hooks/use-decompose";
import type { DecompositionTree, SupplyChainNode } from "@/lib/decompose/types";

interface ProductDecompositionProps {
  isOpen: boolean;
  onClose: () => void;
  onTreeLoaded: (tree: DecompositionTree) => void;
  onNodeSelected: (nodeId: string | null, tree: DecompositionTree) => void;
}

// --- Supplier Tag Input ---

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

// --- Tree Node Row ---

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
          <button
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
          </button>
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

// --- Node Detail Panel ---

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
                  backgroundColor: CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length],
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
                    color: CONCENTRATION_COLORS[i % CONCENTRATION_COLORS.length],
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

// --- Main Component ---

export function ProductDecomposition({
  isOpen,
  onClose,
  onTreeLoaded,
  onNodeSelected,
}: ProductDecompositionProps) {
  const [productName, setProductName] = useState("");
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const { tree, isLoading, error, durationMs, selectedNodeId, decompose, selectNode, abort } =
    useDecompose();

  // Notify parent when tree changes
  useEffect(() => {
    if (tree && !isLoading) {
      onTreeLoaded(tree);
    }
  }, [tree, isLoading, onTreeLoaded]);

  // Notify parent when selected node changes
  useEffect(() => {
    if (tree) {
      onNodeSelected(selectedNodeId, tree);
    }
  }, [selectedNodeId, tree, onNodeSelected]);

  const handleDecompose = () => {
    if (productName.trim()) {
      decompose(productName.trim(), suppliers);
    }
  };

  const handleClose = () => {
    abort();
    onClose();
  };

  if (!isOpen) return null;

  const rootNode = tree ? tree.nodes[tree.root_id] : null;
  const selectedNode = selectedNodeId ? tree?.nodes[selectedNodeId] : null;
  const showDetail = selectedNode && tree?.phase === "verified";

  return (
    <div className="absolute right-4 top-4 z-20 w-[420px] animate-in slide-in-from-right-4">
      <Card className="max-h-[calc(100vh-2rem)] overflow-hidden border-border bg-card/98 shadow-xl backdrop-blur-sm">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <h2 className="text-lg font-semibold text-foreground">
              {tree ? tree.product : "Products"}
            </h2>
            <div className="flex items-center gap-2">
              {tree?.phase === "verified" && (
                <Badge
                  variant="secondary"
                  className="gap-1 bg-emerald-500/10 text-emerald-500"
                >
                  <CheckCircle className="h-3 w-3" />
                  Verified
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!tree && !isLoading && !error ? (
            // Input Form
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
          ) : error ? (
            // Error
            <div className="p-4">
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => {
                  decompose(productName.trim(), suppliers);
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            // Tree View (loading or complete)
            <div className="flex max-h-[calc(100vh-8rem)] flex-col">
              {/* Status bar */}
              {isLoading && (
                <div className="flex items-center gap-2 border-b border-border px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-primary">
                    {tree?.phase === "skeleton"
                      ? "Building skeleton…"
                      : "Refining with deep research…"}
                  </span>
                </div>
              )}

              {/* Metadata bar */}
              {tree && !isLoading && (
                <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
                  {tree.metadata.total_nodes} nodes · avg confidence{" "}
                  {tree.metadata.avg_confidence} ·{" "}
                  {durationMs ? `${(durationMs / 1000).toFixed(1)}s` : ""}
                </div>
              )}

              {/* Split: Tree + Detail */}
              <div className="flex min-h-0 flex-1">
                {/* Tree */}
                <div
                  className={cn(
                    "overflow-y-auto py-2",
                    showDetail ? "w-1/2 border-r border-border" : "w-full",
                    isLoading && tree?.phase === "skeleton" && "opacity-70"
                  )}
                >
                  {rootNode && (
                    <TreeNodeRow
                      node={rootNode}
                      tree={tree!}
                      depth={0}
                      selectedNodeId={selectedNodeId}
                      onSelect={selectNode}
                    />
                  )}
                </div>

                {/* Detail */}
                {showDetail && selectedNode && (
                  <div className="w-1/2 overflow-y-auto p-3">
                    <NodeDetail node={selectedNode} />
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
