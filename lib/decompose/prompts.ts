// lib/decompose/prompts.ts

import type { DecompositionTree, ExtractedEvidence } from "./types";

const SKELETON_SYSTEM = `You are a supply chain decomposition expert. You break products down into their full dependency tree — from finished product to raw materials and geographies.

Output ONLY valid JSON matching the schema below. No markdown, no explanation.

Rules:
- Create 4-5 tiers deep: product → subsystems → components → materials → geographies
- Each node needs a unique id (use kebab-case like "node-battery-pack")
- Include speculative branches even if confidence is low — breadth over accuracy
- Set confidence between 0.0-1.0 (lower for uncertain claims)
- Set risk_score 0-100 based on supply concentration and geopolitical factors
- geographic_concentration should sum to ~100 for leaf/geography nodes
- All nodes start with status "inferred" and source "inferred"
- Aim for 20-40 nodes total`;

export function skeletonPrompt(product: string, suppliers: string[]): string {
  const schema = JSON.stringify(
    {
      product,
      phase: "skeleton",
      nodes: {
        "node-example": {
          id: "node-example",
          name: "Example",
          tier: 0,
          type: "product",
          status: "inferred",
          confidence: 0.7,
          geographic_concentration: {},
          risk_score: 50,
          risk_factors: [],
          source: "inferred",
          search_evidence: null,
          correction: null,
          children: [],
        },
      },
      root_id: "node-example",
    },
    null,
    2
  );

  const supplierContext =
    suppliers.length > 0
      ? `\n\nKnown first-tier suppliers: ${suppliers.join(", ")}. Incorporate these as known entities at tier 1 where appropriate, with higher confidence (0.8+).`
      : "";

  return `Decompose this product into a full supply chain dependency tree:

Product: ${product}${supplierContext}

Return JSON matching this schema:
${schema}

The "nodes" field is a flat map of id → node. Use "children" arrays to define the tree hierarchy. The "root_id" points to the top-level product node.`;
}

export function searchQueryPrompt(
  nodeName: string,
  nodeType: string,
  parentName: string
): string {
  return `You are researching supply chain data. Generate a focused search query to verify this supply chain dependency:

Node: ${nodeName} (type: ${nodeType})
Parent: ${parentName}

Generate ONE specific search query that would verify:
1. Whether this dependency is real and current
2. Geographic concentration of production/sourcing
3. Major producers or suppliers and their market share

Return ONLY the search query string, nothing else.`;
}

export function reconciliationPrompt(
  tree: DecompositionTree,
  evidence: Record<string, ExtractedEvidence>
): string {
  const evidenceText = Object.entries(evidence)
    .map(([nodeId, ev]) => {
      const countries = ev.countries
        .map((c) => `${c.name}: ${c.percentage}%`)
        .join(", ");
      return `### Node: ${nodeId}
Geographic data: ${countries || "none extracted"}
Major producers: ${ev.majorProducers.join(", ") || "unknown"}
Risk factors: ${ev.riskFactors.join(", ") || "none identified"}
Evidence strength: ${ev.confidenceSignal}
Raw context: ${ev.rawText.slice(0, 500)}`;
    })
    .join("\n\n");

  return `You are a supply chain analyst updating a dependency tree with search evidence.

Here is the original decomposition tree:
${JSON.stringify(tree, null, 2)}

Here is structured evidence for specific nodes:
${evidenceText}

Update the tree JSON:
- Use the "Geographic data" percentages as the source of truth for geographic_concentration. Copy them directly when available.
- If evidence CONFIRMS a node's claims: set status to "verified", source to "industry", adjust confidence upward based on evidence strength (strong=0.9+, moderate=0.7-0.8, weak=no change)
- If evidence CONTRADICTS a node: set status to "verified", source to "search", correct the data
- If evidence reveals MISSING dependencies: add new nodes with status "inferred"
- Nodes without search evidence: leave unchanged
- Set phase to "refining"

Return the complete updated tree as JSON. No markdown, no explanation.`;
}

const EVIDENCE_EXTRACTION_SYSTEM = `You are a data extraction assistant. Extract structured supply chain data from research results. Return ONLY valid JSON matching the schema. No markdown, no explanation.`;

export function evidenceExtractionPrompt(
  rawEvidence: string,
  nodeName: string
): string {
  return `Extract structured data from this supply chain research about "${nodeName}":

${rawEvidence}

Return JSON matching this schema:
{
  "countries": [{"name": "Country Name", "percentage": 45}],
  "majorProducers": ["Company A", "Company B"],
  "riskFactors": ["factor 1", "factor 2"],
  "confidenceSignal": "strong" | "moderate" | "weak"
}

Rules:
- countries: list of countries with their production/supply percentage. Percentages should sum to ~100.
- majorProducers: key companies or entities mentioned.
- riskFactors: supply chain risks identified (concentration, geopolitical, etc).
- confidenceSignal: "strong" if specific figures cited, "moderate" if general claims, "weak" if speculative.
- If data is not available for a field, use empty array or "weak".`;
}

const ADVERSARIAL_SYSTEM = `You are a supply chain expert reviewing a dependency tree for errors. Your job is to find mistakes, not confirm the analysis. Be skeptical and precise.`;

export function adversarialPrompt(tree: DecompositionTree): string {
  return `Review this supply chain dependency tree for errors:

${JSON.stringify(tree, null, 2)}

For each issue found:
1. Identify the node id
2. Explain what's wrong
3. Provide the correction

Then return the COMPLETE corrected tree as JSON with:
- Corrected nodes: status set to "corrected", source set to "adversarial", correction field explaining what changed
- Uncorrected nodes: left as-is
- phase set to "verified"

Check for:
- Implausible geographic concentration figures (do they reflect reality?)
- Confused suppliers vs actual manufacturers
- Missing critical dependencies for this product
- Risk scores that don't match the underlying concentration data
- Outdated or wrong country attributions

If the tree is largely correct, make minimal changes. Return valid JSON only, no markdown.`;
}

export { SKELETON_SYSTEM, ADVERSARIAL_SYSTEM, EVIDENCE_EXTRACTION_SYSTEM };
