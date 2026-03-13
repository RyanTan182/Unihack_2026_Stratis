// lib/decompose/pipeline.ts

import type { DecompositionTree, SupplyChainNode, ExtractedEvidence } from "./types";
import {
  SKELETON_SYSTEM,
  ADVERSARIAL_SYSTEM,
  skeletonPrompt,
  reconciliationPrompt,
  adversarialPrompt,
} from "./prompts";
import { searchNode } from "./search";
import { normalizeCountryName } from "./country-aliases";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions";

function getModel(): string {
  return process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";
}

function getApiKey(): string {
  return process.env.OPENROUTER_API_KEY || "";
}

async function llmCall(
  system: string,
  user: string,
  temperature: number = 0.7,
  signal?: AbortSignal
): Promise<string> {
  const resp = await fetch(OPENROUTER_BASE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
    }),
    signal,
  });

  if (!resp.ok) {
    throw new Error(`OpenRouter API error: ${resp.status}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content || "{}";
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

    // Normalize country names first
    const normalized: Record<string, number> = {};
    for (const [country, pct] of entries) {
      const canonicalName = normalizeCountryName(country);
      normalized[canonicalName] = (normalized[canonicalName] || 0) + pct;
    }

    // Normalize percentages to sum to 100
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

function selectCriticalNodes(
  tree: DecompositionTree,
  maxNodes: number = 12
): SupplyChainNode[] {
  const candidates: [number, SupplyChainNode][] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.id === tree.root_id) continue;
    let score = 0;
    const isLeaf = node.children.length === 0;
    const hasConcentration = Object.keys(node.geographic_concentration).length > 0;
    if (isLeaf && !hasConcentration) score += 50;
    score += node.children.length * 8;
    score += (1 - node.confidence) * 30;
    score += node.tier * 5;
    score += node.risk_score * 0.3;
    candidates.push([score, node]);
  }
  candidates.sort((a, b) => b[0] - a[0]);
  return candidates.slice(0, maxNodes).map(([, node]) => node);
}


function findParentName(tree: DecompositionTree, nodeId: string, fallback: string): string {
  for (const candidate of Object.values(tree.nodes)) {
    if (candidate.children.includes(nodeId)) {
      return candidate.name;
    }
  }
  return fallback;
}

function buildSearchQuery(
  node: SupplyChainNode,
  tree: DecompositionTree,
  product: string,
): string {
  const parentName = findParentName(tree, node.id, product);
  return `${node.name} ${parentName} supply chain geographic production breakdown major producers ${product}`;
}

export async function* runPipeline(
  product: string,
  suppliers: string[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const startTime = Date.now();

  // --- Phase 1: Skeleton (with retry) ---
  let tree: DecompositionTree;
  try {
    const raw = await llmCall(SKELETON_SYSTEM, skeletonPrompt(product, suppliers), 0.7, signal);
    tree = parseJson(raw) as unknown as DecompositionTree;
  } catch {
    // Retry with higher temperature
    try {
      const raw = await llmCall(SKELETON_SYSTEM, skeletonPrompt(product, suppliers), 0.8, signal);
      tree = parseJson(raw) as unknown as DecompositionTree;
    } catch (retryError) {
      yield sseEvent("error", {
        message: `Skeleton generation failed after retry: ${retryError instanceof Error ? retryError.message : retryError}`,
      });
      return;
    }
  }
  tree.phase = "skeleton";
  updateMetadata(tree);
  yield sseEvent("skeleton", { tree });

  // --- Phase 2: Batched Parallel Search + Evidence Extraction ---
  yield sseEvent("refining", {});

  const criticalNodes = selectCriticalNodes(tree);
  const evidence: Record<string, ExtractedEvidence> = {};
  const BATCH_SIZE = 6;

  for (let i = 0; i < criticalNodes.length; i += BATCH_SIZE) {
    const batch = criticalNodes.slice(i, i + BATCH_SIZE);

    // Yield search-started for this batch
    for (const node of batch) {
      yield sseEvent("search-started", { nodeId: node.id });
    }

    // Run batch in parallel: build query → search (no LLM calls, just Perplexity)
    const results = await Promise.allSettled(
      batch.map(async (node) => {
        const query = buildSearchQuery(node, tree, product);
        const raw = await searchNode(query, signal);
        return { nodeId: node.id, raw };
      })
    );

    // Yield search-complete for each result
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        const rawText = result.value.raw;
        evidence[result.value.nodeId] = {
          countries: [],
          majorProducers: [],
          riskFactors: [],
          confidenceSignal: "moderate",
          rawText,
        };
        tree.nodes[result.value.nodeId].search_evidence = rawText;
        yield sseEvent("search-complete", { nodeId: result.value.nodeId, hasEvidence: true });
      } else {
        yield sseEvent("search-complete", { nodeId: batch[j].id, hasEvidence: false });
      }
    }
  }

  // --- Phase 3: Reconciliation ---
  if (Object.keys(evidence).length > 0) {
    try {
      const raw = await llmCall(
        "You are a supply chain analyst. Return valid JSON only.",
        reconciliationPrompt(tree, evidence),
        0.3,
        signal
      );
      const treeData = parseJson(raw) as unknown as DecompositionTree;
      tree = treeData;
      tree.phase = "refining";
      updateMetadata(tree);
      normalizeConcentrations(tree);
    } catch {
      tree.phase = "refining";
      updateMetadata(tree);
    }
  }

  // --- Phase 4: Adversarial Verification ---
  try {
    const raw = await llmCall(
      ADVERSARIAL_SYSTEM,
      adversarialPrompt(tree),
      0.4,
      signal
    );
    const treeData = parseJson(raw) as unknown as DecompositionTree;
    tree = treeData;
    tree.phase = "verified";
    updateMetadata(tree);
    normalizeConcentrations(tree);
  } catch {
    tree.phase = "verified";
    updateMetadata(tree);
  }

  yield sseEvent("verified", { tree });

  // --- Done ---
  const durationMs = Date.now() - startTime;
  yield sseEvent("done", { duration_ms: durationMs });
}
