// lib/decompose/pipeline.ts

import type { DecompositionTree, SupplyChainNode } from "./types";
import {
  SKELETON_SYSTEM,
  ADVERSARIAL_SYSTEM,
  skeletonPrompt,
  searchQueryPrompt,
  reconciliationPrompt,
  adversarialPrompt,
} from "./prompts";
import { searchNode } from "./search";

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

function selectCriticalNodes(
  tree: DecompositionTree,
  maxNodes: number = 8
): SupplyChainNode[] {
  const candidates: [number, SupplyChainNode][] = [];
  for (const node of Object.values(tree.nodes)) {
    if (node.tier < 2) continue;
    const score =
      node.tier * 10 + (1 - node.confidence) * 30 + node.risk_score * 0.5;
    candidates.push([score, node]);
  }
  candidates.sort((a, b) => b[0] - a[0]);
  return candidates.slice(0, maxNodes).map(([, node]) => node);
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function* runPipeline(
  product: string,
  suppliers: string[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const startTime = Date.now();

  // --- Phase 1: Skeleton ---
  let tree: DecompositionTree;
  try {
    const raw = await llmCall(
      SKELETON_SYSTEM,
      skeletonPrompt(product, suppliers),
      0.7,
      signal
    );
    const treeData = parseJson(raw) as unknown as DecompositionTree;
    tree = treeData;
    tree.phase = "skeleton";
    updateMetadata(tree);
    yield sseEvent("skeleton", { tree });
  } catch (e) {
    yield sseEvent("error", {
      message: `Skeleton generation failed: ${e instanceof Error ? e.message : e}`,
    });
    return;
  }

  // --- Phase 2: Search Validation ---
  yield sseEvent("refining", {});

  const criticalNodes = selectCriticalNodes(tree);
  const evidence: Record<string, string> = {};

  for (const node of criticalNodes) {
    // Find parent name for context
    let parentName = product;
    for (const candidate of Object.values(tree.nodes)) {
      if (candidate.children.includes(node.id)) {
        parentName = candidate.name;
        break;
      }
    }

    // Generate search query
    let query: string;
    try {
      query = await llmCall(
        "Generate a search query. Return ONLY the query string.",
        searchQueryPrompt(node.name, node.type, parentName),
        0.3,
        signal
      );
      query = query.trim().replace(/^["']|["']$/g, "");
    } catch {
      query = `${node.name} global production supply chain ${product}`;
    }

    // Search via Perplexity
    try {
      const result = await searchNode(query, signal);
      evidence[node.id] = result;
      tree.nodes[node.id].search_evidence = result;
    } catch {
      // Skip failed searches, continue pipeline
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
  } catch {
    tree.phase = "verified";
    updateMetadata(tree);
  }

  yield sseEvent("verified", { tree });

  // --- Done ---
  const durationMs = Date.now() - startTime;
  yield sseEvent("done", { duration_ms: durationMs });
}
