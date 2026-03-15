# Stratis — Supply Chain Risk Intelligence Platform

A comprehensive supply chain risk management and visualization platform built for **Unihack 2026**. Stratis helps businesses understand, analyze, and mitigate geopolitical, logistical, and price risks across their global supply chains through interactive maps, AI-powered insights, and relocation simulations.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)

---

## Features

### Interactive Supply Chain Map
- **Mapbox-powered** global map with country and chokepoint visualization
- Custom route builder with waypoints (origin, transit, destination)
- Route finder for discovering supply paths between countries
- Real-time risk overlay for countries and maritime chokepoints (Strait of Malacca, Suez Canal, Panama Canal, etc.)

### AI-Powered Product Decomposition
- Decomposes any product into a full supply chain dependency tree (4-5 tiers: product → subsystems → components → materials → geographies)
- Generates 25-40 nodes with geographic concentration percentages, confidence scores, and risk factors
- Evidence-backed verification via Perplexity Sonar real-time web search
- Streams results via SSE for progressive UI updates

### AI Risk Intelligence
- **Country risk evaluation** — OpenAI GPT-4.1 Nano evaluates tariff, conflict, and policy risk factors for both import and export sides using structured JSON schema output
- **News-grounded scoring** — Perplexity Sonar fetches real-time news headlines per country; the risk model uses these as evidence, falling back to base knowledge when headlines are irrelevant
- Weighted risk calculation (tariff 35%, conflict 40%, policy 25%) with confidence scores and rationale per factor
- Risk snapshots persisted to `public/data/risk-snapshots.json`
- Price risk timeline and volatility visualization
- Alert banners for critical supply chain disruptions

### AI Supplier Alternatives & Optimization
- **Supplier alternatives** — Kimi K2.5 (via OpenRouter) suggests 3-5 lower-risk sourcing countries for any high-risk component, filtered against a risk score database to guarantee safer results
- **Supply chain optimization** — Kimi K2.5 analyzes a product's full supply chain tree and returns risk warnings, diversification strategies, and concrete optimization suggestions
- Post-processing validates and normalizes all LLM outputs; deterministic fallback ensures results even without an API key

### AI Relocation Analysis
- **Relocation analysis** — Combines a deterministic scoring engine (market access, labor costs, infrastructure, trade agreements) with Kimi K2.5 qualitative enhancement for advantages, challenges, and geopolitical insights
- **Relocation simulation** — Simulates moving production between any two countries with cost impact, timeline, chokepoint avoidance, and risk reduction projections
- **Country comparison** — Side-by-side comparison of relocation targets

### Supply Chain Insights
- Health scoring and risk breakdown (geopolitical, logistics, price volatility)
- Critical chokepoint exposure analysis
- Actionable recommendations with potential savings
- Route comparison and path details panel

---

## AI Architecture

Stratis uses a multi-model architecture, choosing the right model for each task:

| AI Provider | Model | Used For | Why This Model |
|-------------|-------|----------|----------------|
| **OpenAI** | GPT-4.1 Nano | Country risk evaluation | Strict JSON schema output, fast batch processing, low cost for structured scoring |
| **OpenRouter** | Anthropic Claude Opus 4.6 (configurable) | Product decomposition | Deep reasoning for complex multi-tier supply chain trees |
| **OpenRouter** | Moonshot Kimi K2.5 | Alternatives, optimization, relocation analysis | Strong generalist reasoning with good cost-quality balance |
| **Perplexity** | Sonar | Real-time news search, supply chain research | Grounded web search for current events and evidence gathering |
| **GDELT** | — | News event data | Broad geopolitical event monitoring |

### How AI Flows Work

1. **Risk Evaluation Pipeline**: Perplexity Sonar fetches recent news per country → headlines are passed as evidence to GPT-4.1 Nano → structured risk scores (tariff/conflict/policy) are returned via JSON schema → weighted scores are computed server-side

2. **Product Decomposition Pipeline**: User enters a product name → Claude Opus 4.6 generates a full dependency tree as JSON → Perplexity Sonar searches for evidence on each node → tree is refined with real-world production data → results stream to the client via SSE

3. **Supplier Alternatives Flow**: User selects a high-risk component → Kimi K2.5 suggests lower-risk countries → server-side post-processing filters out countries above the risk threshold and deduplicates → deterministic fallback ensures results if the LLM returns poor suggestions

4. **Relocation Analysis Flow**: User specifies industry, risk concerns, priorities, and target markets → deterministic engine scores candidates using trade agreements, labor costs, and infrastructure data → Kimi K2.5 enhances top recommendations with qualitative insights → graceful fallback to engine-only results if the AI call fails

