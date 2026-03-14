# MiroFish Integration Design — Predictive Geopolitical Risk for Stratis

## Purpose

Integrate MiroFish, an open-source multi-agent swarm intelligence engine, into Stratis to provide predictive geopolitical risk analysis. Instead of only showing current risk scores derived from news, the system will simulate how geopolitical scenarios evolve over 1-6 months using thousands of AI agents (traders, government officials, military analysts, diplomats, journalists, protesters). This turns Stratis from a reactive dashboard into a forward-looking strategic decision-making tool.

## Goals

- Predict supply chain risks before they materialize in the news
- Provide both automatic early warnings and user-initiated "what-if" scenario exploration
- Show the simulation running live for demo impact — agents discussing, sentiment shifting, predictions forming in real-time
- Medium-term predictions (1-6 months) focused on informing sourcing and relocation decisions

## Non-Goals

- Short-term operational predictions (< 1 month)
- Long-term strategic forecasting (> 6 months)
- Automated action-taking — predictions inform only, user decides what to do
- Building a custom simulation engine — we use MiroFish as-is

---

## Architecture

```
GDELT/Perplexity News --> Next.js API --> Seed Document Builder --> MiroFish API (:5001)
                                                                        |
                                                              +-------------------+
                                                              |   OASIS Engine    |
                                                              |   (20-30 agents:  |
                                                              |   traders, govt   |
                                                              |   officials,      |
                                                              |   military,       |
                                                              |   diplomats,      |
                                                              |   journalists,    |
                                                              |   protesters)     |
                                                              +--------+----------+
                                                                       |
                                                  Predictions (report + agent interviews)
                                                                       |
                                                              +--------+----------+
                                                              |   Next.js API     |
                                                              |   /api/predict    |
                                                              +--------+----------+
                                                                       |
                                              +------------------------+-------------------+
                                              |                        |                   |
                                        Risk Sidebar            Predictions          Alert Toasts
                                        (projected scores)      Panel (new)          (critical warnings)
```

MiroFish runs as a Docker sidecar alongside the Next.js app. The existing GDELT + news endpoints fetch raw event data. A new layer converts those events into MiroFish seed documents, triggers simulations, and pipes predictions back into the UI.

---

## Backend

### MiroFish Client (`lib/mirofish/client.ts`)

A TypeScript client wrapping MiroFish's Flask REST API (port 5001). Handles the full simulation lifecycle:

1. **Ontology generation** — `POST /graph/ontology/generate` (multipart form-data with seed markdown document + simulation requirement)
2. **Graph build** — `POST /graph/build` (builds knowledge graph from seed data via Zep)
3. **Simulation create** — `POST /simulation/create`
4. **Simulation prepare** — `POST /simulation/prepare` (generates agent profiles + config)
5. **Simulation start** — `POST /simulation/start` (runs the OASIS engine)
6. **Status polling** — `GET /simulation/<id>/run-status`
7. **Actions retrieval** — `GET /simulation/<id>/actions` (for live feed)
8. **Report generation** — `POST /report/generate`
9. **Report retrieval** — `GET /report/<id>`

All async operations return a `task_id` for polling. The client handles retry logic and timeout management.

### Seed Document Builder (`lib/mirofish/seed-builder.ts`)

Converts GDELT events + Perplexity news articles into a structured markdown document:

```markdown
# Geopolitical Events: [Region/Country]
## Recent Events
- [event summaries from GDELT with dates, actors, themes]
## News Analysis
- [articles from Perplexity with key details]
## Current Risk Context
- [existing Stratis risk scores for relevant countries]
## Supply Chain Dependencies
- [affected trade routes, chokepoints, industries]
```

This markdown file is uploaded to MiroFish as the seed input.

### Types (`lib/mirofish/types.ts`)

TypeScript type definitions for:
- `Prediction` — simulation result with risk direction, confidence, timeline, affected countries
- `SimulationStatus` — progress tracking (current round, total rounds, active agents)
- `AgentAction` — individual agent activity (agent name, role, action summary, round, timestamp)
- `PredictionAlert` — critical warning with severity, affected countries, probability

### API Routes

#### `POST /api/predict/trigger`

Triggers a new MiroFish simulation.

**Input:**
```json
{
  "scenario": "Escalating military tensions in the Taiwan Strait",
  "countries": ["Taiwan", "China", "Japan", "South Korea"],
  "source": "manual" | "automatic"
}
```

