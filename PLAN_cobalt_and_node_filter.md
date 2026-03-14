# Plan: Multi-Source Cobalt Display & Node Selection Filter

## Problem 1: Cobalt Only Shows Top Producer (Congo)

### Root Cause
In `lib/decompose/to-map-product.ts`, `nodeToSupplyChainItems()` only expands to multiple countries when **both** conditions hold:
- `isPredicted` (node.status === "inferred" || "searching")
- `alternatives.length > 1`

If Cobalt has `status: "verified"` (e.g. from knowledge base) but `geographic_concentration: {Congo: 70, Australia: 15, Philippines: 10, Russia: 5}`, we return **only Congo** (line 118-136). Verified nodes with multiple countries are collapsed to the top country.

### Fix
1. **Expand for all nodes with multiple countries** – Change condition from `(!isPredicted || alternatives.length <= 1)` to `(alternatives.length <= 1)`. Expand whenever `alternatives.length > 1`, regardless of predicted status.
2. **Preserve children when expanding** – For nodes with children, pass `children` to each expanded item (currently `children: []` loses them).
3. **Opacity by percentage** – Primary (highest %) source: full opacity (0.9). Secondary: `0.4 + 0.5 * (percentage/100)` so 70%→0.75, 15%→0.475, etc.
4. **Pass `countryPercentage` through routes** – Add `countryPercentage?: number` to `ProductSupplyRoute` and `extractFromItem`, use it in `productRoutesGeoJSON` for route opacity.
5. **Marker opacity by percentage** – In `productCountryMarkers`, set marker opacity from `item.percentage` (e.g. `opacity: 0.5 + 0.5 * (percentage/100)`).

---

## Problem 2: Node Selection Filter for Map

### Current Flow
- `InventorySidebar` calls `onNodeSelect(nodeId)` when user clicks a node (via `viewNode`).
- `app/page.tsx` has `selectedDecompNodeId` and `handleNodeSelect`.
- `SupplyChainMap` receives `products={mapProducts}` but **does not** receive `selectedDecompNodeId`.
- Map shows all products/routes with no filtering.

### Required Behavior
When a node is selected, show only:
- The selected node (and its country variants if expanded)
- Its parent chain (up to product root)
- Its children (recursively)

All other nodes and connections should be hidden.

### Fix
1. **Pass `selectedDecompNodeId` and `activeTree` to map** – SupplyChainMap needs both to filter.
2. **Filter `mapProducts` before passing to map** – In `app/page.tsx`, create `filteredMapProducts` memo that:
   - When `selectedDecompNodeId` is null: return `mapProducts` unchanged.
   - When set: for each product, filter components to the subtree of the selected node (path from root to selected + selected + descendants). Match by `component.id === selectedNodeId` or `component.id.startsWith(selectedNodeId + "-")`.
3. **Filter logic** – Recursive helper:
   - Walk product.components tree.
   - Find component(s) matching selectedNodeId (exact or prefix for expanded).
   - Return new Product with only: (a) path from root to that component, (b) the component and all its descendants.
4. **Handle multiple products** – If user has multiple stored products, filter applies per product; products without the selected node can be hidden or shown with empty components.

### Component ID Matching
- Map component id: `node.id` (e.g. `"cobalt-abc"`) or `node.id + "-" + country` (e.g. `"cobalt-abc-Congo"`) for expanded.
- Selected node id from tree: `"cobalt-abc"`.
- Match: `id === selectedNodeId || id.startsWith(selectedNodeId + "-")`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `lib/decompose/to-map-product.ts` | Expand when `alternatives.length > 1` (remove isPredicted gate); pass `children` to expanded items |
| `components/supply-chain-map.tsx` | Add `countryPercentage` to route; use it for route opacity; add `selectedDecompNodeId` prop; filter products by selected node; marker opacity by percentage |
| `app/page.tsx` | Create `filterProductsBySelectedNode()`; pass `selectedDecompNodeId`, `activeTree` to map; use filtered products |

---

## Implementation Order

1. **to-map-product.ts** – Fix expansion logic (Problem 1).
2. **supply-chain-map.tsx** – Add `countryPercentage` to routes, opacity by percentage for routes and markers.
3. **app/page.tsx** – Add filter logic, pass `selectedDecompNodeId` and filtered products to map.
4. **supply-chain-map.tsx** – Implement product filtering (or do it in page and pass filtered products).
