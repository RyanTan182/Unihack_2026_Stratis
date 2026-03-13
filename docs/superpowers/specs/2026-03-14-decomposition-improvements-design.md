# Decomposition Improvements — Design Spec

## Summary

Improve the single-product supply chain decomposition feature across three pillars: speed (parallel fast search + progressive streaming), depth & accuracy (structured evidence extraction + normalization), and visualization (progressive map animation + richer UI feedback). No cross-product changes. No new views or navigation — improvements are within the existing pipeline and UI.

## Pillar 1: Speed — Parallel Fast Search + Progressive Streaming

### 1a. Switch default search to `sonar` (fast model)

Current `search.ts` hardcodes `sonar-deep-research` (~30-120s per query). Change the default to `sonar` (~3-5s per query) and make it configurable.

**In `lib/decompose/search.ts`:**
- Add `model` parameter to `searchNode()` with default `"sonar"`
- Keep `sonar-deep-research` available as an option for future "deep dive" features

```typescript
export async function searchNode(
  query: string,
  signal?: AbortSignal,
  model: string = "sonar"
): Promise<string> {
  // ... existing code, but use `model` param instead of hardcoded string
  // Timeout is model-dependent: 15s for sonar, 120s for sonar-deep-research
  const timeoutMs = model === "sonar-deep-research" ? 120_000 : 15_000;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  // ... rest unchanged
}
```

### 1b. Parallelize all search calls

Current `pipeline.ts` searches nodes in a serial `for` loop. Replace with parallel execution.

**In `lib/decompose/pipeline.ts`:**
- Replace the serial loop with `Promise.allSettled()` on all critical nodes
- Each search is independent — no data dependency between them
- Failed searches are skipped gracefully (same as current behavior)

```typescript
// Before: serial
for (const node of criticalNodes) {
  const result = await searchNode(query, signal);
  evidence[node.id] = result;
}

// After: parallel
const searchPromises = criticalNodes.map(async (node) => {
  // ... generate query, search, return { nodeId, evidence }
});
const results = await Promise.allSettled(searchPromises);
```

### 1c. Stream skeleton nodes progressively

Current skeleton phase: single LLM call returns full JSON blob, parsed all at once. Change to streaming so nodes appear incrementally.

**In `lib/decompose/pipeline.ts`:**
- Use OpenRouter's `stream: true` option for the skeleton LLM call
- Accumulate tokens and attempt incremental JSON parsing
- When a complete node object is detected in the `nodes` map, emit a new `node-added` SSE event immediately
- After all tokens received, emit the full `skeleton` event as before (for backward compatibility)

**New SSE event:**
```typescript
| { type: "node-added"; node: SupplyChainNode; parentId: string | null }
```

**In `lib/decompose/types.ts`:**
- Add `node-added` to the `SSEEvent` union type

**Implementation detail:** Incremental JSON parsing of a streaming `nodes` map is non-trivial. Pragmatic approach: accumulate the full response, but use a regex/heuristic to detect when a complete node object closes (matching braces). Extract and emit each node as it completes, without waiting for the entire tree. If this proves too fragile, fall back to emitting the full skeleton at once (current behavior) — the parallel search speedup alone is the main win.

### 1d. Stream search progress

New SSE events to communicate per-node search status:

```typescript
| { type: "search-started"; nodeId: string }
| { type: "search-complete"; nodeId: string; hasEvidence: boolean }
```

**In `lib/decompose/pipeline.ts`:**

The `AsyncGenerator` pattern cannot yield events from inside parallel promises. Use a **batched concurrency** approach: run searches in waves of 4 nodes. Before each wave, yield `search-started` for all nodes in that wave. After the wave's `Promise.allSettled` resolves, yield `search-complete` for each. This gives the frontend 3 visual "pulses" of activity (3 waves × 4 nodes = 12 total) rather than all-at-once.