---

## Tech Stack

| Category | Technologies |
|----------|---------------|
| **Framework** | Next.js 16, React 19 |
| **Language** | TypeScript 5.7 |
| **Styling** | Tailwind CSS 4, shadcn/ui |
| **Maps** | Mapbox GL, react-map-gl |
| **Charts** | Recharts |
| **AI Models** | OpenAI GPT-4.1 Nano, Anthropic Claude Opus 4.6, Moonshot Kimi K2.5, Perplexity Sonar |
| **AI Routing** | OpenRouter, OpenAI API, Perplexity API |
| **Data Sources** | GDELT (news events), Mapbox (geospatial) |
| **Forms** | React Hook Form, Zod |

---

## Project Structure

```
├── app/
│   ├── page.tsx              # Main dashboard
│   ├── layout.tsx
│   ├── lib/                   # App-specific utilities (risk client, country utils)
│   └── api/                   # API routes
│       ├── risk-evaluate/     # OpenAI country risk evaluation
│       ├── ai/
│       │   ├── alternatives/  # Supplier alternatives (OpenRouter)
│       │   └── optimize/      # Optimization suggestions
│       ├── news/              # Perplexity news search
│       ├── gdelt/             # GDELT news integration
│       ├── decompose/        # Product decomposition pipeline
│       ├── relocation/
│       │   ├── simulate/      # Relocation simulation
│       │   ├── analyze/      # Relocation analysis
│       │   └── compare/      # Country comparison
│       └── save-risk-snapshots/
├── components/
│   ├── supply-chain-map.tsx   # Mapbox map + routes
│   ├── product-supply-chain.tsx
│   ├── risk-sidebar.tsx
│   ├── inventory-sidebar.tsx
│   ├── relocation-panel.tsx
│   ├── route-builder.tsx
│   ├── route-finder-panel.tsx
│   ├── path-details-panel.tsx
│   ├── supplier-recommendations.tsx
│   ├── price-risk-timeline.tsx
│   ├── alert-banner.tsx
│   └── ui/                   # shadcn components
├── lib/
│   ├── supply-chain-analyzer.ts
│   ├── route-finder.ts
│   ├── route-graph.ts
│   ├── risk-calculator.ts
│   ├── trade-agreements.ts
│   ├── relocation-engine.ts
│   ├── relocation-simulator.ts
│   └── decompose/            # Product decomposition (OpenRouter, Perplexity)
├── public/
│   └── data/
│       └── risk-snapshots.json
└── styles/
    └── globals.css
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/Unihack_2026_Stratis.git
cd Unihack_2026_Stratis

# Install dependencies
npm install --legacy-peer-deps
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Required for map visualization
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token

# Required for AI-powered features
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key

# Optional: for news-based risk analysis
PERPLEXITY_API_KEY=your_perplexity_key

# Optional: for decomposition model override
OPENROUTER_MODEL=anthropic/claude-opus-4-6
```

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | Yes | Mapbox access token for map display |
| `OPENAI_API_KEY` | Yes | OpenAI API key for country risk evaluation |
| `OPENROUTER_API_KEY` | Yes | OpenRouter key for alternatives, optimization, relocation |
| `PERPLEXITY_API_KEY` | No | Perplexity key for news search |
| `OPENROUTER_MODEL` | No | Override default model for decomposition |

### Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## API Routes

| Route | Method | AI Model | Description |
|-------|--------|----------|-------------|
| `/api/risk-evaluate` | POST | GPT-4.1 Nano | Batch country risk evaluation with structured JSON schema output |
| `/api/ai/alternatives` | POST | Kimi K2.5 | Suggest lower-risk supplier alternatives with post-processing validation |
| `/api/ai/optimize` | POST | Kimi K2.5 | Analyze supply chain tree and return optimization suggestions |
| `/api/news` | GET | Perplexity Sonar | Fetch real-time news headlines per country for risk evidence |
| `/api/gdelt` | GET | — | GDELT news event data integration |
| `/api/decompose` | POST | Claude Opus 4.6 + Perplexity Sonar | Product decomposition with evidence search (SSE streaming) |
| `/api/relocation/simulate` | POST | Kimi K2.5 | Simulate relocation with cost, timeline, and risk projections |
| `/api/relocation/analyze` | POST | Kimi K2.5 | Relocation analysis with AI-enhanced qualitative insights |
| `/api/relocation/compare` | POST | — | Deterministic country comparison for relocation |
| `/api/save-risk-snapshots` | POST | — | Persist risk evaluation snapshots to disk |

---

## License

This project was built for Unihack 2026. See the repository for license details.
