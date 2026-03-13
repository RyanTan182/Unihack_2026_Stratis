# Decomposition Improvements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the supply chain decomposition feature across speed (parallel search, streaming), accuracy (structured evidence, normalization), and visualization (progressive map animations, richer sidebar detail).

**Architecture:** Backend pipeline switches from serial to batched-parallel search with `sonar` (fast model). New SSE events (`node-added`, `search-started`, `search-complete`) drive progressive frontend animations. Evidence extraction produces structured data for reconciliation. Country name normalization ensures map markers render correctly.

**Tech Stack:** Next.js 16, TypeScript, OpenRouter, Perplexity (sonar), react-simple-maps, shadcn/ui, CSS animations

**Spec:** `docs/superpowers/specs/2026-03-14-decomposition-improvements-design.md`

---

## Chunk 1: Backend — Types, Search, Prompts, Pipeline

### Task 1: Update types with new SSE events and ExtractedEvidence

**Files:**
- Modify: `lib/decompose/types.ts`

- [ ] **Step 1: Add ExtractedEvidence interface and new SSE event types**

```typescript
// Add after StoredProduct interface (end of file)

export interface ExtractedEvidence {
  countries: { name: string; percentage: number }[];
  majorProducers: string[];
  riskFactors: string[];
  confidenceSignal: "strong" | "moderate" | "weak";
  rawText: string;
}
```

Update the `SSEEvent` union type to add the 3 new events:

```typescript
export type SSEEvent =
  | { type: "skeleton"; tree: DecompositionTree }
  | { type: "refining" }
  | { type: "verified"; tree: DecompositionTree }
  | { type: "done"; duration_ms: number }
  | { type: "error"; message: string }
  | { type: "node-added"; node: SupplyChainNode; parentId: string | null }
  | { type: "search-started"; nodeId: string }
  | { type: "search-complete"; nodeId: string; hasEvidence: boolean };
```

- [ ] **Step 2: Commit**

```bash
git add lib/decompose/types.ts
git commit -m "feat: add ExtractedEvidence type and new SSE event types"
```

---

### Task 2: Update search client — configurable model + model-dependent timeout

**Files:**
- Modify: `lib/decompose/search.ts`

- [ ] **Step 1: Add model parameter, update timeout and model usage**

Replace the entire `searchNode` function. Key changes:
- Add `model` parameter defaulting to `"sonar"`
- Timeout: 15s for sonar, 120s for sonar-deep-research
- Use `model` param in the request body instead of hardcoded `"sonar-deep-research"`

```typescript
export async function searchNode(
  query: string,
  signal?: AbortSignal,
  model: string = "sonar"
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return "No Perplexity API key configured. Using LLM inference only.";
  }

  const timeoutMs = model === "sonar-deep-research" ? 120_000 : 15_000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
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
      model,
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
git commit -m "feat: configurable search model with model-dependent timeout"
```

---

### Task 3: Create country aliases map

**Files:**
- Create: `lib/decompose/country-aliases.ts`

- [ ] **Step 1: Write the alias map**

The canonical names are the keys in `nodeCoordinates` in `supply-chain-map.tsx`. Map common LLM output variants to those names.