```typescript
// Batched parallel search with progress events
const BATCH_SIZE = 4;
for (let i = 0; i < criticalNodes.length; i += BATCH_SIZE) {
  const batch = criticalNodes.slice(i, i + BATCH_SIZE);

  // Yield search-started for this batch
  for (const node of batch) {
    yield sseEvent("search-started", { nodeId: node.id });
  }

  // Run batch in parallel
  const results = await Promise.allSettled(
    batch.map(async (node) => {
      const query = await generateSearchQuery(node, tree, signal);
      const raw = await searchNode(query, signal);
      const extracted = await extractEvidence(raw, node.name, signal);
      return { nodeId: node.id, raw, extracted };
    })
  );

  // Yield search-complete for each result
  for (const result of results) {
    if (result.status === "fulfilled") {
      evidence[result.value.nodeId] = result.value.extracted;
      tree.nodes[result.value.nodeId].search_evidence = result.value.raw;
      yield sseEvent("search-complete", { nodeId: result.value.nodeId, hasEvidence: true });
    } else {
      yield sseEvent("search-complete", { nodeId: batch[results.indexOf(result)].id, hasEvidence: false });
    }
  }
}
```

This preserves the `AsyncGenerator` pattern while giving the frontend real-time progress — each wave of 4 searches takes ~5s with `sonar`, so the frontend sees 3 pulses over ~15s.

**In `hooks/use-decompose.ts`:**
- Add `searchingNodeIds: Set<string>` to hook state
- `search-started`: add nodeId to set
- `search-complete`: remove nodeId from set
- New `handleEvent` cases:
```typescript
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
case "node-added":
  setState((prev) => ({
    ...prev,
    streamingNodes: [...prev.streamingNodes, event.node],
  }));
  break;
```

**In `lib/decompose/types.ts`:**
- Add all three events to `SSEEvent` union

**SSE emission pattern:** All new events use the existing `sseEvent(eventName, data)` helper (e.g., `yield sseEvent("node-added", { node, parentId })`). The API route (`route.ts`) is transparent — it streams raw bytes from the generator. The hook reconstructs `type` via `{ type: eventType, ...data }` from the SSE `event:` line. No route changes needed.

### Expected performance

| Phase | Current | Improved |
|-------|---------|----------|
| Skeleton | ~5-8s | ~5-8s (streaming makes it feel faster) |
| Search (8 nodes serial) | ~2-4min | ~15s (12 nodes, 3 batches × 4 parallel with sonar) |
| Evidence extraction | N/A | ~0s (runs in parallel with search, chained per node) |
| Reconciliation | ~5-10s | ~5-10s (unchanged) |
| Adversarial | ~5-10s | ~5-10s (unchanged) |
| **Total** | **~2.5-5min** | **~30-40s** |

## Pillar 2: Depth & Accuracy — Structured Evidence + Normalization

### 2a. Structured evidence extraction

After each Perplexity search returns raw prose, run a lightweight LLM extraction call to produce structured data.

**New type in `lib/decompose/types.ts`:**
```typescript
export interface ExtractedEvidence {
  countries: { name: string; percentage: number }[]
  majorProducers: string[]
  riskFactors: string[]
  confidenceSignal: "strong" | "moderate" | "weak"
  rawText: string
}
```

**New prompt in `lib/decompose/prompts.ts`:**
- `evidenceExtractionPrompt(rawEvidence: string, nodeName: string): string`
- System: "Extract structured supply chain data from research results. Return JSON only."
- User: raw evidence text + node context
- Temperature: 0.2 (deterministic extraction)

**In `lib/decompose/pipeline.ts`:**
- Evidence extraction is chained after each search within the same batch promise (see section 1d code). Each node's flow: generate query → search → extract → return structured result.
- The `evidence` map changes type from `Record<string, string>` to `Record<string, ExtractedEvidence>`
- Raw text is still stored on `node.search_evidence` for sidebar display

**Updated `reconciliationPrompt()` signature in `lib/decompose/prompts.ts`:**
```typescript
export function reconciliationPrompt(
  tree: DecompositionTree,
  evidence: Record<string, ExtractedEvidence>
): string {
  const evidenceText = Object.entries(evidence)
    .map(([nodeId, ev]) => {
      const countries = ev.countries.map(c => `${c.name}: ${c.percentage}%`).join(", ");
      return `### Node: ${nodeId}
Geographic data: ${countries || "none extracted"}
Major producers: ${ev.majorProducers.join(", ") || "unknown"}
Risk factors: ${ev.riskFactors.join(", ") || "none identified"}
Evidence strength: ${ev.confidenceSignal}
Raw context: ${ev.rawText.slice(0, 500)}`;
    })
    .join("\n\n");

  // ... rest of prompt unchanged (instructions for how to merge evidence into tree)
}
```

