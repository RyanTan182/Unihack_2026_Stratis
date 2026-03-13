# Product Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual ProductSupplyChain component with an AI-powered decomposition pipeline that generates a full supply chain tree from a product name and supplier list, then renders geographic concentration markers on the map.

**Architecture:** Single SSE endpoint (`POST /api/decompose`) orchestrates a 4-phase pipeline (skeleton → Perplexity deep research → reconciliation → adversarial). Frontend hook consumes the stream and manages tree state. New `ProductDecomposition` component replaces `ProductSupplyChain`. Map renders sized circles for geographic concentration data.

**Tech Stack:** Next.js 16 API routes, OpenRouter (kimi-k2.5), Perplexity (sonar-deep-research), react-simple-maps, TypeScript, shadcn/ui

---

## Chunk 1: Backend — Types, Prompts, Search, Pipeline, API Route

### Task 1: Create TypeScript type definitions

**Files:**
- Create: `lib/decompose/types.ts`

- [ ] **Step 1: Write the type definitions file**

```typescript
// lib/decompose/types.ts

export interface SupplyChainNode {
  id: string;
  name: string;
  tier: number;
  type: "product" | "subsystem" | "component" | "material" | "geography";
  status: "inferred" | "searching" | "verified" | "corrected";
  confidence: number;
  geographic_concentration: Record<string, number>;
  risk_score: number;
  risk_factors: string[];
  source: "inferred" | "industry" | "search" | "adversarial";
  search_evidence: string | null;
  correction: string | null;
  children: string[];
}

export interface TreeMetadata {
  total_nodes: number;
  verified_count: number;
  corrected_count: number;
  avg_confidence: number;
}

export interface DecompositionTree {
  product: string;
  phase: "skeleton" | "refining" | "verified";
  nodes: Record<string, SupplyChainNode>;
  root_id: string;
  metadata: TreeMetadata;
}

export type SSEEvent =
  | { type: "skeleton"; tree: DecompositionTree }
  | { type: "refining" }
  | { type: "verified"; tree: DecompositionTree }
  | { type: "done"; duration_ms: number }
  | { type: "error"; message: string };

export interface DecomposeRequest {
  product: string;
  suppliers: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/decompose/types.ts
git commit -m "feat: add decomposition type definitions"
```

---

### Task 2: Create AI prompt templates

**Files:**
- Create: `lib/decompose/prompts.ts`

Port prompts from `decomposition-demo/backend/prompts.py`, extending skeleton prompt to accept suppliers.

- [ ] **Step 1: Write the prompts file**

```typescript
// lib/decompose/prompts.ts

import type { DecompositionTree } from "./types";

const SKELETON_SYSTEM = `You are a supply chain decomposition expert. You break products down into their full dependency tree — from finished product to raw materials and geographies.

Output ONLY valid JSON matching the schema below. No markdown, no explanation.

Rules:
- Create 4-5 tiers deep: product → subsystems → components → materials → geographies
- Each node needs a unique id (use kebab-case like "node-battery-pack")
- Include speculative branches even if confidence is low — breadth over accuracy
- Set confidence between 0.0-1.0 (lower for uncertain claims)
- Set risk_score 0-100 based on supply concentration and geopolitical factors
- geographic_concentration should sum to ~100 for leaf/geography nodes
- All nodes start with status "inferred" and source "inferred"
- Aim for 20-40 nodes total`;

export function skeletonPrompt(product: string, suppliers: string[]): string {
  const schema = JSON.stringify(
    {
      product,
      phase: "skeleton",
      nodes: {
        "node-example": {
          id: "node-example",
          name: "Example",
          tier: 0,
          type: "product",
          status: "inferred",
          confidence: 0.7,
          geographic_concentration: {},
          risk_score: 50,
          risk_factors: [],
          source: "inferred",
          search_evidence: null,
          correction: null,
          children: [],
        },
      },
      root_id: "node-example",
    },
    null,
    2
  );

  const supplierContext =
    suppliers.length > 0
      ? `\n\nKnown first-tier suppliers: ${suppliers.join(", ")}. Incorporate these as known entities at tier 1 where appropriate, with higher confidence (0.8+).`
      : "";

  return `Decompose this product into a full supply chain dependency tree:

Product: ${product}${supplierContext}

Return JSON matching this schema:
${schema}

The "nodes" field is a flat map of id → node. Use "children" arrays to define the tree hierarchy. The "root_id" points to the top-level product node.`;
}

export function searchQueryPrompt(
  nodeName: string,
  nodeType: string,
  parentName: string
): string {
  return `You are researching supply chain data. Generate a focused search query to verify this supply chain dependency:

Node: ${nodeName} (type: ${nodeType})
Parent: ${parentName}

Generate ONE specific search query that would verify:
1. Whether this dependency is real and current
2. Geographic concentration of production/sourcing
3. Major producers or suppliers and their market share

Return ONLY the search query string, nothing else.`;
}

export function reconciliationPrompt(
  tree: DecompositionTree,
  evidence: Record<string, string>
): string {
  const evidenceText = Object.entries(evidence)
    .map(([nodeId, text]) => `### Node: ${nodeId}\n${text}`)
    .join("\n\n");

  return `You are a supply chain analyst updating a dependency tree with search evidence.

Here is the original decomposition tree:
${JSON.stringify(tree, null, 2)}

Here are search results for specific nodes:
${evidenceText}

Update the tree JSON:
- If evidence CONFIRMS a node's claims: set status to "verified", source to "industry", update geographic_concentration with sourced figures, adjust confidence upward
- If evidence CONTRADICTS a node: set status to "verified", source to "search", correct the data (geographic_concentration, risk_score, risk_factors), adjust confidence based on evidence quality
- If evidence reveals MISSING dependencies: add new nodes with status "inferred"
- Nodes without search evidence: leave unchanged
- Set phase to "refining"

Return the complete updated tree as JSON. No markdown, no explanation.`;
}

const ADVERSARIAL_SYSTEM = `You are a supply chain expert reviewing a dependency tree for errors. Your job is to find mistakes, not confirm the analysis. Be skeptical and precise.`;

export function adversarialPrompt(tree: DecompositionTree): string {
  return `Review this supply chain dependency tree for errors:

${JSON.stringify(tree, null, 2)}

For each issue found:
1. Identify the node id
2. Explain what's wrong
3. Provide the correction

Then return the COMPLETE corrected tree as JSON with:
- Corrected nodes: status set to "corrected", source set to "adversarial", correction field explaining what changed
- Uncorrected nodes: left as-is
- phase set to "verified"

Check for:
- Implausible geographic concentration figures (do they reflect reality?)
- Confused suppliers vs actual manufacturers
- Missing critical dependencies for this product
- Risk scores that don't match the underlying concentration data
- Outdated or wrong country attributions

If the tree is largely correct, make minimal changes. Return valid JSON only, no markdown.`;
}

export { SKELETON_SYSTEM, ADVERSARIAL_SYSTEM };
```

- [ ] **Step 2: Commit**

```bash
git add lib/decompose/prompts.ts
git commit -m "feat: add decomposition AI prompt templates"
```

---

### Task 3: Create Perplexity search client

**Files:**
- Create: `lib/decompose/search.ts`

- [ ] **Step 1: Write the Perplexity search client**

```typescript
// lib/decompose/search.ts

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