```typescript
// lib/decompose/country-aliases.ts

export const COUNTRY_ALIASES: Record<string, string> = {
  "South Korea": "South Korea",
  "Republic of Korea": "South Korea",
  "Korea": "South Korea",
  "USA": "United States",
  "US": "United States",
  "U.S.": "United States",
  "U.S.A.": "United States",
  "America": "United States",
  "UK": "United Kingdom",
  "Britain": "United Kingdom",
  "Great Britain": "United Kingdom",
  "England": "United Kingdom",
  "DRC": "Congo",
  "DR Congo": "Congo",
  "Democratic Republic of the Congo": "Congo",
  "Congo, Democratic Republic of": "Congo",
  "Republic of China": "Taiwan",
  "Chinese Taipei": "Taiwan",
  "ROC": "Taiwan",
  "People's Republic of China": "China",
  "PRC": "China",
  "Mainland China": "China",
  "Russia": "Russia",
  "Russian Federation": "Russia",
  "Vietnam": "Vietnam",
  "Viet Nam": "Vietnam",
  "Iran": "Iran",
  "Islamic Republic of Iran": "Iran",
  "Czech Republic": "Czechia",
  "UAE": "United Arab Emirates",
  "UAR": "United Arab Emirates",
  "Emirates": "United Arab Emirates",
  "Republic of India": "India",
  "Federal Republic of Germany": "Germany",
  "Kingdom of Saudi Arabia": "Saudi Arabia",
  "KSA": "Saudi Arabia",
  "Republic of Turkey": "Turkey",
  "Türkiye": "Turkey",
  "Republic of Indonesia": "Indonesia",
  "Federative Republic of Brazil": "Brazil",
  "Commonwealth of Australia": "Australia",
  "Kingdom of Thailand": "Thailand",
};

export function normalizeCountryName(name: string): string {
  return COUNTRY_ALIASES[name] ?? name;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/decompose/country-aliases.ts
git commit -m "feat: add country name alias map for normalization"
```

---

### Task 4: Add evidence extraction prompt and update reconciliation prompt

**Files:**
- Modify: `lib/decompose/prompts.ts`

- [ ] **Step 1: Add evidence extraction prompt**

Add after the existing `searchQueryPrompt` function:

```typescript
const EVIDENCE_EXTRACTION_SYSTEM = `You are a data extraction assistant. Extract structured supply chain data from research results. Return ONLY valid JSON matching the schema. No markdown, no explanation.`;

export function evidenceExtractionPrompt(
  rawEvidence: string,
  nodeName: string
): string {
  return `Extract structured data from this supply chain research about "${nodeName}":

${rawEvidence}

Return JSON matching this schema:
{
  "countries": [{"name": "Country Name", "percentage": 45}],
  "majorProducers": ["Company A", "Company B"],
  "riskFactors": ["factor 1", "factor 2"],
  "confidenceSignal": "strong" | "moderate" | "weak"
}

Rules:
- countries: list of countries with their production/supply percentage. Percentages should sum to ~100.
- majorProducers: key companies or entities mentioned.
- riskFactors: supply chain risks identified (concentration, geopolitical, etc).
- confidenceSignal: "strong" if specific figures cited, "moderate" if general claims, "weak" if speculative.
- If data is not available for a field, use empty array or "weak".`;
}

export { EVIDENCE_EXTRACTION_SYSTEM };
```

- [ ] **Step 2: Update reconciliation prompt to accept structured evidence**

Replace the `reconciliationPrompt` function. Change `evidence` param from `Record<string, string>` to `Record<string, ExtractedEvidence>`:

```typescript
import type { DecompositionTree, ExtractedEvidence } from "./types";

export function reconciliationPrompt(
  tree: DecompositionTree,
  evidence: Record<string, ExtractedEvidence>
): string {
  const evidenceText = Object.entries(evidence)
    .map(([nodeId, ev]) => {
      const countries = ev.countries
        .map((c) => `${c.name}: ${c.percentage}%`)
        .join(", ");
      return `### Node: ${nodeId}
Geographic data: ${countries || "none extracted"}
Major producers: ${ev.majorProducers.join(", ") || "unknown"}
Risk factors: ${ev.riskFactors.join(", ") || "none identified"}
Evidence strength: ${ev.confidenceSignal}
Raw context: ${ev.rawText.slice(0, 500)}`;
    })
    .join("\n\n");

  return `You are a supply chain analyst updating a dependency tree with search evidence.

Here is the original decomposition tree:
${JSON.stringify(tree, null, 2)}

Here is structured evidence for specific nodes:
${evidenceText}

