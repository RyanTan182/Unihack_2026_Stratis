# Inventory Sidebar — Design Spec

## Summary

Replace the floating `ProductDecomposition` card with an Inventory view inside the existing left sidebar. The nav strip becomes context-aware: "Locations" shows the Risk sidebar, "Inventory" shows a product list with decomposition capabilities. The decomposition pipeline, hook, and map marker logic are unchanged.

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
- `activeItem: string` — which nav item is currently active
- `onNavigate: (item: string) => void` — callback when a nav item is clicked

`page.tsx` manages an `activeView` state (`"risk" | "inventory"`) and conditionally renders either `RiskSidebar` or `InventorySidebar` in the same position.

The "Products" floating button on the map is removed. The "Build Route" button remains.

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
- During loading: progress indicator with phase status
- On completion: auto-navigates to View 3, product added to parent's product list

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

### State Management

**In `page.tsx`:**
- `activeView: "risk" | "inventory"` — which sidebar is shown
- `products: Array<{ id, name, tree, durationMs, createdAt }>` — session-only storage of decomposed products
- `decompositionTree: DecompositionTree | null` — currently viewed tree (passed to map)
- `selectedDecompNodeId: string | null` — currently selected node (passed to map)

**In `InventorySidebar`:**
- `view: "list" | "form" | "tree" | "detail"` — current internal view
- `activeProductId: string | null` — which product is being viewed
- `useDecompose()` hook — manages decomposition state for new products

### Map Integration

No changes to map marker logic. Behavior:

- **View 3 (tree), no node selected:** Purple dots on highest-concentration country per leaf node
- **View 4 (node detail):** Colored dots with percentage labels for selected node's countries
- **View 1, View 2, or Risk sidebar active:** No decomposition markers (`decompositionTree` set to null)
- **Switching products:** Map markers update to reflect the newly selected product's tree

### Component Extraction

Sub-components currently in `product-decomposition.tsx` are reused in `inventory-sidebar.tsx`:
- `SupplierTagInput` — tag input for suppliers
- `TreeNodeRow` — recursive collapsible tree row
- `NodeDetail` — geographic concentration bar, risk/confidence scores, risk factors, evidence, corrections
- `CONCENTRATION_COLORS` — color palette for concentration bars

These can be moved into `inventory-sidebar.tsx` directly or extracted to a shared location if needed.

## Files Changed

| File | Change |
|------|--------|
| `components/nav-sidebar.tsx` | Add `activeItem` prop + `onNavigate` callback. Remove hardcoded `active: true` on Locations. |
| `components/inventory-sidebar.tsx` | **New.** Inventory sidebar with 4 views. Reuses sub-components from product-decomposition.tsx. |
| `app/page.tsx` | Add `activeView` state, `products` array. Conditionally render `RiskSidebar` or `InventorySidebar`. Remove `isProductBuilderOpen` state, Products button, and `ProductDecomposition` usage. Wire `NavSidebar` with props. |
| `components/product-decomposition.tsx` | **Delete.** Replaced by inventory-sidebar.tsx. |

### Unchanged
- `hooks/use-decompose.ts` — hook stays the same
- `lib/decompose/*` — pipeline, prompts, search, types unchanged
- `app/api/decompose/route.ts` — API unchanged
- `components/supply-chain-map.tsx` — already accepts decompositionTree/selectedDecompNodeId props
- `components/risk-sidebar.tsx` — no changes
- `components/route-builder.tsx` — no changes

## Edge Cases

- **Switching sidebar while decomposition is loading:** Abort the in-progress decomposition (via AbortController). When user switches back to Inventory, they see the product list without the incomplete product.
- **Empty product list:** Show friendly empty state with prominent "Add Product" call-to-action.
- **Back navigation during loading:** Back arrow during decomposition aborts and returns to product list.
- **Multiple products with same name:** Allowed — each gets a unique ID.
- **Session-only storage:** Products are lost on page refresh. No persistence layer needed for hackathon scope.