The structured format gives the reconciliation LLM explicit country/percentage data to copy into `geographic_concentration`, rather than parsing prose. `ExtractedEvidence.countries` maps directly to `node.geographic_concentration` — the reconciliation LLM should use extracted percentages as the source of truth and fall back to its own inference only when `countries` is empty.

### 2b. Geographic concentration normalization

Post-process `geographic_concentration` on every node after reconciliation and adversarial phases.

**New function in `lib/decompose/pipeline.ts`:**
```typescript
function normalizeConcentrations(tree: DecompositionTree): void {
  for (const node of Object.values(tree.nodes)) {
    const entries = Object.entries(node.geographic_concentration);
    if (entries.length === 0) continue;
    const sum = entries.reduce((s, [, v]) => s + v, 0);
    if (sum < 95 || sum > 105) {
      const factor = 100 / sum;
      node.geographic_concentration = Object.fromEntries(
        entries.map(([country, pct]) => [country, Math.round(pct * factor * 10) / 10])
      );
    }
  }
}
```

Call after reconciliation and after adversarial phases, before emitting SSE events.

**Country name alias map in `lib/decompose/country-aliases.ts`:**

The canonical target names are the keys in `nodeCoordinates` in `supply-chain-map.tsx`. The alias map should cover ~20-30 common LLM variants for those countries. Include short forms, demonyms-as-countries, and common abbreviations.

```typescript
export const COUNTRY_ALIASES: Record<string, string> = {
  "South Korea": "Korea, Republic of",
  "USA": "United States",
  "US": "United States",
  "UK": "United Kingdom",
  "DRC": "Congo, Democratic Republic of",
  "DR Congo": "Congo, Democratic Republic of",
  "Taiwan": "Taiwan, Province of China",
  "Russia": "Russian Federation",
  "Vietnam": "Viet Nam",
  "Iran": "Iran, Islamic Republic of",
  "Czech Republic": "Czechia",
  "UAR": "United Arab Emirates",
  "UAE": "United Arab Emirates",
  // ... extend as LLM outputs reveal new variants
}
```

**In normalization:** After normalizing percentages, also normalize country names by looking up aliases. This ensures map markers render correctly for countries the LLM names differently than `nodeCoordinates`.

### 2c. Improved critical node selection

Replace the current heuristic with one that prioritizes evidence impact.

**Current:** `tier * 10 + (1 - confidence) * 30 + risk_score * 0.5` — biased toward deep uncertain nodes.

**New heuristic in `lib/decompose/pipeline.ts`:**
```typescript
function selectCriticalNodes(
  tree: DecompositionTree,
  maxNodes: number = 12
): SupplyChainNode[] {
  const candidates: [number, SupplyChainNode][] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.id === tree.root_id) continue; // skip root
    let score = 0;
    // Leaf nodes with empty concentration: highest value (feed the map)
    const isLeaf = node.children.length === 0;
    const hasConcentration = Object.keys(node.geographic_concentration).length > 0;
    if (isLeaf && !hasConcentration) score += 50;
    // Nodes with many children: getting parent wrong cascades
    score += node.children.length * 8;
    // Low confidence: most uncertain
    score += (1 - node.confidence) * 30;
    // Higher tiers still matter somewhat
    score += node.tier * 5;
    // Risk amplifier
    score += node.risk_score * 0.3;
    candidates.push([score, node]);
  }
  candidates.sort((a, b) => b[0] - a[0]);
  return candidates.slice(0, maxNodes).map(([, node]) => node);
}
```

Key changes:
- Increase max from 8 to 12 (parallel search makes cost marginal)
- Heavily prioritize leaf nodes with no geographic data (these produce empty map markers)
- Reward nodes with many children (cascade effect)
- Skip root node (always the product itself — no need to search)
- Reduce tier weighting (was 10, now 5)
- **Intentionally includes tier 1 nodes** (e.g., "Battery Pack"): tier 1 subsystems often have well-documented geographic concentration data (e.g., "70% of EV batteries come from China"). The old `tier < 2` filter excluded these, but they're valuable search targets because getting a subsystem's geography right cascades to all its children.

### 2d. Retry on critical failures

**Skeleton retry:** If JSON parse fails, retry once with temperature bumped to 0.8.