**Process:**
1. If `source` is "automatic", fetches recent GDELT events and Perplexity news for the specified countries
2. If `source` is "manual", uses the `scenario` text as the primary seed, supplemented with current risk data for the specified countries
3. Builds seed document via `buildSeedDocument()`
4. Calls MiroFish: ontology generation -> graph build -> create simulation -> prepare -> start
5. Returns `simulation_id` for polling

**Output:**
```json
{
  "simulationId": "sim_abc123",
  "status": "started",
  "estimatedMinutes": 15
}
```

**Simulation requirement template:**
```
Predict how {scenario} will evolve over the next 1-6 months, focusing on:
- Impact on international trade and shipping routes
- Government policy responses (sanctions, tariffs, export controls)
- Military escalation or de-escalation probability
- Economic ripple effects on supply chains
- Regional stability and civilian sentiment
Simulate the full spectrum of geopolitical actors: government officials, military analysts, trade representatives, diplomats, journalists, and civilian populations.
```

#### `GET /api/predict/status?simulationId=<id>`

Polls MiroFish simulation progress.

**Output:**
```json
{
  "simulationId": "sim_abc123",
  "status": "running" | "completed" | "failed",
  "currentRound": 4,
  "totalRounds": 10,
  "activeAgents": 6,
  "recentActions": [
    {
      "agentName": "Trade Minister Li",
      "role": "government",
      "action": "Posted about potential export restrictions on semiconductors",
      "round": 4,
      "timestamp": "2026-03-14T10:23:00Z"
    }
  ]
}
```

#### `GET /api/predict/results?simulationId=<id>`

Fetches completed simulation results.

**Output:**
```json
{
  "simulationId": "sim_abc123",
  "prediction": {
    "summary": "68% probability of trade restrictions affecting semiconductor supply chains within 90 days",
    "riskDirection": "increasing",
    "confidence": 0.68,
    "timelineMonths": 3,
    "affectedCountries": [
      { "country": "Taiwan", "currentRisk": 45, "predictedRisk": 72, "direction": "up" },
      { "country": "China", "currentRisk": 70, "predictedRisk": 82, "direction": "up" }
    ],
    "keyFindings": [
      "Military agents escalated rhetoric in rounds 3-6",
      "Trade agents began discussing alternative sourcing by round 5",
      "Diplomatic agents failed to reach consensus on de-escalation"
    ]
  },
  "fullReport": "# MiroFish Prediction Report\n...",
  "sentimentByRound": [
    { "round": 1, "sentiment": -0.1 },
    { "round": 2, "sentiment": -0.25 },
    { "round": 10, "sentiment": -0.65 }
  ]
}
```

### Automatic Monitoring

A background process triggered periodically (or on significant GDELT events):

1. Calls existing `/api/gdelt` endpoint for countries in the user's supply chain
2. Filters for significant events (new conflict, policy change, natural disaster themes)
3. Auto-triggers `/api/predict/trigger` with `source: "automatic"`
4. Results surface as alert toasts when simulation completes

---

## Frontend

### Predictions Panel (`components/predictions-panel.tsx`)

New panel accessible from the sidebar navigation alongside Routes and Inventory.

**Sections:**

1. **What-If Input** — Text input at the top where users type a custom scenario + country selector. "Simulate" button triggers `/api/predict/trigger`.

2. **Active Simulations** — Shows running simulations with:
   - Scenario description
   - Progress bar (round X of Y)
   - "~Z minutes remaining" estimate
   - Expandable live view (see Simulation Live View below)

3. **Recent Predictions** — Cards for completed predictions showing:
   - Triggering event (scenario text or GDELT event summary)
   - Predicted outcome summary (1-2 sentences)
   - Affected countries with risk direction arrows (up/down/stable)
   - Confidence level percentage
   - Time horizon (e.g., "within 3 months")
   - Clicking a card expands to show the full MiroFish report

### Prediction Card (`components/prediction-card.tsx`)

Individual prediction result card. Collapsed view shows summary; expanded view shows:
- Full MiroFish markdown report
- Sentiment trend chart
- Key findings list
- Affected countries detail

### Simulation Live View (within predictions panel)

Shown when a simulation is active and the user expands it:

**Agent Activity Feed**
- Polls `/api/predict/status` every 5 seconds
- Scrolling feed of agent actions, each showing: role icon (military/diplomat/trader/journalist/civilian), agent name, action summary, round number
- Auto-scrolls with fade-in animation for new entries

**Sentiment Trend Chart**
- Recharts line graph updating each round
- X-axis: simulation rounds, Y-axis: aggregate agent sentiment (-1 to 1)
- Color zones: red (negative/crisis), yellow (uncertain), green (stable)

