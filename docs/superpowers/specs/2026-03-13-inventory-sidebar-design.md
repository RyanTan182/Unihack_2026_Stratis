# Inventory Sidebar — Design Spec

## Summary

Add an Inventory view inside the existing left sidebar, triggered by the Inventory nav icon. The nav strip becomes context-aware: "Locations" shows the Risk sidebar, "Inventory" shows a product list with AI decomposition capabilities. The existing `ProductSupplyChain` floating panel (manual product/route management) is a separate feature and remains unchanged. The decomposition pipeline, hook, and map marker logic are unchanged.

## User Flow

1. User clicks **Inventory** icon in the left nav strip
2. Left sidebar switches from Risk view to Inventory view — shows list of previously decomposed products (or empty state with "Add Product" button)
3. User clicks "+" or "Add Product" → input form appears: product name field, supplier tag input, "Decompose Supply Chain" button
4. User fills in product name and suppliers, clicks decompose
5. Loading state shows in the form area (skeleton status → refining status)
6. On completion, automatically navigates to tree view. Product is added to the list.
7. Tree view shows full-width collapsible tree with metadata bar (node count, confidence, duration, verified badge)
8. User clicks a node → sidebar navigates to full-width node detail (geographic concentration bar, risk/confidence, risk factors, search evidence, corrections). Map shows that node's concentration markers.
9. User clicks back → returns to tree view. Map shows default leaf-node markers.
10. User clicks back again → returns to product list. Map clears decomposition markers.
11. User clicks a different product → tree view for that product, map updates accordingly.
12. User clicks **Locations** icon → sidebar switches back to Risk view. Map clears decomposition markers.

## Architecture

### Navigation

The `NavSidebar` component gains two props:
- `activeItem: "locations" | "inventory"` — which nav item is currently active
- `onNavigate: (item: "locations" | "inventory") => void` — callback when an interactive nav item is clicked

Only "Locations" and "Inventory" are interactive. All other nav items (Dashboard, Alerts, Analytics, etc.) remain inert/decorative.

`page.tsx` manages an `activeView` state (`"risk" | "inventory"`) and conditionally renders either `RiskSidebar` or `InventorySidebar` in the same position.

The "Products" floating button and `ProductSupplyChain` panel remain unchanged — they are a separate feature for manual product/route management. The "Build Route" button also remains.

### Inventory Sidebar Views

The `InventorySidebar` component manages 4 internal views via local state:

**View 1 — Product List (landing)**
- Header: "Inventory" with "+" icon button
- List of product cards, each showing: product name, node count, avg confidence, verified badge, duration
- Clicking a card → View 3
- Empty state: "No products yet" message with "Add Product" button

**View 2 — Input Form**
- Header: "New Product" with back arrow → View 1
- Product name text field
- Supplier tag input (tag chips with add/remove)
- "Decompose Supply Chain" button (disabled until product name entered)
- During loading: progress indicator with phase status (skeleton → refining)
- On completion: calls `onProductAdd` with the finished tree, auto-navigates to View 3
- On error: shows inline error message with retry button. Product is NOT added to the list on failure.
- Back arrow during loading: aborts decomposition, returns to View 1

**View 3 — Decomposition Tree**
- Header: Product name with back arrow → View 1
- Metadata bar: node count, avg confidence, duration, verified badge
- Full-width collapsible tree (reuses existing `TreeNodeRow` pattern)
- Clicking a node → View 4
- Faded opacity during skeleton phase, full opacity when verified

**View 4 — Node Detail**
- Header: Node name with back arrow → View 3
- Full-width node detail: geographic concentration stacked bar with legend, risk score (color-coded), confidence score, risk factor badges, search evidence text block, adversarial correction block
- Map updates to show selected node's concentration markers

### Data Model

```typescript
interface StoredProduct {
  id: string               // crypto.randomUUID()
  name: string
  suppliers: string[]
  tree: DecompositionTree
  durationMs: number
  createdAt: number        // Date.now()
}
```

### Component Interface

```typescript
interface InventorySidebarProps {
  products: StoredProduct[]
  onProductAdd: (product: StoredProduct) => void
  onTreeChange: (tree: DecompositionTree | null) => void
  onNodeSelect: (nodeId: string | null) => void
  onSearchingChange?: (ids: Set<string>) => void
  onStreamingNodesChange?: (nodes: SupplyChainNode[]) => void
}
```