**In `lib/decompose/pipeline.ts`:**
```typescript
// Phase 1: Skeleton
let tree: DecompositionTree;
let raw: string;
try {
  raw = await llmCall(SKELETON_SYSTEM, skeletonPrompt(product, suppliers), 0.7, signal);
  tree = parseJson(raw) as unknown as DecompositionTree;
} catch (firstError) {
  // Retry with higher temperature
  try {
    raw = await llmCall(SKELETON_SYSTEM, skeletonPrompt(product, suppliers), 0.8, signal);
    tree = parseJson(raw) as unknown as DecompositionTree;
  } catch (retryError) {
    yield sseEvent("error", { message: `Skeleton generation failed after retry: ${retryError}` });
    return;
  }
}
```

Reconciliation and adversarial: keep existing graceful skip behavior (tree is usable even without these phases).

## Pillar 3: Visualization — Progressive Map Animation + Richer UI Feedback

### 3a. Progressive map markers during skeleton streaming

**In `components/supply-chain-map.tsx`:**
- Current: markers rendered only from complete `decompositionTree`
- Change: also accept a `streamingNodes` prop (nodes arriving before the full tree is ready)
- As each `node-added` event arrives, if the node has `geographic_concentration`, render its marker immediately
- Markers fade in with CSS `transition: opacity 0.3s, transform 0.3s` (scale from 0 to 1)
- During skeleton phase: markers at opacity 0.5 to signal "unverified"

**New prop on `SupplyChainMapProps`:**
```typescript
streamingNodes?: SupplyChainNode[]  // nodes arriving before full tree
```

**In `app/page.tsx`:**
- New state: `streamingNodes: SupplyChainNode[]`, `searchingNodeIds: Set<string>`
- On `node-added` SSE: append to `streamingNodes`
- On `skeleton` SSE (full tree): clear `streamingNodes` (full tree takes over)
- On `error` SSE: clear `streamingNodes` (partial data should not persist after failure)
- On `search-started`/`search-complete`: update `searchingNodeIds` (managed in hook, passed through)

**Streaming fallback:** If incremental skeleton parsing fails and the pipeline falls back to emitting the full skeleton at once, no `node-added` events are emitted. The `skeleton` event still clears `streamingNodes`, so partial state is never left dangling.

### 3b. Search pulse animation

**In `components/supply-chain-map.tsx`:**
- Accept `searchingNodeIds` prop (Set of node IDs currently being searched)
- Markers whose node is in `searchingNodeIds`: apply CSS pulse animation

```css
@keyframes searchPulse {
  0%, 100% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.4); opacity: 1; }
}
```

- When `search-complete` fires (node removed from set): stop pulse, brief flash to risk color, then settle at full opacity

**New prop on `SupplyChainMapProps`:**
```typescript
searchingNodeIds?: Set<string>
```

### 3c. Risk-colored marker halos

**In `components/supply-chain-map.tsx`:**
- Current: all default markers are solid purple circles
- Change: add a second, larger circle behind each marker as a "halo"
- Halo color based on risk score:
  - Risk < 40: `#10b981` (green)
  - Risk 40-69: `#f59e0b` (amber)
  - Risk >= 70: `#ef4444` (red), slightly larger glow radius
- Inner dot stays purple for visual consistency
- Halo at low opacity (0.2-0.3) so it's subtle, not overwhelming

```tsx
{/* Halo */}
<circle
  r={radius + 4}
  fill={getRiskHaloColor(node.risk_score)}
  fillOpacity={0.25}
/>
{/* Main dot */}
<circle
  r={radius}
  fill="#7c3aed"
  fillOpacity={0.8}
/>
```

### 3d. Phase transition animations

CSS-driven animations triggered by phase changes:

- **Skeleton → Refining:** All markers pulse once simultaneously (`animation: phasePulse 0.6s ease-out`)
- **Refining → Verified:** Markers do a ripple animation — each marker's animation delay is proportional to its distance from the viewport center (since the root product node has no geographic position), creating an outward wave. Opacity transitions from 0.5 to 1.0.
- **Verified badge:** Scale-up animation on the sidebar badge (`transform: scale(0) → scale(1)` with slight overshoot via `cubic-bezier`)

Implementation: `decompositionPhase` prop already implicitly available via `decompositionTree.phase`. Map component reads phase and applies appropriate CSS class to marker containers.

### 3e. Richer node detail in sidebar

**In `components/inventory-sidebar.tsx` (NodeDetail sub-component):**

