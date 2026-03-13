# Product Decomposition — Design Spec

## Summary

Replace the existing manual `ProductSupplyChain` component with an AI-powered product decomposition flow. The user enters a product name and known first-tier suppliers (companies). A 4-phase pipeline generates a full supply chain tree using LLM inference and Perplexity deep research, then renders geographic concentration data as markers on the map.

## User Flow

1. User clicks "Products" button (top-left of map, existing toggle)
2. Products panel opens on the right — shows input form: product name field + tag-style supplier input + "Decompose Supply Chain" button
3. User fills in product name (e.g., "Tesla Model 3") and adds suppliers as tags (e.g., "Panasonic", "CATL", "LG Energy")
4. User clicks "Decompose Supply Chain"
5. Skeleton tree appears immediately in the panel (faded, opacity 0.7). Status bar shows "Refining with deep research..."
6. Pipeline completes — tree becomes full opacity, "Verified" badge appears. Map shows purple dots on highest-concentration country per leaf node.
7. User clicks a node in the tree — right side of panel shows node detail (geographic concentration bar, risk score, confidence, risk factors). Map updates to show only that node's countries with sized, colored dots and percentage labels.
8. User clicks away / deselects — map returns to default overview state (all leaf nodes, single dots).

## Architecture

### API Layer

Single SSE endpoint: `POST /api/decompose`

**Request body:**
```json
{
  "product": "Tesla Model 3",
  "suppliers": ["Panasonic", "CATL", "LG Energy"]
}
```

**SSE events emitted:**
- `skeleton` — initial tree structure (phase 1 complete)
- `refining` — signal that search + reconciliation has started (phases 2-3 beginning)
- `verified` — final tree after adversarial review (phase 4 complete)
- `done` — completion signal with `{ durationMs: number }`
- `error` — `{ message: string }` if any phase fails

The endpoint orchestrates 4 phases sequentially:

**Phase 1 — Skeleton Generation (OpenRouter)**
- LLM generates initial tree from product name + supplier list
- 4-5 tiers deep, 20-40 nodes
- All nodes start as "inferred" with low-moderate confidence
- Suppliers are incorporated as known entities at tier 1
- Emits `skeleton` event with complete tree

**Phase 2 — Search Validation (Perplexity)**
- Select ~8 critical nodes (scoring: `tier * 10 + (1 - confidence) * 30 + risk_score * 0.5`, skip tier < 2)
- LLM generates focused search query per node
- Call Perplexity API with `sonar-deep-research` model for each
- Emits `refining` event at start of this phase

**Phase 3 — Reconciliation (OpenRouter)**
- LLM reviews all search evidence against the skeleton tree
- Confirms, corrects, or adds nodes based on evidence
- Updates confidence, geographic_concentration, risk_score, source fields

**Phase 4 — Adversarial Verification (OpenRouter)**
- LLM acts as skeptical auditor
- Checks for: implausible geographic concentrations, confused suppliers vs manufacturers, missing dependencies, incorrect risk scores, outdated attributions
- Marks corrected nodes with explanation
- Emits `verified` event with final tree

**External APIs:**
- OpenRouter (`OPENROUTER_API_KEY`) — kimi-k2.5 model for phases 1, 3, 4
- Perplexity (`PERPLEXITY_API_KEY`) — sonar-deep-research model for phase 2

### Data Model

```typescript
interface SupplyChainNode {
  id: string                          // kebab-case, e.g. "node-battery-pack"
  name: string                        // human-readable
  tier: number                        // 0=product, 1=subsystem, 2=component, 3=material, 4=geography
  type: "product" | "subsystem" | "component" | "material" | "geography"
  status: "inferred" | "searching" | "verified" | "corrected"
  confidence: number                  // 0.0-1.0
  geographic_concentration: Record<string, number>  // country → percentage (sums to ~100)
  risk_score: number                  // 0-100
  risk_factors: string[]
  source: "inferred" | "industry" | "search" | "adversarial"
  search_evidence?: string            // raw text from Perplexity
  correction?: string                 // adversarial correction explanation
  children: string[]                  // child node IDs
}

interface DecompositionTree {
  product: string
  phase: "skeleton" | "refining" | "verified"
  nodes: Record<string, SupplyChainNode>
  root_id: string
  metadata: {
    total_nodes: number
    verified_count: number
    corrected_count: number
    avg_confidence: number
  }
}
```

### Frontend Hook

`useDecompose()` — custom hook managing:
- `tree: DecompositionTree | null`
- `isLoading: boolean`
- `error: string | null`
- `durationMs: number | null`
- `selectedNodeId: string | null`
- `decompose(product: string, suppliers: string[]): void`
- `selectNode(nodeId: string | null): void`

