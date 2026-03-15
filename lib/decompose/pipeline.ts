// lib/decompose/pipeline.ts

import type { DecompositionTree } from "./types";
import { normalizeCountryName } from "./country-aliases";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are a supply chain decomposition expert with deep knowledge of global manufacturing, raw materials sourcing, and geopolitical supply chain risks. You decompose products into their full dependency tree. Output ONLY valid JSON. No markdown, no explanation.`;

const FALLBACK_MODELS = [
  "moonshotai/kimi-k2.5",
  "google/gemini-2.5-flash",
  "meta-llama/llama-4-scout",
];

function getModel(): string {
  return process.env.OPENROUTER_MODEL || "anthropic/claude-opus-4-6";
}

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

function buildUserPrompt(product: string, suppliers: string[]): string {
  const supplierContext =
    suppliers.length > 0
      ? `\n\nKnown first-tier suppliers: ${suppliers.join(", ")}. Incorporate these as known entities at tier 1 with higher confidence (0.8+).`
      : "";

  return `Decompose ${product} into a full supply chain dependency tree.${supplierContext}

Requirements:
- 4-5 tiers deep: product → subsystems → components → materials → geographies
- 25-40 nodes total, each with unique kebab-case id
- geographic_concentration: use your real-world knowledge of actual production percentages, summing to ~100
- Name actual companies in risk_factors
- confidence: 0.0-1.0, risk_score: 0-100
- status: "verified" for well-known facts, "inferred" for guesses
- Self-check: verify each node's geographic_concentration reflects reality

Return JSON: { product, phase: "verified", nodes: { "node-id": { id, name, tier, type, status, confidence, geographic_concentration: {country: pct}, risk_score, risk_factors: [], source: "knowledge", search_evidence: null, correction: null, children: [] } }, root_id, metadata: { total_nodes, verified_count, corrected_count: 0, avg_confidence } }`;
}

async function llmCallWithModel(
  system: string,
  user: string,
  model: string,
  temperature: number = 0.3,
  signal?: AbortSignal
): Promise<string> {
  const resp = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
    }),
    signal,
  });

  if (!resp.ok) {
    const status = resp.status;
    const body = await resp.text().catch(() => "");
    throw new Error(`OpenRouter API error: ${status}${body ? ` - ${body}` : ""}`)
  }

  const data = await resp.json();
  return data.choices[0].message.content || "{}";
}

async function llmCall(
  system: string,
  user: string,
  temperature: number = 0.3,
  signal?: AbortSignal
): Promise<string> {
  const primary = getModel();
  try {
    return await llmCallWithModel(system, user, primary, temperature, signal);
  } catch (err) {
    const msg = (err as Error).message || "";
    // 402 = payment required, 429 = rate limit — try fallback models
    if (msg.includes(": 402") || msg.includes(": 429")) {
      console.warn(`Primary model ${primary} failed (${msg}), trying fallbacks...`);
      for (const fallback of FALLBACK_MODELS) {
        try {
          console.log(`Trying fallback model: ${fallback}`);
          return await llmCallWithModel(system, user, fallback, temperature, signal);
        } catch (fallbackErr) {
          console.warn(`Fallback ${fallback} failed: ${(fallbackErr as Error).message}`);
        }
      }
    }
    throw err;
  }
}

function parseJson(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.split("\n").slice(1).join("\n");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

function updateMetadata(tree: DecompositionTree): void {
  const nodes = Object.values(tree.nodes);
  tree.metadata = {
    total_nodes: nodes.length,
    verified_count: nodes.filter(
      (n) => n.status === "verified" || n.status === "corrected"
    ).length,
    corrected_count: nodes.filter((n) => n.status === "corrected").length,
    avg_confidence:
      nodes.length > 0
        ? Math.round(
            (nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length) *
              100
          ) / 100
        : 0,
  };
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function normalizeConcentrations(tree: DecompositionTree): void {
  for (const node of Object.values(tree.nodes)) {
    const entries = Object.entries(node.geographic_concentration);
    if (entries.length === 0) continue;

    const normalized: Record<string, number> = {};
    for (const [country, pct] of entries) {
      const canonicalName = normalizeCountryName(country);
      normalized[canonicalName] = (normalized[canonicalName] || 0) + pct;
    }

    const sum = Object.values(normalized).reduce((s, v) => s + v, 0);
    if (sum > 0 && (sum < 95 || sum > 105)) {
      const factor = 100 / sum;
      for (const key of Object.keys(normalized)) {
        normalized[key] = Math.round(normalized[key] * factor * 10) / 10;
      }
    }

    node.geographic_concentration = normalized;
  }
}

export async function* runPipeline(
  product: string,
  suppliers: string[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const startTime = Date.now();

  console.log(`[pipeline] Single-call decomposition started for "${product}"`);

  // Emit skeleton placeholder so the frontend shows loading state
  yield sseEvent("refining", {});

  let tree: DecompositionTree;
  try {
    const raw = await llmCall(
      SYSTEM_PROMPT,
      buildUserPrompt(product, suppliers),
      0.3,
      signal
    );
    tree = parseJson(raw) as unknown as DecompositionTree;
  } catch (e) {
    // Retry once with slightly higher temperature
    try {
      const raw = await llmCall(
        SYSTEM_PROMPT,
        buildUserPrompt(product, suppliers),
        0.5,
        signal
      );
      tree = parseJson(raw) as unknown as DecompositionTree;
    } catch (retryError) {
      yield sseEvent("error", {
        message: `Decomposition failed after retry: ${retryError instanceof Error ? retryError.message : retryError}`,
      });
      return;
    }
  }

  tree.phase = "verified";
  updateMetadata(tree);
  normalizeConcentrations(tree);

  const durationMs = Date.now() - startTime;
  console.log(
    `[pipeline] Decomposition done in ${durationMs}ms (${Object.keys(tree.nodes).length} nodes)`
  );

  yield sseEvent("verified", { tree });
  yield sseEvent("done", { duration_ms: durationMs });
}
