# Stratis - Supply Chain Crisis Detector

## Overview

Stratis is a real-time supply chain risk analysis platform built for **Unihack 2026**. It visualizes global trade routes on an interactive world map, calculates risk scores for countries and maritime chokepoints, and uses AI to suggest supply chain optimizations and alternative sourcing locations.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| Language | TypeScript 5.7.3 |
| UI Library | React 19.2 |
| Styling | Tailwind CSS 4.2 + shadcn/ui (Radix primitives) |
| Map | react-simple-maps (TopoJSON world atlas) |
| Charts | Recharts 2.15 |
| AI Backend | OpenRouter API (moonshotai/kimi-k2.5 model) |
| News Data | GDELT Project API |
| Analytics | Vercel Analytics |
| Package Manager | pnpm |

## Architecture

### Directory Structure

```
app/
  page.tsx              # Main page - single-page app, client-side rendered
  layout.tsx            # Root layout with metadata and Vercel Analytics
  globals.css           # Global styles
  api/
    ai/
      alternatives/route.ts   # AI-powered alternative sourcing suggestions
      optimize/route.ts       # AI-powered supply chain optimization analysis
    gdelt/route.ts             # Live news feed from GDELT Project API

components/
  nav-sidebar.tsx              # Left icon navigation bar
  risk-sidebar.tsx             # Right risk analysis panel with search, filters, metrics
  supply-chain-map.tsx         # Main interactive world map (core component, ~930 lines)
  route-builder.tsx            # Custom multi-country route builder panel
  product-supply-chain.tsx     # Product/component/material/resource tree builder
  path-details-panel.tsx       # Route detail overlay when clicking a supply chain path
  theme-provider.tsx           # Theme context provider
  ui/                          # ~60+ shadcn/ui components (button, card, dialog, etc.)

hooks/
  use-mobile.ts                # Mobile detection hook
  use-toast.ts                 # Toast notification hook

lib/
  utils.ts                     # Utility functions (cn classname merger)
```

### Data Flow

1. **Country & Chokepoint Risk Data** - Hardcoded in `page.tsx` as mock data. Contains ~45 countries and 6 maritime chokepoints (Suez Canal, Panama Canal, Strait of Hormuz, Strait of Malacca, Bab-el-Mandeb, Bosphorus) with import/export/overall risk scores and news highlights.

2. **Map Rendering** (`supply-chain-map.tsx`) - The core component. Uses `react-simple-maps` with Mercator projection. Renders:
   - Country polygons colored by risk level (purple gradient scale)
   - Network edges between connected countries/chokepoints
   - Custom user-defined routes with segment risk coloring
   - Product supply chain routes with BFS shortest-path routing through the node graph
   - Chokepoint markers (square icons) with active/inactive states
   - Product country markers with danger indicators

3. **Graph Routing** - An adjacency graph is built from country/chokepoint connections. BFS (`findShortestPath`) finds paths between supply chain nodes. Route segments are scored by averaging endpoint risks.

4. **AI Features** (via OpenRouter API):
   - **Alternative Sourcing** (`/api/ai/alternatives`) - Given a high-risk country and item, suggests 3-5 alternative countries with risk levels and reasoning.
   - **Supply Chain Optimization** (`/api/ai/optimize`) - Analyzes a full product supply chain tree and provides risk summary, warnings, and optimization suggestions.

5. **Live News** (`/api/gdelt`) - Fetches recent English-language articles from GDELT Project filtered by country and supply-chain-related themes (taxation, unrest, rebellion, natural disasters). Results shown in the risk sidebar when a country is selected.

## Key Features

- **Interactive World Map** - Zoomable/pannable map with risk-colored countries and chokepoint markers
- **Risk Sidebar** - Country search, risk metrics configuration, live news feed per country, risk legend
- **Route Builder** - Create custom multi-country shipping routes with per-segment and total risk analysis
- **Product Supply Chain Builder** - Hierarchical tree: Product > Component > Material > Resource, each assigned to a country. Visualized as colored routes on the map.
- **AI-Powered Suggestions** - Alternative sourcing for high-risk items, full supply chain optimization analysis
- **Path Details Panel** - Click any product route to see risk breakdown, transit time, reliability stats
- **Chokepoint Awareness** - Routes passing through maritime chokepoints are highlighted; chokepoints pulse when active in product routes

## Risk Scoring

- **Country Risk**: Import risk, export risk, overall risk (0-100 scale) - currently mock data
- **Route Segment Risk**: Average of endpoint country/chokepoint overall risks
- **Total Route Risk**: Weighted average favoring highest-risk segments (decreasing weight factor of 0.7)
- **Product Risk**: Weighted combination of own country risk (40%), avg child risk (40%), max child risk (20%)

## External Dependencies

- **OpenRouter API** - Requires `OPENROUTER_API_KEY` environment variable. Uses `moonshotai/kimi-k2.5` model.
- **GDELT Project API** - Public API, no key required. 3-month lookback, 15 articles max, 5-minute cache revalidation.
- **World Atlas TopoJSON** - Loaded from jsDelivr CDN (`world-atlas@2/countries-110m.json`)

## Configuration Notes

- `next.config.mjs` has `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`
- No database or authentication layer
- Single-page application (everything on the root `/` route)
- No test framework configured
- No CI/CD pipeline configured

## Current State

The project is at **MVP/hackathon prototype** stage:
- Risk data is hardcoded mock data (not connected to real scoring APIs)
- Path details panel uses mock statistics (transit time, reliability, etc.)
- Nav sidebar items are non-functional (only "Locations" is active)
- Risk metrics in the sidebar are display-only (toggling enabled/disabled has no effect)
- No user authentication or persistence
- No dark mode toggle (theme provider exists but unused)