**Knowledge Graph Embed**
- Iframe of MiroFish's Vue frontend (port 5002 — remapped to avoid conflict with Next.js on 3000)
- Shows D3.js knowledge graph of entities and relationships
- Shown only when user clicks "Show Knowledge Graph" — keeps default view clean

**Round Progress Indicator**
- "Round 4 of 10 — 6 agents active" status line
- Animated progress bar

### Inline Risk Sidebar Integration (`components/prediction-alert.tsx`)

Below each country's current risk score in the existing risk sidebar:
- Small **"Predicted"** indicator with directional arrow (up/down/stable)
- Color coded: red (rising risk), green (declining), grey (stable)
- Only shown when a prediction exists for that country
- Clicking opens the predictions panel filtered to that country
- Subtle pulsing dot on countries with active predictions

### Alert Toasts

When a completed simulation predicts significant risk increase (>20 points) for a country in the user's supply chain:
- Sonner toast notification: *"Prediction Alert: 68% probability of trade restrictions affecting Vietnam within 60 days"*
- Toast includes a "View Details" action that opens the predictions panel

### Predictions Hook (`hooks/use-predictions.ts`)

React hook managing prediction state:
- `triggerPrediction(scenario, countries)` — starts a new simulation
- `activePredictions` — list of running simulations with live status
- `completedPredictions` — list of finished predictions with results
- `pollStatus(simulationId)` — polling logic with 5-second interval
- Auto-stops polling when simulation completes

---

## MiroFish Setup

### Docker Compose (`docker-compose.yml`)

```yaml
services:
  mirofish:
    build: ./mirofish  # or image from Docker Hub
    ports:
      - "5001:5001"  # Flask API
      - "5002:3000"  # Vue.js frontend (remapped)
    environment:
      - LLM_API_KEY=${OPENROUTER_API_KEY}
      - LLM_BASE_URL=https://openrouter.ai/api/v1
      - LLM_MODEL_NAME=anthropic/claude-sonnet-4-20250514
      - ZEP_API_KEY=${ZEP_API_KEY}
    volumes:
      - mirofish-data:/app/data

volumes:
  mirofish-data:
```

### Environment Variables

New variables in `.env.local`:
- `ZEP_API_KEY` — Free tier from Zep Cloud (required for MiroFish agent memory)
- `MIROFISH_URL` — defaults to `http://localhost:5001`
- Reuses existing `OPENROUTER_API_KEY` for LLM calls

### Simulation Parameters

- `total_simulation_hours`: 72 (3 days simulated time)
- `minutes_per_round`: 60
- `max_rounds`: 10
- Platform: "twitter" (public discourse simulation)
- `enable_graph_memory_update`: true
- ~20-30 agents auto-generated from knowledge graph
- Full geopolitical spectrum configured via simulation requirement prompt

---

## Demo Flow

1. **Show existing supply chain** — decompose a product (e.g., smartphone), show on map with current risk scores
2. **Trigger live What-If** — type "Escalating military tensions in the Taiwan Strait" and hit Simulate
3. **Show live view** — while simulation runs (~10-15 min), show the agent feed updating, sentiment chart moving, knowledge graph
4. **Walk through other features** — route finding, relocation analysis while simulation runs in background
5. **Return to predictions** — simulation completes, prediction card appears with results, risk sidebar updates with projected arrows, alert toast fires
6. **Explore the prediction** — expand card, read full report, see affected countries

**Fallback:** Pre-start a simulation based on real GDELT events before the demo begins. Results are ready by the time the predictions feature is presented.

---

## New Files

```
docker-compose.yml                       — MiroFish sidecar configuration
lib/mirofish/client.ts                   — MiroFish REST API client
lib/mirofish/seed-builder.ts             — News/events to seed document converter
lib/mirofish/types.ts                    — TypeScript type definitions
app/api/predict/trigger/route.ts         — Trigger new simulation
app/api/predict/status/route.ts          — Poll simulation progress
app/api/predict/results/route.ts         — Fetch prediction results
components/predictions-panel.tsx         — Main predictions UI panel
components/prediction-card.tsx           — Individual prediction result card
components/prediction-alert.tsx          — Inline risk sidebar indicator
hooks/use-predictions.ts                — React hook for prediction state management
```

## Dependencies

- MiroFish (Docker) — open-source, self-hosted
- Zep Cloud — free tier for agent memory (GraphRAG)
- Existing OpenRouter API key — reused for MiroFish LLM calls
- No new npm packages required — uses existing Recharts, Sonner, Shadcn/UI