export async function searchNode(
  query: string,
  signal?: AbortSignal
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return "No Perplexity API key configured. Using LLM inference only.";
  }

  // Timeout after 120s if no abort signal provided (deep-research can be slow)
  const timeoutSignal = AbortSignal.timeout(120_000);
  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;

  const resp = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar-deep-research",
      messages: [
        {
          role: "system",
          content:
            "You are a supply chain research assistant. Provide factual, data-driven answers with specific figures, percentages, and country names. Be concise.",
        },
        { role: "user", content: query },
      ],
    }),
    signal: combinedSignal,
  });

  if (!resp.ok) {
    throw new Error(`Perplexity API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/decompose/search.ts
git commit -m "feat: add Perplexity deep research client"
```

---

### Task 4: Create pipeline orchestration

**Files:**
- Create: `lib/decompose/pipeline.ts`

Port from `decomposition-demo/backend/pipeline.py`. Uses OpenRouter for LLM calls, Perplexity for search.

- [ ] **Step 1: Write the pipeline module**

```typescript
// lib/decompose/pipeline.ts

import type { DecompositionTree, SupplyChainNode } from "./types";
import {
  SKELETON_SYSTEM,
  ADVERSARIAL_SYSTEM,
  skeletonPrompt,
  searchQueryPrompt,
  reconciliationPrompt,
  adversarialPrompt,
} from "./prompts";
import { searchNode } from "./search";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

function getModel(): string {
  return process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";
}

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

async function llmCall(
  system: string,
  user: string,
  temperature: number = 0.7,
  signal?: AbortSignal
): Promise<string> {
  const resp = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
    }),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`OpenRouter API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content || "{}";
}

function parseJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("\n").slice(1).join("\n");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

function updateMetadata(tree: DecompositionTree): void {
  const nodes = Object.values(tree.nodes);
  tree.metadata = {
    total_nodes: nodes.length,
    verified_count: nodes.filter(
      (n) => n.status === "verified" || n.status === "corrected"
    ).length,
    corrected_count: nodes.filter((n) => n.status === "corrected").length,
    avg_confidence:
      nodes.length > 0
        ? Math.round(
            (nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length) *
              100
          ) / 100
        : 0,
  };
}

function selectCriticalNodes(
  tree: DecompositionTree,
  maxNodes: number = 8
): SupplyChainNode[] {
  const candidates: [number, SupplyChainNode][] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.tier < 2) continue;
    const score =
      node.tier * 10 + (1 - node.confidence) * 30 + node.risk_score * 0.5;
    candidates.push([score, node]);
  }
  candidates.sort((a, b) => b[0] - a[0]);
  return candidates.slice(0, maxNodes).map(([, node]) => node);
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function* runPipeline(
  product: string,
  suppliers: string[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const startTime = Date.now();

  // --- Phase 1: Skeleton ---
  let tree: DecompositionTree;
  try {
    const raw = await llmCall(
      SKELETON_SYSTEM,
      skeletonPrompt(product, suppliers),
      0.7,
      signal
    );
    const treeData = parseJson(raw) as unknown as DecompositionTree;
    tree = treeData;
    tree.phase = "skeleton";
    updateMetadata(tree);
    yield sseEvent("skeleton", { tree });
  } catch (e) {
    yield sseEvent("error", {
      message: `Skeleton generation failed: ${e instanceof Error ? e.message : e}`,
    });
    return;
  }

  // --- Phase 2: Search Validation ---
  yield sseEvent("refining", {});

  const criticalNodes = selectCriticalNodes(tree);
  const evidence: Record<string, string> = {};

  for (const node of criticalNodes) {
    // Find parent name for context
    let parentName = product;
    for (const candidate of Object.values(tree.nodes)) {
      if (candidate.children.includes(node.id)) {
        parentName = candidate.name;
        break;
      }
    }

    // Generate search query
    let query: string;
    try {
      query = await llmCall(
        "Generate a search query. Return ONLY the query string.",
        searchQueryPrompt(node.name, node.type, parentName),
        0.3,
        signal
      );
      query = query.trim().replace(/^["']|["']$/g, "");
    } catch {
      query = `${node.name} global production supply chain ${product}`;
    }

    // Search via Perplexity
    try {
      const result = await searchNode(query, signal);
      evidence[node.id] = result;
      tree.nodes[node.id].search_evidence = result;
    } catch {
      // Skip failed searches, continue pipeline
    }
  }

  // --- Phase 3: Reconciliation ---
  if (Object.keys(evidence).length > 0) {
    try {
      const raw = await llmCall(
        "You are a supply chain analyst. Return valid JSON only.",
        reconciliationPrompt(tree, evidence),
        0.3,
        signal
      );
      const treeData = parseJson(raw) as unknown as DecompositionTree;
      tree = treeData;
      tree.phase = "refining";
      updateMetadata(tree);
    } catch {
      tree.phase = "refining";
      updateMetadata(tree);
    }
  }

  // --- Phase 4: Adversarial Verification ---
  try {
    const raw = await llmCall(
      ADVERSARIAL_SYSTEM,
      adversarialPrompt(tree),
      0.4,
      signal
    );
    const treeData = parseJson(raw) as unknown as DecompositionTree;
    tree = treeData;
    tree.phase = "verified";
    updateMetadata(tree);
  } catch {
    tree.phase = "verified";
    updateMetadata(tree);
  }

  yield sseEvent("verified", { tree });

  // --- Done ---
  const durationMs = Date.now() - startTime;
  yield sseEvent("done", { duration_ms: durationMs });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/decompose/pipeline.ts
git commit -m "feat: add 4-phase decomposition pipeline"
```

---

### Task 5: Create the SSE API route

**Files:**
- Create: `app/api/decompose/route.ts`

- [ ] **Step 1: Write the API route**

```typescript
// app/api/decompose/route.ts

import { runPipeline } from "@/lib/decompose/pipeline";
import type { DecomposeRequest } from "@/lib/decompose/types";

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST(request: Request) {
  let body: DecomposeRequest;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { product, suppliers = [] } = body;
  if (!product || typeof product !== "string") {
    return new Response("Missing product name", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of runPipeline(product, suppliers, request.signal)) {
          controller.enqueue(encoder.encode(event));
        }
      } catch (e) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({
          message: e instanceof Error ? e.message : "Pipeline failed",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/decompose/route.ts
git commit -m "feat: add SSE decompose API endpoint"
```

---

## Chunk 2: Frontend — Hook, Component, Page Integration, Map Markers

### Task 6: Create the useDecompose hook

**Files:**
- Create: `hooks/use-decompose.ts`

Port from `decomposition-demo/frontend/lib/use-decompose.ts`. Simplified to 3-state UI (skeleton → refining → verified). Accepts suppliers param.

- [ ] **Step 1: Write the hook**

```typescript
// hooks/use-decompose.ts

"use client";

import { useCallback, useRef, useState } from "react";
import type { DecompositionTree, SSEEvent } from "@/lib/decompose/types";

interface DecomposeState {
  tree: DecompositionTree | null;
  isLoading: boolean;
  error: string | null;
  durationMs: number | null;
  selectedNodeId: string | null;
}

export function useDecompose() {
  const [state, setState] = useState<DecomposeState>({
    tree: null,
    isLoading: false,
    error: null,
    durationMs: null,
    selectedNodeId: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const decompose = useCallback(
    async (product: string, suppliers: string[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        tree: null,
        isLoading: true,
        error: null,
        durationMs: null,
        selectedNodeId: null,
      });

      try {
        const resp = await fetch("/api/decompose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, suppliers }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                handleEvent(
                  { type: eventType, ...data } as SSEEvent,
                  setState
                );
              } catch {
                // skip malformed JSON
              }
              eventType = "";
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: (e as Error).message,
          }));
        }
      }
    },
    []
  );

  const selectNode = useCallback((nodeId: string | null) => {
    setState((prev) => ({ ...prev, selectedNodeId: nodeId }));
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...state, decompose, selectNode, abort };
}

function handleEvent(
  event: SSEEvent,
  setState: React.Dispatch<React.SetStateAction<DecomposeState>>
) {
  switch (event.type) {
    case "skeleton":
      setState((prev) => ({ ...prev, tree: event.tree }));
      break;
    case "refining":
      setState((prev) => {
        if (!prev.tree) return prev;
        return { ...prev, tree: { ...prev.tree, phase: "refining" } };
      });
      break;
    case "verified":
      setState((prev) => ({ ...prev, tree: event.tree }));
      break;
    case "done":
      setState((prev) => ({
        ...prev,
        isLoading: false,
        durationMs: event.duration_ms,
      }));
      break;
    case "error":
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: event.message,
      }));
      break;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/use-decompose.ts
git commit -m "feat: add useDecompose SSE hook"
```

---

### Task 7: Create the ProductDecomposition component

**Files:**
- Create: `components/product-decomposition.tsx`

This is the largest file. It has three views: input form, loading/skeleton tree, and complete tree with node detail. Uses shadcn/ui components already in the project.

- [ ] **Step 1: Write the component**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add components/product-decomposition.tsx
git commit -m "feat: add ProductDecomposition component"
```

---

### Task 8: Update page.tsx — swap ProductSupplyChain for ProductDecomposition

**Files:**
- Modify: `app/page.tsx:1-765`

Replace `ProductSupplyChain` import and usage, remove old product state, add decomposition tree + selected node state, remove `PathDetailsPanel`.

- [ ] **Step 1: Update imports (lines 1-11)**

Replace the current imports block:

```typescript
// app/page.tsx — replace lines 1-11
"use client"

import { useState, useCallback } from "react"
import { NavSidebar } from "@/components/nav-sidebar"
import { RiskSidebar } from "@/components/risk-sidebar"
import { SupplyChainMap } from "@/components/supply-chain-map"
import { RouteBuilder, type CustomRoute } from "@/components/route-builder"
import { ProductDecomposition } from "@/components/product-decomposition"
import { Button } from "@/components/ui/button"
import { Route, Package } from "lucide-react"
import type { DecompositionTree } from "@/lib/decompose/types"
```

- [ ] **Step 2: Update state and handlers (lines 664-683)**

Replace the state declarations and handler functions inside `SupplyChainCrisisDetector`:

```typescript
// Replace lines 665-683 (state + handlers)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [isRouteBuilderOpen, setIsRouteBuilderOpen] = useState(false)
  const [isProductBuilderOpen, setIsProductBuilderOpen] = useState(false)
  const [customRoute, setCustomRoute] = useState<CustomRoute | null>(null)
  const [decompositionTree, setDecompositionTree] = useState<DecompositionTree | null>(null)
  const [selectedDecompNodeId, setSelectedDecompNodeId] = useState<string | null>(null)

  const handleReset = () => {
    setSelectedCountry(null)
    setCustomRoute(null)
  }

  const handleTreeLoaded = useCallback((tree: DecompositionTree) => {
    setDecompositionTree(tree)
  }, [])

  const handleNodeSelected = useCallback((nodeId: string | null, tree: DecompositionTree) => {
    setSelectedDecompNodeId(nodeId)
    setDecompositionTree(tree)
  }, [])
```

- [ ] **Step 3: Update the SupplyChainMap props (lines 700-708)**

Remove `products`, `selectedRouteId`, and `onRouteClick`. Add decomposition props:

```typescript
        <SupplyChainMap
          countryRisks={countryRisks}
          onCountrySelect={setSelectedCountry}
          selectedCountry={selectedCountry}
          customRoute={customRoute}
          decompositionTree={decompositionTree}
          selectedDecompNodeId={selectedDecompNodeId}
        />
```

- [ ] **Step 4: Update the Products button (lines 725-736)**

Replace to remove product count display:

```typescript
          <Button
            variant={isProductBuilderOpen ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => {
              setIsProductBuilderOpen(!isProductBuilderOpen)
              setIsRouteBuilderOpen(false)
            }}
          >
            <Package className="h-4 w-4" />
            Products
          </Button>
```

- [ ] **Step 5: Replace ProductSupplyChain and PathDetailsPanel (lines 748-761)**

Replace with ProductDecomposition:

```typescript
        {/* Product Decomposition Panel */}
        <ProductDecomposition
          isOpen={isProductBuilderOpen}
          onClose={() => setIsProductBuilderOpen(false)}
          onTreeLoaded={handleTreeLoaded}
          onNodeSelected={handleNodeSelected}
        />
```

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat: swap ProductSupplyChain for ProductDecomposition in page"
```

---

### Task 9: Update supply-chain-map.tsx — add concentration markers, remove product routes

**Files:**
- Modify: `components/supply-chain-map.tsx`

Add decomposition tree props to the interface. Add concentration circle rendering logic. Remove old `Product`/`SupplyChainItem` types, `extractProductRoutes`, `buildAdjacencyMap`, `findShortestPath`, and product route line rendering.

- [ ] **Step 1: Add new imports and update interface**

Add `DecompositionTree` import at the top of the file (after existing imports):

```typescript
import type { DecompositionTree } from "@/lib/decompose/types"
```

Update `SupplyChainMapProps` (lines 104-112) to replace product-related props:

```typescript
interface SupplyChainMapProps {
  countryRisks: CountryRisk[]
  onCountrySelect: (countryId: string | null) => void
  selectedCountry: string | null
  customRoute?: CustomRoute | null
  decompositionTree?: DecompositionTree | null
  selectedDecompNodeId?: string | null
}
```

- [ ] **Step 2: Remove ALL old product-route infrastructure**

Remove every type, function, useMemo, and JSX block related to the old product route system. Complete list:

**Types to remove:**
- `ItemType` type alias (line 56)
- `SupplyChainItem` interface (lines 58-67)
- `Product` interface (lines 69-78)
- `ProductRouteSegment` export interface (lines 80-85)
- `ProductSupplyRoute` export interface (lines 87-101)

**Functions to remove:**
- `buildAdjacencyMap` (lines 222-239)
- `findShortestPath` (lines 241-295)
- `extractProductRoutes` (lines 297-370)
- `buildRouteSegmentsFromPath` (referenced by extractProductRoutes)
- `getRouteColorForChokepoint` (used by product route chokepoint coloring)

**useMemo hooks to remove (inside the component):**
- `productRoutes` useMemo that calls `extractProductRoutes`
- `activeProductChokepoints` useMemo (depends on productRoutes/selectedRouteId)
- `productCountryMarkers` useMemo (depends on products/productRoutes)

**JSX blocks to remove:**
- Product route line rendering (Lines/Markers for product supply routes)
- Product country markers with danger indicators
- Chokepoint `activeColor` logic that references `productRoutes`/`selectedRouteId` — revert chokepoints to use only default styling

- [ ] **Step 3: Add concentration marker helper functions**

Add these functions after the existing `extractNodeConnections` function (after line 220):

```typescript
// Get leaf nodes from decomposition tree
function getLeafNodes(tree: DecompositionTree): string[] {
  return Object.values(tree.nodes)
    .filter((node) => node.children.length === 0)
    .map((node) => node.id);
}

// Build default markers: one dot per leaf node at highest-concentration country
function getDefaultMarkers(
  tree: DecompositionTree
): { country: string; concentration: number; nodeId: string }[] {
  const leafIds = getLeafNodes(tree);
  const markers: { country: string; concentration: number; nodeId: string }[] = [];

  for (const leafId of leafIds) {
    const node = tree.nodes[leafId];
    const entries = Object.entries(node.geographic_concentration);
    if (entries.length === 0) continue;
    const [topCountry, topPct] = entries.sort(([, a], [, b]) => b - a)[0];
    markers.push({ country: topCountry, concentration: topPct, nodeId: leafId });
  }

  return markers;
}

// Concentration dot colors (for selected node detail view)
const CONCENTRATION_DOT_COLORS = [
  "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4",
];
```

- [ ] **Step 4: Update the component function signature**

Update the destructured props in the component function to use the new interface (remove `products`, `selectedRouteId`, `onRouteClick`; add `decompositionTree`, `selectedDecompNodeId`):

```typescript
export function SupplyChainMap({
  countryRisks,
  onCountrySelect,
  selectedCountry,
  customRoute,
  decompositionTree,
  selectedDecompNodeId,
}: SupplyChainMapProps) {
```

- [ ] **Step 5: Remove the old productRoutes useMemo and add decomposition markers**

Find the `useMemo` that calls `extractProductRoutes` and replace it with:

```typescript
  // Compute concentration markers from decomposition tree
  const defaultMarkers = useMemo(() => {
    if (!decompositionTree) return [];
    return getDefaultMarkers(decompositionTree);
  }, [decompositionTree]);

  const selectedNodeMarkers = useMemo(() => {
    if (!decompositionTree || !selectedDecompNodeId) return [];
    const node = decompositionTree.nodes[selectedDecompNodeId];
    if (!node) return [];
    return Object.entries(node.geographic_concentration)
      .sort(([, a], [, b]) => b - a)
      .map(([country, pct], i) => ({
        country,
        concentration: pct,
        color: CONCENTRATION_DOT_COLORS[i % CONCENTRATION_DOT_COLORS.length],
      }));
  }, [decompositionTree, selectedDecompNodeId]);
```

- [ ] **Step 6: Remove old product route rendering JSX and add concentration markers**

In the JSX inside `<ZoomableGroup>`, remove the block that renders product route lines and product country markers. Replace with:

```tsx
        {/* Decomposition Concentration Markers */}
        {!selectedDecompNodeId &&
          defaultMarkers.map((marker) => {
            const coords = nodeCoordinates[marker.country];
            if (!coords) return null;
            const radius = Math.max(3, (marker.concentration / 100) * 10);
            return (
              <Marker key={`default-${marker.nodeId}`} coordinates={coords}>
                <circle
                  r={radius}
                  fill="#7c3aed"
                  fillOpacity={0.8}
                  stroke="#7c3aed"
                  strokeWidth={0.5}
                  style={{ filter: "drop-shadow(0 0 4px rgba(124, 58, 237, 0.5))" }}
                />
              </Marker>
            );
          })}

        {selectedDecompNodeId &&
          selectedNodeMarkers.map((marker) => {
            const coords = nodeCoordinates[marker.country];
            if (!coords) return null;
            const radius = Math.max(3, (marker.concentration / 100) * 12);
            return (
              <Marker key={`selected-${marker.country}`} coordinates={coords}>
                <circle
                  r={radius}
                  fill={marker.color}
                  fillOpacity={0.9}
                  stroke={marker.color}
                  strokeWidth={0.5}
                  style={{ filter: `drop-shadow(0 0 4px ${marker.color}88)` }}
                />
                <text
                  textAnchor="middle"
                  y={radius + 10}
                  style={{ fontSize: "8px", fill: marker.color, fontWeight: 500 }}
                >
                  {marker.country} {marker.concentration}%
                </text>
              </Marker>
            );
          })}
```

- [ ] **Step 7: Remove the `ProductSupplyRoute` export if still present**

Check the file exports and remove the `ProductSupplyRoute` type export from the top.

- [ ] **Step 8: Commit**

```bash
git add components/supply-chain-map.tsx
git commit -m "feat: add concentration markers, remove product route rendering"
```

---

### Task 10: Remove old files

**Files:**
- Delete: `components/product-supply-chain.tsx`
- Delete: `components/path-details-panel.tsx`
- Delete: `app/api/ai/alternatives/route.ts`
- Delete: `app/api/ai/optimize/route.ts`

- [ ] **Step 1: Delete the old files**

```bash
git rm components/product-supply-chain.tsx
git rm components/path-details-panel.tsx
git rm app/api/ai/alternatives/route.ts
git rm app/api/ai/optimize/route.ts
```

- [ ] **Step 2: Commit**

```bash
git commit -m "chore: remove replaced product-supply-chain, path-details-panel, and old AI routes"
```

---

### Task 11: Verify the build compiles

- [ ] **Step 1: Run the build**

```bash
pnpm build
```

Expected: Build succeeds with no TypeScript errors related to removed imports or missing types. (Note: `typescript.ignoreBuildErrors: true` is set in `next.config.mjs`, so type errors won't block the build — but check terminal output for warnings.)

- [ ] **Step 2: Run dev server and test manually**

```bash
pnpm dev
```

Expected:
1. App loads at http://localhost:3000
2. Click "Products" button → input form appears
3. Enter a product name and suppliers → click "Decompose Supply Chain"
4. Skeleton tree appears immediately, then "Refining with deep research..." status
5. Final tree appears with "Verified" badge
6. Click a node → detail panel shows on the right
7. Map shows purple dots when tree loads, colored dots when a node is selected

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve build/runtime issues from integration"
```