**Callback contract — when each callback fires:**
- `onProductAdd(product)` — when a new decomposition completes successfully (View 2 → View 3 transition). `page.tsx` appends to the `inventoryProducts` array.
- `onTreeChange(tree)` — when navigating to View 3 (set to product's tree), or when navigating back to View 1 / switching away (set to null). `page.tsx` sets `decompositionTree` for the map.
- `onNodeSelect(nodeId)` — when clicking a node in View 3 (set to node ID, transitions to View 4), or when navigating back to View 3 (set to null). `page.tsx` sets `selectedDecompNodeId` for the map.
- `onSearchingChange(ids)` — optional, fires when search-phase node IDs change. `page.tsx` passes to map for pulsing animation.
- `onStreamingNodesChange(nodes)` — optional, fires during skeleton phase as nodes stream in. `page.tsx` passes to map for streaming markers.

### State Management

**In `page.tsx` (new state for inventory feature — coexists with existing state):**
- `activeView: "risk" | "inventory"` — which sidebar is shown
- `inventoryProducts: StoredProduct[]` — session-only storage of decomposed products. Named `inventoryProducts` to avoid collision with existing `products: Product[]` used by `ProductSupplyChain`.
- `decompositionTree: DecompositionTree | null` — derived from active product (passed to map). Set by `onTreeChange` callback. Cleared when switching to risk view.
- `selectedDecompNodeId: string | null` — set by `onNodeSelect` callback (passed to map)
- `searchingNodeIds: Set<string>` — optional, for map pulsing animation during search phase
- `streamingNodes: SupplyChainNode[]` — optional, for map streaming markers during skeleton phase

**Existing `page.tsx` state (unchanged):**
- `products: Product[]` — used by `ProductSupplyChain` for manual product/route management
- `isProductBuilderOpen: boolean` — toggles the `ProductSupplyChain` floating panel
- `selectedRoute: ProductSupplyRoute | null` — selected route for `PathDetailsPanel`
- `riskSnapshots`, `riskLoadingIds`, `isBulkEvaluating`, `bulkProgress` — risk evaluation system
- `resolvedCountryRisks` — useMemo that merges risk evaluations into base country data

**In `InventorySidebar`:**
- `view: "list" | "form" | "tree" | "detail"` — current internal view
- `activeProductId: string | null` — which product from the `products` prop is being viewed
- `useDecompose()` hook — used ONLY during View 2 for new decompositions. Once complete, the tree is snapshot into a `StoredProduct` via `onProductAdd`. For viewing existing products (View 3/4), the sidebar reads from the `products` prop — NOT from the hook.

### Map Integration

No changes to map marker logic. Behavior:

- **View 3 (tree), no node selected:** Purple dots on highest-concentration country per leaf node
- **View 4 (node detail):** Colored dots with percentage labels for selected node's countries
- **View 1, View 2, or Risk sidebar active:** No decomposition markers (`decompositionTree` set to null). Clicking a product from the list will cause markers to appear as the tree loads — this is intentional.
- **Switching products:** Map markers update to reflect the newly selected product's tree

### Component Extraction

Sub-components are defined directly in `inventory-sidebar.tsx`:
- `SupplierTagInput` — tag input for suppliers
- `TreeNodeRow` — recursive collapsible tree row
- `NodeDetail` — geographic concentration bar, risk/confidence scores, risk factors, evidence, corrections
- `ProductCard` — product list item
- `CONCENTRATION_COLORS` — color palette for concentration bars

### Coexistence with ProductSupplyChain

`ProductSupplyChain` (`components/product-supply-chain.tsx`) is a separate feature for manually defining products with supply chain routes, components, and locations. It uses the `Product` type (not `StoredProduct`) and renders as a floating panel toggled by the "Products" button on the map.

`InventorySidebar` is for AI-powered decomposition — it uses the `StoredProduct` type and renders in the left sidebar position. The two features are independent and coexist without conflict:
- `ProductSupplyChain` uses `products: Product[]` + `isProductBuilderOpen` + `selectedRoute`
- `InventorySidebar` uses `inventoryProducts: StoredProduct[]` + `decompositionTree` + `selectedDecompNodeId`

## Files Changed

| File | Change |
|------|--------|
| `app/page.tsx` | Add `activeView` state, `inventoryProducts` array, decomposition state. Conditionally render `RiskSidebar` or `InventorySidebar`. Wire `NavSidebar` with props. Pass decomposition props to `SupplyChainMap`. Keep `ProductSupplyChain`, Products button, `PathDetailsPanel` as-is. |

### Already Done (from previous implementation session)
- `lib/decompose/types.ts` — `StoredProduct` interface already added
- `components/nav-sidebar.tsx` — Already has `activeItem`/`onNavigate` props
- `components/inventory-sidebar.tsx` — Already created with 4 views and all sub-components
- `components/product-decomposition.tsx` — Already deleted

### Unchanged
- `hooks/use-decompose.ts` — hook stays the same
- `lib/decompose/*` — pipeline, prompts, search, types unchanged
- `app/api/decompose/route.ts` — API unchanged
- `components/supply-chain-map.tsx` — already accepts decompositionTree/selectedDecompNodeId/searchingNodeIds/streamingNodes props
- `components/risk-sidebar.tsx` — no changes
- `components/route-builder.tsx` — no changes
- `components/product-supply-chain.tsx` — no changes (separate feature)
- `components/path-details-panel.tsx` — no changes

## Edge Cases

- **Switching sidebar while decomposition is loading:** Abort the in-progress decomposition (via AbortController). When user switches back to Inventory, they see the product list without the incomplete product.
- **Empty product list:** Show friendly empty state with prominent "Add Product" call-to-action.
- **Back navigation during loading:** Back arrow during decomposition aborts and returns to product list.
- **Multiple products with same name:** Allowed — each gets a unique ID.
- **Session-only storage:** Products are lost on page refresh. No persistence layer needed for hackathon scope.
