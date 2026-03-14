# Inventory Sidebar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing `InventorySidebar` component into `page.tsx` so the Inventory nav icon switches the left sidebar between Risk and Inventory views, with map integration for decomposition markers.

**Architecture:** Make `NavSidebar` interactive (already done), conditionally render `RiskSidebar` or `InventorySidebar` based on `activeView` state. Add decomposition state (`inventoryProducts`, `decompositionTree`, `selectedDecompNodeId`) alongside existing state. Keep `ProductSupplyChain` floating panel unchanged.

**Tech Stack:** Next.js 16, React, TypeScript, shadcn/ui, lucide-react, existing `useDecompose` hook

---

## Completed Tasks (from previous session)

These tasks are already implemented and committed:

- [x] **Task 1: Add StoredProduct type** — `lib/decompose/types.ts` already has the `StoredProduct` interface
- [x] **Task 2: Make NavSidebar interactive** — `components/nav-sidebar.tsx` already has `activeItem`/`onNavigate` props
- [x] **Task 3: Create InventorySidebar component** — `components/inventory-sidebar.tsx` exists with 4 views (list, form, tree, detail)
- [x] **Task 5: Delete old ProductDecomposition** — `components/product-decomposition.tsx` already removed

---

## Remaining Work

### Task 4: Update page.tsx to wire everything together

**Files:**
- Modify: `app/page.tsx`

**Context:** After a merge, `page.tsx` now includes a risk evaluation system (`riskSnapshots`, `evaluateAllCountriesInChunks`, `resolvedCountryRisks`), `ProductSupplyChain` floating panel, and `PathDetailsPanel`. All of this must be preserved. The inventory sidebar integration adds new state alongside existing state.

**Changes needed:**
- Add `InventorySidebar` import and `StoredProduct`/`DecompositionTree`/`SupplyChainNode` type imports
- Add `useCallback` to React imports
- Add `activeView` state (`"risk" | "inventory"`)
- Add `inventoryProducts: StoredProduct[]` state (separate from existing `products: Product[]`)
- Add `decompositionTree: DecompositionTree | null` state
- Add `selectedDecompNodeId: string | null` state
- Add `searchingNodeIds: Set<string>` state (optional, for map animation)
- Add `streamingNodes: SupplyChainNode[]` state (optional, for map streaming markers)
- Add `handleNavigate` callback that switches `activeView` and clears decomposition state when switching to risk
- Add `handleProductAdd` callback that appends to `inventoryProducts`
- Wire `NavSidebar` with `activeItem` and `onNavigate` props
- Conditionally render `RiskSidebar` or `InventorySidebar` based on `activeView`
- Pass `decompositionTree`, `selectedDecompNodeId`, `searchingNodeIds`, `streamingNodes` to `SupplyChainMap`
- Keep `ProductSupplyChain`, Products button, `PathDetailsPanel`, route builder, risk evaluation — all unchanged

- [ ] **Step 1: Update imports**

Add to existing imports:

```typescript
import { useState, useEffect, useMemo, useCallback } from "react"  // add useCallback
import { InventorySidebar } from "@/components/inventory-sidebar"
import type { DecompositionTree, SupplyChainNode, StoredProduct } from "@/lib/decompose/types"
```

- [ ] **Step 2: Add new state variables after existing state declarations (after line ~695)**

```typescript
  // Inventory sidebar state
  const [activeView, setActiveView] = useState<"risk" | "inventory">("risk")
  const [inventoryProducts, setInventoryProducts] = useState<StoredProduct[]>([])
  const [decompositionTree, setDecompositionTree] = useState<DecompositionTree | null>(null)
  const [selectedDecompNodeId, setSelectedDecompNodeId] = useState<string | null>(null)
  const [searchingNodeIds, setSearchingNodeIds] = useState<Set<string>>(new Set())
  const [streamingNodes, setStreamingNodes] = useState<SupplyChainNode[]>([])
```

- [ ] **Step 3: Add navigation and product-add handlers (after handleRouteClick)**

```typescript
  const handleNavigate = useCallback((item: "locations" | "inventory") => {
    if (item === "locations") {
      setActiveView("risk")
      setDecompositionTree(null)
      setSelectedDecompNodeId(null)
      setSearchingNodeIds(new Set())
      setStreamingNodes([])
    } else {
      setActiveView("inventory")
    }
  }, [])

  const handleProductAdd = useCallback((product: StoredProduct) => {
    setInventoryProducts((prev) => [...prev, product])
  }, [])
```

- [ ] **Step 4: Wire NavSidebar with props**

Replace:
```typescript
<NavSidebar />
```

With:
```typescript
<NavSidebar
  activeItem={activeView === "risk" ? "locations" : "inventory"}
  onNavigate={handleNavigate}
/>
```

- [ ] **Step 5: Conditionally render RiskSidebar or InventorySidebar**

Replace:
```typescript
{/* Risk Analysis Sidebar */}
<RiskSidebar
  countryRisks={resolvedCountryRisks}
  selectedCountry={selectedCountry}
  onCountrySelect={setSelectedCountry}
  onReset={handleReset}
/>
```

With:
```typescript
{/* Sidebar — Risk or Inventory */}
{activeView === "risk" ? (
  <RiskSidebar
    countryRisks={resolvedCountryRisks}
    selectedCountry={selectedCountry}
    onCountrySelect={setSelectedCountry}
    onReset={handleReset}
  />
) : (
  <InventorySidebar
    products={inventoryProducts}
    onProductAdd={handleProductAdd}
    onTreeChange={setDecompositionTree}
    onNodeSelect={setSelectedDecompNodeId}
    onSearchingChange={setSearchingNodeIds}
    onStreamingNodesChange={setStreamingNodes}
  />
)}
```

- [ ] **Step 6: Pass decomposition props to SupplyChainMap**

Add these props to the existing `<SupplyChainMap>` element (alongside existing `products`, `selectedRouteId`, `onRouteClick`):

```typescript
decompositionTree={decompositionTree}
selectedDecompNodeId={selectedDecompNodeId}
searchingNodeIds={searchingNodeIds}
streamingNodes={streamingNodes}
```

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire inventory sidebar into page with nav switching and map integration"
```

---

### Task 6: Verify the build compiles and test manually

- [ ] **Step 1: Run the build**

```bash
pnpm build
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 2: Run dev server and test manually**

```bash
pnpm dev
```

Expected behavior:
1. App loads — left sidebar shows Risk view (Locations icon highlighted)
2. Click Inventory icon → sidebar switches to Inventory view with empty state
3. Click "Add Product" → input form appears with back arrow
4. Enter product name and suppliers → click "Decompose Supply Chain"
5. Loading state shows (skeleton → refining)
6. On completion → tree view appears with metadata bar
7. Click a node → full-width detail view with back arrow. Map shows colored dots.
8. Click back → tree view. Map shows purple leaf-node dots.
9. Click back → product list with the product card visible. Map markers clear.
10. Click Locations icon → Risk sidebar returns. Map markers clear.
11. Products button on map still works independently → opens ProductSupplyChain panel.

- [ ] **Step 3: Fix any issues and commit**

```bash
git add -A
git commit -m "fix: resolve build/runtime issues from integration"
```