Update the tree JSON:
- Use the "Geographic data" percentages as the source of truth for geographic_concentration. Copy them directly when available.
- If evidence CONFIRMS a node's claims: set status to "verified", source to "industry", adjust confidence upward based on evidence strength (strong=0.9+, moderate=0.7-0.8, weak=no change)
- If evidence CONTRADICTS a node: set status to "verified", source to "search", correct the data
- If evidence reveals MISSING dependencies: add new nodes with status "inferred"
- Nodes without search evidence: leave unchanged
- Set phase to "refining"

Return the complete updated tree as JSON. No markdown, no explanation.`;
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/decompose/prompts.ts
git commit -m "feat: add evidence extraction prompt, update reconciliation for structured evidence"
```

---

### Task 5: Rewrite pipeline — parallel batched search, normalization, retry, new SSE events

**Files:**
- Modify: `lib/decompose/pipeline.ts`

This is the largest change. The pipeline needs:
1. Updated imports (new types, new prompts, country aliases)
2. New `normalizeConcentrations` + `normalizeCountryNames` functions
3. Updated `selectCriticalNodes` heuristic (max 12, skip root only, prioritize empty leaf nodes)
4. New `extractEvidence` helper function
5. Skeleton retry on JSON parse failure
6. Batched parallel search (waves of 4) with `search-started`/`search-complete` SSE events
7. Evidence extraction chained after each search
8. Normalization after reconciliation and adversarial phases
9. Evidence map type change from `Record<string, string>` to `Record<string, ExtractedEvidence>`

- [ ] **Step 1: Rewrite the full pipeline.ts**

Replace the entire file. Key structural changes from current:

```typescript
// lib/decompose/pipeline.ts

import type { DecompositionTree, SupplyChainNode, ExtractedEvidence } from "./types";
import {
  SKELETON_SYSTEM,
  ADVERSARIAL_SYSTEM,
  EVIDENCE_EXTRACTION_SYSTEM,
  skeletonPrompt,
  searchQueryPrompt,
  reconciliationPrompt,
  adversarialPrompt,
  evidenceExtractionPrompt,
} from "./prompts";
import { searchNode } from "./search";
import { normalizeCountryName } from "./country-aliases";

// ... keep existing OPENROUTER_BASE_URL, getModel, getApiKey, llmCall, parseJson, updateMetadata, sseEvent unchanged ...

// NEW: Normalize concentrations to sum to 100
function normalizeConcentrations(tree: DecompositionTree): void {
  for (const node of Object.values(tree.nodes)) {
    const entries = Object.entries(node.geographic_concentration);
    if (entries.length === 0) continue;

    // Normalize country names first
    const normalized: Record<string, number> = {};
    for (const [country, pct] of entries) {
      const canonicalName = normalizeCountryName(country);
      normalized[canonicalName] = (normalized[canonicalName] || 0) + pct;
    }

    // Normalize percentages to sum to 100
    const sum = Object.values(normalized).reduce((s, v) => s + v, 0);
    if (sum > 0 && (sum < 95 || sum > 105)) {
      const factor = 100 / sum;
      for (const key of Object.keys(normalized)) {
        normalized[key] = Math.round(normalized[key] * factor * 10) / 10;
      }
    }

    node.geographic_concentration = normalized;
  }
}

// NEW: Updated critical node selection — prioritizes evidence impact
function selectCriticalNodes(
  tree: DecompositionTree,
  maxNodes: number = 12
): SupplyChainNode[] {
  const candidates: [number, SupplyChainNode][] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.id === tree.root_id) continue;
    let score = 0;
    const isLeaf = node.children.length === 0;
    const hasConcentration = Object.keys(node.geographic_concentration).length > 0;
    if (isLeaf && !hasConcentration) score += 50;
    score += node.children.length * 8;
    score += (1 - node.confidence) * 30;
    score += node.tier * 5;
    score += node.risk_score * 0.3;
    candidates.push([score, node]);
  }
  candidates.sort((a, b) => b[0] - a[0]);
  return candidates.slice(0, maxNodes).map(([, node]) => node);
}

// NEW: Extract structured evidence from raw Perplexity text
async function extractEvidence(
  rawText: string,
  nodeName: string,
  signal?: AbortSignal
): Promise<ExtractedEvidence> {
  try {
    const raw = await llmCall(
      EVIDENCE_EXTRACTION_SYSTEM,
      evidenceExtractionPrompt(rawText, nodeName),
      0.2,
      signal
    );
    const parsed = parseJson(raw) as unknown as Omit<ExtractedEvidence, "rawText">;
    return { ...parsed, rawText };
  } catch {
    return {
      countries: [],
      majorProducers: [],
      riskFactors: [],
      confidenceSignal: "weak",
      rawText,
    };
  }
}

// Helper: find parent name for a node
function findParentName(tree: DecompositionTree, nodeId: string, fallback: string): string {
  for (const candidate of Object.values(tree.nodes)) {
    if (candidate.children.includes(nodeId)) {
      return candidate.name;
    }
  }
  return fallback;
}

// Helper: generate search query for a node
async function generateSearchQuery(
  node: SupplyChainNode,
  tree: DecompositionTree,
  product: string,
  signal?: AbortSignal
): Promise<string> {
  const parentName = findParentName(tree, node.id, product);
  try {
    let query = await llmCall(
      "Generate a search query. Return ONLY the query string.",
      searchQueryPrompt(node.name, node.type, parentName),
      0.3,
      signal
    );
    return query.trim().replace(/^["']|["']$/g, "");
  } catch {
    return `${node.name} global production supply chain ${product}`;
  }
}

export async function* runPipeline(
  product: string,
  suppliers: string[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const startTime = Date.now();

  // --- Phase 1: Skeleton (with retry) ---
  let tree: DecompositionTree;
  try {
    const raw = await llmCall(SKELETON_SYSTEM, skeletonPrompt(product, suppliers), 0.7, signal);
    tree = parseJson(raw) as unknown as DecompositionTree;
  } catch {
    // Retry with higher temperature
    try {
      const raw = await llmCall(SKELETON_SYSTEM, skeletonPrompt(product, suppliers), 0.8, signal);
      tree = parseJson(raw) as unknown as DecompositionTree;
    } catch (retryError) {
      yield sseEvent("error", {
        message: `Skeleton generation failed after retry: ${retryError instanceof Error ? retryError.message : retryError}`,
      });
      return;
    }
  }
  tree.phase = "skeleton";
  updateMetadata(tree);
  yield sseEvent("skeleton", { tree });

  // --- Phase 2: Batched Parallel Search + Evidence Extraction ---
  yield sseEvent("refining", {});

  const criticalNodes = selectCriticalNodes(tree);
  const evidence: Record<string, ExtractedEvidence> = {};
  const BATCH_SIZE = 4;

  for (let i = 0; i < criticalNodes.length; i += BATCH_SIZE) {
    const batch = criticalNodes.slice(i, i + BATCH_SIZE);

    // Yield search-started for this batch
    for (const node of batch) {
      yield sseEvent("search-started", { nodeId: node.id });
    }

    // Run batch in parallel: query → search → extract
    const results = await Promise.allSettled(
      batch.map(async (node) => {
        const query = await generateSearchQuery(node, tree, product, signal);
        const raw = await searchNode(query, signal);
        const extracted = await extractEvidence(raw, node.name, signal);
        return { nodeId: node.id, raw, extracted };
      })
    );

    // Yield search-complete for each result
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        evidence[result.value.nodeId] = result.value.extracted;
        tree.nodes[result.value.nodeId].search_evidence = result.value.raw;
        yield sseEvent("search-complete", { nodeId: result.value.nodeId, hasEvidence: true });
      } else {
        yield sseEvent("search-complete", { nodeId: batch[j].id, hasEvidence: false });
      }
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
      normalizeConcentrations(tree);
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
    normalizeConcentrations(tree);
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
git commit -m "feat: parallel batched search, evidence extraction, normalization, retry"
```