SSE stream consumer using `ReadableStream` API. Maps 3 UI states:
- `skeleton` phase → tree visible at reduced opacity
- `refining` phase → pulsing status indicator
- `verified` phase → full opacity, verified badge

### Components

**`components/product-decomposition.tsx`** — replaces `product-supply-chain.tsx`

Three internal states:
1. **Input view** — product name field, supplier tag input, decompose button
2. **Loading view** — skeleton tree (faded) + "Refining with deep research..." status bar
3. **Complete view** — split panel: left = indented collapsible tree, right = node detail (geographic concentration stacked bar, risk/confidence scores, risk factors, search evidence)

Props:
```typescript
interface ProductDecompositionProps {
  isOpen: boolean
  onClose: () => void
  onTreeLoaded: (tree: DecompositionTree) => void
  onNodeSelected: (nodeId: string | null, tree: DecompositionTree) => void
}
```

Tree rendering:
- Indented list with expand/collapse (like file explorer)
- Risk score shown on nodes where >= 70 (red text)
- Selected node highlighted with purple left border
- Clicking a node selects it and shows detail panel on the right

### Map Integration

In `supply-chain-map.tsx`:

**Default state (tree loaded, no node selected):**
- For each leaf node in the tree, find the country with the highest `geographic_concentration`
- Render a `<circle>` at that country's coordinates (using existing `nodeCoordinates` map)
- Circle radius scaled by concentration percentage (e.g., 60% → larger, 10% → smaller)
- Purple fill (#7c3aed) with glow shadow
- No labels

**Node selected state:**
- Fade out all default dots
- For the selected node, render a circle for each country in its `geographic_concentration`
- Each circle sized by percentage, colored distinctly (blue, amber, green, purple — matching concentration bar)
- Show percentage label below each dot
- Show node name + country count indicator in top-left of map

**Deselect:** Return to default state.

Country name → coordinates mapping: extend the existing `nodeCoordinates` in `supply-chain-map.tsx` to cover countries that appear in decomposition results. Fall back to a lookup or skip if a country isn't in the map.

## Files Changed

### New files
| File | Purpose |
|------|---------|
| `app/api/decompose/route.ts` | SSE endpoint, orchestrates 4-phase pipeline |
| `lib/decompose/pipeline.ts` | Pipeline orchestration logic |
| `lib/decompose/prompts.ts` | AI prompt templates (ported from Python demo) |
| `lib/decompose/search.ts` | Perplexity API client |
| `lib/decompose/types.ts` | TypeScript interfaces for nodes and tree |
| `hooks/use-decompose.ts` | SSE stream consumer + state management |
| `components/product-decomposition.tsx` | Input form + tree viewer + node detail panel |

### Modified files
| File | Changes |
|------|---------|
| `app/page.tsx` | Swap `ProductSupplyChain` for `ProductDecomposition`. Remove old product/route state. Pass tree + selected node data to map. |
| `components/supply-chain-map.tsx` | Add concentration marker rendering. Remove `extractProductRoutes`, BFS product route rendering, and product route path drawing. |

### Removed files
| File | Reason |
|------|--------|
| `components/product-supply-chain.tsx` | Fully replaced by `product-decomposition.tsx` |
| `components/path-details-panel.tsx` | Route details panel no longer needed (dots replace routes) |
| `app/api/ai/alternatives/route.ts` | Replaced by decomposition pipeline |
| `app/api/ai/optimize/route.ts` | Replaced by decomposition pipeline |

### Unchanged
- `components/risk-sidebar.tsx`, `components/nav-sidebar.tsx`, `components/route-builder.tsx`
- `app/api/gdelt/route.ts`
- All existing country risk data, chokepoint logic, and network edge rendering

## Environment Variables

Existing:
- `OPENROUTER_API_KEY` — already used by current AI routes

New:
- `PERPLEXITY_API_KEY` — for sonar-deep-research calls in phase 2

## Edge Cases

- **Pipeline timeout:** The SSE connection stays open for the full pipeline duration (potentially 2-5 minutes with deep research). Set `maxDuration` on the API route for Vercel deployment. Frontend shows elapsed time during refining.
- **Perplexity failure on a node:** Skip that node's evidence, continue with remaining nodes. Log warning. Tree still gets reconciled with partial evidence.
- **Unknown country in results:** If the AI returns a country not in `nodeCoordinates`, skip its map marker rather than crashing. The tree detail panel still shows it in the concentration bar.
- **Empty suppliers:** Allow decomposition with just a product name and no suppliers. The skeleton phase handles this — suppliers are optional context, not required.
- **Abort/cancel:** Support aborting mid-stream via `AbortController` if the user closes the panel or starts a new decomposition.
