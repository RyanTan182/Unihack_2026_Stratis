# Pipeline Speedup Research Summary

## Branch: `feat/pipeline-speedup`

## Problem

The current decomposition pipeline takes **~9 minutes (548s)** for a single product. Breakdown:

| Phase | Time | What it does |
|-------|------|-------------|
| Skeleton | 82s | 1 LLM call (gemini-2.5-flash) generates 33-node tree with empty geo data |
| Search | 13s | Perplexity `sonar` searches 12 critical nodes in batches of 6 |
| Reconciliation | 187s | 1 monolithic LLM call merges search evidence into tree |
| Adversarial | 265s | 1 monolithic LLM call reviews/corrects entire tree |

Root causes: Phases 3 & 4 are single massive LLM calls processing the full tree (~4K input + ~3K output tokens each). Search evidence is stored as raw prose (structured extraction was skipped), so reconciliation must parse prose too. All 4 phases run sequentially.

## Key Finding

**A single LLM call with an improved prompt produces better results in a fraction of the time.** The current pipeline's skeleton prompt generates low-quality nodes (`status: "inferred"`, empty `geographic_concentration`) then needs 3 more phases to fix them. A better prompt asking for real-world data upfront eliminates the need for search + reconciliation + adversarial entirely.

## Benchmark Results

All tests used "iPhone 17" as the product, run via OpenRouter.

| Approach | Time | Nodes | Geo Coverage | Quality |
|----------|------|-------|-------------|---------|
| **gemini-2.5-flash (1 call, improved prompt)** | **25.7s** | 40 | 40/40 (100%) | Good — real companies, real percentages |
| Opus 4.6 (1 call, improved prompt) | 274.8s | 38 | 38/38 (100%) | Excellent — most detailed (EUV chain, Zeiss/Trumpf) |
| Current pipeline (4 phases, gemini-2.5-flash) | 548s | 33 | 12/33 (36%) | Mixed — search-verified but sparse geo |

### Quality Comparison (Flash vs Opus)

**Both models agree on:** DRC 70% cobalt, China 85% rare earths, China 95% dysprosium, S.Korea 70% OLED, TSMC chip dominance, Shin-Etsu/SUMCO wafers.

**Opus advantages:**
- EUV lithography chain (ASML → Trumpf → Zeiss) — Flash missed this entirely
- More specific company references and nuanced risk factors
- Slightly more realistic percentages (Taiwan 92% not 100% for chips)

**Flash advantages:**
- 6 tier-1 subsystems vs 5 (includes Memory/Storage)
- More raw material coverage (graphite, electrolyte, stainless steel, chromium, iron ore, copper)
- 10.7x faster

**Verdict:** Flash quality is sufficient for hackathon. Geographic data is accurate, tree is comprehensive. Opus adds specificity but at 10x cost.

## Demo Scripts

All in `scripts/` directory on the `feat/pipeline-speedup` branch:

### `scripts/demo-opus-pipeline.ts`
- Single Opus 4.6 call via OpenRouter
- Run: `npx tsx scripts/demo-opus-pipeline.ts "Product Name" [supplier1 supplier2]`
- Output: `scripts/demo-output.json`

### `scripts/demo-flash.mjs`
- Configurable model via CLI arg (defaults to gemini-2.5-flash)
- Run: `node scripts/demo-flash.mjs "google/gemini-2.5-flash"`
- Run: `node scripts/demo-flash.mjs "anthropic/claude-opus-4"` (or any OpenRouter model)
- Output: `scripts/demo-output-{model-name}.json`

Both scripts load API keys from `.env.local` and print timing, node count, geo coverage, and top risk nodes.

## Existing Output Files

- `scripts/demo-output.json` — Opus 4.6 result (38 nodes, 274.8s)
- `scripts/demo-output-gemini-2.5-flash.json` — Flash result (40 nodes, 25.7s)

## Recommended Next Steps

### Option A: Replace pipeline with single Flash call (simplest, fastest)
- Replace the 4-phase pipeline with one gemini-2.5-flash call using the improved prompt from `demo-flash.mjs`
- Keeps the same `DecompositionTree` output format — no frontend changes needed
- Expected time: **~25-30s**
- Tradeoff: No real-time search grounding or citations

### Option B: Flash + optional Perplexity deep dive (recommended)
- Default: single Flash call (~25s) for the full tree
- Optional: user clicks a node → runs Perplexity `sonar` search on that specific node for real-time citations
- Best of both worlds: fast default, deep research on demand
- Expected default time: **~25-30s**, deep dive per node: **~5s**

### Option C: Hybrid parallel pipeline (most complex)
- Keep all 4 phases but parallelize reconciliation (per-node batches) and adversarial (per-subtree batches)
- Estimated: ~195s (~3.2 min) — still much slower than Option A/B
- Only worth it if search grounding is critical for every decomposition

## Current Pipeline Code Reference

| File | Purpose |
|------|---------|
| `lib/decompose/pipeline.ts` | Main pipeline orchestration (4 phases) |
| `lib/decompose/prompts.ts` | All LLM prompts (skeleton, reconciliation, adversarial, evidence extraction) |
| `lib/decompose/search.ts` | Perplexity sonar search wrapper |
| `lib/decompose/types.ts` | DecompositionTree, SupplyChainNode, ExtractedEvidence types |
| `lib/decompose/country-aliases.ts` | Country name normalization |
| `app/api/decompose/route.ts` | API route — streams SSE events from pipeline generator |
| `hooks/use-decompose.ts` | Frontend hook consuming SSE stream |

## Key Prompt Insight

The improved prompt (used in demo scripts) differs from the current skeleton prompt in these critical ways:

1. **Asks for real-world percentages** — "use your real-world knowledge of actual production percentages"
2. **Names companies** — "name actual companies in risk_factors"
3. **Self-check instruction** — "verify each node's geographic_concentration reflects reality"
4. **Sets status to verified** — instead of "inferred", signaling confidence
5. **Higher node target** — "25-40 nodes" vs current "20-40"

This single prompt change is what makes the 4-phase pipeline unnecessary — the LLM front-loads the quality.