---

## Chunk 2: Frontend — Hook, Page State, Map Animations, Sidebar Detail

### Task 6: Update useDecompose hook — handle new SSE events

**Files:**
- Modify: `hooks/use-decompose.ts`

- [ ] **Step 1: Add new state fields and event handlers**

Update `DecomposeState` to include `searchingNodeIds` and `streamingNodes`:

```typescript
import type { DecompositionTree, SSEEvent, SupplyChainNode } from "@/lib/decompose/types";

interface DecomposeState {
  tree: DecompositionTree | null;
  isLoading: boolean;
  error: string | null;
  durationMs: number | null;
  selectedNodeId: string | null;
  searchingNodeIds: Set<string>;
  streamingNodes: SupplyChainNode[];
}
```

Update initial state to include new fields:

```typescript
const [state, setState] = useState<DecomposeState>({
  tree: null,
  isLoading: false,
  error: null,
  durationMs: null,
  selectedNodeId: null,
  searchingNodeIds: new Set(),
  streamingNodes: [],
});
```

Update the reset in `decompose` to also clear new fields:

```typescript
setState({
  tree: null,
  isLoading: true,
  error: null,
  durationMs: null,
  selectedNodeId: null,
  searchingNodeIds: new Set(),
  streamingNodes: [],
});
```

Add new cases in `handleEvent`:

```typescript
case "node-added":
  setState((prev) => ({
    ...prev,
    streamingNodes: [...prev.streamingNodes, event.node],
  }));
  break;
case "search-started":
  setState((prev) => ({
    ...prev,
    searchingNodeIds: new Set([...prev.searchingNodeIds, event.nodeId]),
  }));
  break;
case "search-complete":
  setState((prev) => {
    const next = new Set(prev.searchingNodeIds);
    next.delete(event.nodeId);
    return { ...prev, searchingNodeIds: next };
  });
  break;
case "skeleton":
  setState((prev) => ({ ...prev, tree: event.tree, streamingNodes: [] }));
  break;
case "error":
  setState((prev) => ({
    ...prev,
    isLoading: false,
    error: event.message,
    searchingNodeIds: new Set(),
    streamingNodes: [],
  }));
  break;
```

Note: the `skeleton` case now also clears `streamingNodes`, and `error` clears both `streamingNodes` and `searchingNodeIds`.

- [ ] **Step 2: Commit**

```bash
git add hooks/use-decompose.ts
git commit -m "feat: handle new SSE events in useDecompose hook"
```

---

### Task 7: Update page.tsx — pass new props to map

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Wire new hook state through to map**

The `InventorySidebar` already uses `useDecompose` internally and calls `onTreeChange`/`onNodeSelect`. The hook's new `searchingNodeIds` and `streamingNodes` need to flow from the sidebar to the map.

Add two new state variables in `SupplyChainCrisisDetector`:

```typescript
const [searchingNodeIds, setSearchingNodeIds] = useState<Set<string>>(new Set())
const [streamingNodes, setStreamingNodes] = useState<SupplyChainNode[]>([])
```

Add import for `SupplyChainNode`:

```typescript
import type { DecompositionTree, StoredProduct, SupplyChainNode } from "@/lib/decompose/types"
```

Pass new props to `SupplyChainMap`:

```typescript
<SupplyChainMap
  countryRisks={countryRisks}
  onCountrySelect={setSelectedCountry}
  selectedCountry={selectedCountry}
  customRoute={customRoute}
  decompositionTree={decompositionTree}
  selectedDecompNodeId={selectedDecompNodeId}
  searchingNodeIds={searchingNodeIds}
  streamingNodes={streamingNodes}
/>
```