- **Confidence bar:** Replace plain number with a horizontal progress bar
  ```tsx
  <div className="h-2 rounded-full bg-muted">
    <div
      className="h-2 rounded-full bg-blue-500 transition-all"
      style={{ width: `${node.confidence * 100}%` }}
    />
  </div>
  ```

- **Risk gauge:** Replace plain number with a colored arc or semi-circle gauge
  - Simple implementation: a colored progress bar (same as confidence but with risk color stops)
  - Stretch: SVG semi-circle arc with gradient

- **Evidence toggle:** Search evidence collapsed by default. `node.search_evidence` continues to hold the raw Perplexity text (the `ExtractedEvidence` struct is used transiently in the pipeline only, not stored on nodes).
  ```tsx
  <details className="text-xs">
    <summary className="cursor-pointer text-muted-foreground">Show search evidence</summary>
    <p className="mt-1 whitespace-pre-wrap">{node.search_evidence}</p>
  </details>
  ```

- **Ancestry breadcrumb:** Show the path from root to current node at the top of detail view
  ```tsx
  // Tesla Model 3 → Battery Pack → Li-ion Cells → Lithium
  <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
    {ancestryPath.map((ancestor, i) => (
      <Fragment key={ancestor.id}>
        {i > 0 && <span>→</span>}
        <span className={cn(i === ancestryPath.length - 1 && "text-primary font-medium")}>
          {ancestor.name}
        </span>
      </Fragment>
    ))}
  </div>
  ```
  Computed by walking `tree.nodes` from root to current node via parent lookup.

## Files Changed

### Modified files
| File | Changes |
|------|---------|
| `lib/decompose/types.ts` | Add `ExtractedEvidence` interface. Add `node-added`, `search-started`, `search-complete` to `SSEEvent` union. |
| `lib/decompose/search.ts` | Add `model` parameter to `searchNode()`, default to `"sonar"`. |
| `lib/decompose/prompts.ts` | Add `evidenceExtractionPrompt()`. Update `reconciliationPrompt()` to accept structured evidence. |
| `lib/decompose/pipeline.ts` | Parallelize search calls. Add streaming skeleton support. Add normalization pass. Update critical node heuristic (max 12). Add skeleton retry. Add search progress SSE events. Add evidence extraction step. |
| `hooks/use-decompose.ts` | Handle new SSE events (`node-added`, `search-started`, `search-complete`). Add `searchingNodeIds` and `streamingNodes` to state. |
| `app/page.tsx` | Pass new props (`streamingNodes`, `searchingNodeIds`) to map. Handle new SSE-driven state. |
| `components/supply-chain-map.tsx` | Add `streamingNodes`, `searchingNodeIds` props. Add risk halos, pulse animations, phase transition animations, progressive marker rendering. |
| `components/inventory-sidebar.tsx` | Update NodeDetail: confidence bar, risk gauge, evidence toggle, ancestry breadcrumb. |

### New files
| File | Purpose |
|------|---------|
| `lib/decompose/country-aliases.ts` | Country name alias map for normalization. |

### Unchanged
- `app/api/decompose/route.ts` — already streams from the generator; new events flow through automatically
- `components/nav-sidebar.tsx` — no changes
- `components/risk-sidebar.tsx` — no changes
- `components/route-builder.tsx` — no changes

## Edge Cases

- **Streaming JSON parse failure:** If incremental skeleton parsing is too fragile, fall back to emitting the full skeleton at once. The parallel search speedup is the main time win; progressive node streaming is a nice-to-have.
- **All searches fail in parallel:** Same as current — reconciliation skips, adversarial works on skeleton-only tree. Evidence extraction step simply has no input.
- **Country alias not found:** If a country name doesn't match `nodeCoordinates` or `COUNTRY_ALIASES`, skip its map marker (current behavior). The sidebar still shows it in the concentration bar.
- **Large tree (100+ nodes):** 12 parallel searches + 12 parallel extractions = 24 concurrent API calls. Perplexity rate limits may apply. Add a concurrency limiter (e.g., max 6 concurrent searches) if needed.
- **Normalization edge case:** If all concentrations are 0, skip normalization (avoid division by zero).
- **Abort during parallel search:** `AbortSignal` propagates to all parallel `fetch` calls. `Promise.allSettled` resolves all (rejected or fulfilled), so cleanup is clean.