Add callbacks and pass to `InventorySidebar`. The sidebar needs to forward the hook's `searchingNodeIds` and `streamingNodes` up. Add two new props to `InventorySidebarProps`:

```typescript
onSearchingChange?: (ids: Set<string>) => void
onStreamingNodesChange?: (nodes: SupplyChainNode[]) => void
```

Pass from page:

```typescript
<InventorySidebar
  products={products}
  onProductAdd={handleProductAdd}
  onTreeChange={setDecompositionTree}
  onNodeSelect={setSelectedDecompNodeId}
  onSearchingChange={setSearchingNodeIds}
  onStreamingNodesChange={setStreamingNodes}
/>
```

- [ ] **Step 2: Update InventorySidebar to forward hook state**

In `components/inventory-sidebar.tsx`, add the new props to `InventorySidebarProps` and add `useEffect` hooks to forward the hook's `searchingNodeIds` and `streamingNodes` to the parent:

```typescript
interface InventorySidebarProps {
  products: StoredProduct[];
  onProductAdd: (product: StoredProduct) => void;
  onTreeChange: (tree: DecompositionTree | null) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onSearchingChange?: (ids: Set<string>) => void;
  onStreamingNodesChange?: (nodes: SupplyChainNode[]) => void;
}
```

Inside the component, after the existing `useDecompose()` call, add effects:

```typescript
const { tree: hookTree, isLoading, error, durationMs, searchingNodeIds, streamingNodes, decompose, selectNode: hookSelectNode, abort } = useDecompose();

useEffect(() => {
  onSearchingChange?.(searchingNodeIds);
}, [searchingNodeIds, onSearchingChange]);

useEffect(() => {
  onStreamingNodesChange?.(streamingNodes);
}, [streamingNodes, onStreamingNodesChange]);
```

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx components/inventory-sidebar.tsx
git commit -m "feat: wire searchingNodeIds and streamingNodes to map"
```

---

### Task 8: Update map — progressive markers, pulse animation, risk halos, phase transitions

**Files:**
- Modify: `components/supply-chain-map.tsx`

- [ ] **Step 1: Update props interface**

```typescript
interface SupplyChainMapProps {
  countryRisks: CountryRisk[]
  onCountrySelect: (countryId: string | null) => void
  selectedCountry: string | null
  customRoute?: CustomRoute | null
  decompositionTree?: DecompositionTree | null
  selectedDecompNodeId?: string | null
  searchingNodeIds?: Set<string>
  streamingNodes?: SupplyChainNode[]
}
```

Add `SupplyChainNode` to the import from types:

```typescript
import type { DecompositionTree, SupplyChainNode } from "@/lib/decompose/types"
```

Update destructured props to include new ones:

```typescript
export function SupplyChainMap({
  countryRisks,
  onCountrySelect,
  selectedCountry,
  customRoute,
  decompositionTree,
  selectedDecompNodeId,
  searchingNodeIds,
  streamingNodes,
}: SupplyChainMapProps) {
```

- [ ] **Step 2: Add risk halo color helper**

Add after existing `CONCENTRATION_DOT_COLORS`:

```typescript
function getRiskHaloColor(riskScore: number): string {
  if (riskScore >= 70) return "#ef4444";
  if (riskScore >= 40) return "#f59e0b";
  return "#10b981";
}
```

- [ ] **Step 3: Add streaming nodes markers useMemo**

Add after existing `selectedNodeMarkers` useMemo:

```typescript
const streamingMarkers = useMemo(() => {
  if (!streamingNodes || streamingNodes.length === 0) return [];
  return streamingNodes.flatMap((node) => {
    const entries = Object.entries(node.geographic_concentration);
    if (entries.length === 0) return [];
    const [topCountry, topPct] = entries.sort(([, a], [, b]) => b - a)[0];
    return [{ country: topCountry, concentration: topPct, nodeId: node.id, riskScore: node.risk_score }];
  });
}, [streamingNodes]);
```

- [ ] **Step 4: Add CSS keyframes in a style tag at the top of the component JSX**

Inside the component's return, before `<ComposableMap>`, add:

```tsx
<style>{`
  @keyframes searchPulse {
    0%, 100% { transform: scale(1); opacity: 0.7; }
    50% { transform: scale(1.4); opacity: 1; }
  }
  @keyframes phasePulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.3); }
    100% { transform: scale(1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0); }
    to { opacity: 1; transform: scale(1); }
  }
`}</style>
```

- [ ] **Step 5: Update default marker rendering with risk halos and pulse animation**

Replace the existing default markers JSX block. Add risk halos (outer circle), pulse animation for searching nodes, and opacity based on phase:

```tsx
{/* Default Decomposition Concentration Markers (with halos) */}
{!selectedDecompNodeId &&
  defaultMarkers.map((marker) => {
    const coords = nodeCoordinates[marker.country];
    if (!coords) return null;
    const radius = Math.max(3, (marker.concentration / 100) * 10);
    const node = decompositionTree?.nodes[marker.nodeId];
    const isSearching = searchingNodeIds?.has(marker.nodeId);
    const isVerified = decompositionTree?.phase === "verified";
    return (
      <Marker key={`default-${marker.nodeId}`} coordinates={coords}>
        {/* Risk halo */}
        {node && (
          <circle
            r={radius + 4}
            fill={getRiskHaloColor(node.risk_score)}
            fillOpacity={isVerified ? 0.25 : 0.1}
          />
        )}
        {/* Main dot */}
        <circle
          r={radius}
          fill="#7c3aed"
          fillOpacity={isVerified ? 0.9 : 0.5}
          stroke="#7c3aed"
          strokeWidth={0.5}
          style={{
            filter: `drop-shadow(0 0 4px rgba(124, 58, 237, 0.5))`,
            animation: isSearching ? "searchPulse 1.2s ease-in-out infinite" : undefined,
            transition: "opacity 0.3s, fill-opacity 0.5s",
          }}
        />
      </Marker>
    );
  })}

{/* Streaming nodes (during skeleton phase, before full tree) */}
{!decompositionTree && streamingMarkers.map((marker) => {
  const coords = nodeCoordinates[marker.country];
  if (!coords) return null;
  const radius = Math.max(3, (marker.concentration / 100) * 10);
  return (
    <Marker key={`stream-${marker.nodeId}`} coordinates={coords}>
      <circle
        r={radius + 4}
        fill={getRiskHaloColor(marker.riskScore)}
        fillOpacity={0.1}
      />
      <circle
        r={radius}
        fill="#7c3aed"
        fillOpacity={0.5}
        stroke="#7c3aed"
        strokeWidth={0.5}
        style={{
          animation: "fadeIn 0.3s ease-out",
          filter: "drop-shadow(0 0 4px rgba(124, 58, 237, 0.3))",
        }}
      />
    </Marker>
  );
})}
```

Keep the existing `selectedNodeMarkers` rendering block unchanged (it already handles the selected-node detail view).

- [ ] **Step 6: Commit**

```bash
git add components/supply-chain-map.tsx
git commit -m "feat: progressive map markers, risk halos, search pulse animation"
```

---

### Task 9: Update sidebar NodeDetail — confidence bar, evidence toggle, ancestry breadcrumb

**Files:**
- Modify: `components/inventory-sidebar.tsx`

- [ ] **Step 1: Add ancestry breadcrumb helper**

Add before the `NodeDetail` component:

```typescript
function getAncestryPath(
  tree: DecompositionTree,
  nodeId: string
): SupplyChainNode[] {
  const path: SupplyChainNode[] = [];
  let currentId: string | null = nodeId;
  while (currentId) {
    const node = tree.nodes[currentId];
    if (!node) break;
    path.unshift(node);
    // Find parent
    let parentId: string | null = null;
    for (const candidate of Object.values(tree.nodes)) {
      if (candidate.children.includes(currentId)) {
        parentId = candidate.id;
        break;
      }
    }
    currentId = parentId;
  }
  return path;
}
```

- [ ] **Step 2: Update NodeDetail to accept tree prop and add visual improvements**

Change `NodeDetail` signature to accept the tree for ancestry:

```typescript
function NodeDetail({ node, tree }: { node: SupplyChainNode; tree: DecompositionTree }) {
```

Add ancestry breadcrumb at the top of the NodeDetail return, before the existing name header:

```tsx
{/* Ancestry breadcrumb */}
<div className="flex flex-wrap gap-1 text-xs text-muted-foreground mb-2">
  {getAncestryPath(tree, node.id).map((ancestor, i, arr) => (
    <span key={ancestor.id}>
      {i > 0 && <span className="mx-0.5">→</span>}
      <span className={cn(i === arr.length - 1 && "text-primary font-medium")}>
        {ancestor.name}
      </span>
    </span>
  ))}
</div>
```

Replace the Risk + Confidence section. Replace the plain number confidence with a progress bar, and risk with a colored bar:

```tsx
{/* Risk + Confidence */}
<div className="space-y-3">
  <div>
    <div className="flex items-center justify-between mb-1">
      <p className="text-[10px] uppercase text-muted-foreground">Risk</p>
      <p className={cn(
        "text-sm font-bold",
        node.risk_score >= 70 ? "text-red-500" : node.risk_score >= 40 ? "text-amber-500" : "text-green-500"
      )}>
        {node.risk_score}
      </p>
    </div>
    <div className="h-2 rounded-full bg-muted">
      <div
        className={cn(
          "h-2 rounded-full transition-all",
          node.risk_score >= 70 ? "bg-red-500" : node.risk_score >= 40 ? "bg-amber-500" : "bg-green-500"
        )}
        style={{ width: `${node.risk_score}%` }}
      />
    </div>
  </div>
  <div>
    <div className="flex items-center justify-between mb-1">
      <p className="text-[10px] uppercase text-muted-foreground">Confidence</p>
      <p className="text-sm font-bold text-blue-500">{node.confidence}</p>
    </div>
    <div className="h-2 rounded-full bg-muted">
      <div
        className="h-2 rounded-full bg-blue-500 transition-all"
        style={{ width: `${node.confidence * 100}%` }}
      />
    </div>
  </div>
</div>
```

Replace the search evidence section with a collapsible toggle:

```tsx
{/* Search Evidence */}
{node.search_evidence && (
  <details className="text-xs">
    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
      Show search evidence
    </summary>
    <p className="mt-1 whitespace-pre-wrap rounded bg-muted/50 p-2 text-muted-foreground">
      {node.search_evidence}
    </p>
  </details>
)}
```

- [ ] **Step 3: Update NodeDetail call sites to pass tree**

Find where `<NodeDetail node={...} />` is rendered in the detail view and add the `tree` prop. The active product's tree is `activeProduct.tree` (for existing products) or the hook's tree. Look for:

```tsx
<NodeDetail node={selectedNode} />
```

Replace with:

```tsx
<NodeDetail node={selectedNode} tree={activeProduct!.tree} />
```

- [ ] **Step 4: Commit**

```bash
git add components/inventory-sidebar.tsx
git commit -m "feat: ancestry breadcrumb, confidence/risk bars, evidence toggle in NodeDetail"
```

---

### Task 10: Build verification

- [ ] **Step 1: Run the build**

```bash
pnpm build
```

Expected: Build succeeds. Fix any TypeScript errors (note: `typescript.ignoreBuildErrors: true` is set, but check for runtime import errors).

- [ ] **Step 2: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve build issues from decomposition improvements"
```
